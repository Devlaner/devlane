package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/mail"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// NotificationService handles notification business logic — both serving the
// inbox to receivers and fanning out new notifications when domain events
// happen elsewhere in the API.
//
// Emit* methods are called by IssueService and CommentService AFTER their
// own DB writes succeed. emit() returns are logged and swallowed: a transient
// notifications-table failure must not roll back the user's actual change.
type NotificationService struct {
	ns       *store.NotificationStore
	ws       *store.WorkspaceStore
	is       *store.IssueStore                      // for assignee + creator lookups (receiver computation)
	ps       *store.ProjectStore                    // for project-membership filter
	us       *store.UserStore                       // for actor display name
	ss       *store.StateStore                      // for state name resolution in Message payload
	subs     *store.IssueSubscriberStore            // optional — subscriber-based receivers
	prefs    *store.UserNotificationPreferenceStore // optional — preference gating
	log      *slog.Logger
	emailLog *store.EmailNotificationLogStore // optional — email notification audit logging
	queue    *queue.Publisher                 // optional — RabbitMQ publisher for email notifications
	appURL   string                           // optional — base URL for issue links in notification emails
}

func NewNotificationService(
	ns *store.NotificationStore,
	ws *store.WorkspaceStore,
	is *store.IssueStore,
	ps *store.ProjectStore,
	us *store.UserStore,
	ss *store.StateStore,
) *NotificationService {
	return &NotificationService{
		ns: ns,
		ws: ws,
		is: is,
		ps: ps,
		us: us,
		ss: ss,
	}
}

// SetSubscriberStore wires per-issue subscriber lookups so subscribers are
// included in receiver fan-out. Optional.
func (s *NotificationService) SetSubscriberStore(subs *store.IssueSubscriberStore) {
	s.subs = subs
}

// SetPreferenceStore wires user notification preferences so receivers who have
// opted out of a category are dropped before insert. Optional.
func (s *NotificationService) SetPreferenceStore(p *store.UserNotificationPreferenceStore) {
	s.prefs = p
}

// SetLogger lets the caller wire a request-scoped slog. Optional.
func (s *NotificationService) SetLogger(l *slog.Logger) { s.log = l }

// SetEmailLogStore wires email notification audit logging. Optional.
func (s *NotificationService) SetEmailLogStore(e *store.EmailNotificationLogStore) {
	s.emailLog = e
}

// SetQueue wires the RabbitMQ publisher for email notifications. Optional.
func (s *NotificationService) SetQueue(q *queue.Publisher) {
	s.queue = q
}

// SetAppBaseURL wires the base URL for issue links in notification emails. Optional.
func (s *NotificationService) SetAppBaseURL(url string) {
	s.appURL = url
}

func (s *NotificationService) logger() *slog.Logger {
	if s.log != nil {
		return s.log
	}
	return slog.Default()
}

// ----- Reads --------------------------------------------------------------

func (s *NotificationService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID, opts store.ListOpts) ([]model.Notification, error) {
	var workspaceID *uuid.UUID
	if workspaceSlug != "" {
		wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
		if err != nil {
			return nil, ErrProjectForbidden
		}
		ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
		if !ok {
			return nil, ErrProjectForbidden
		}
		workspaceID = &wrk.ID
	}
	return s.ns.ListByReceiverID(ctx, userID, workspaceID, opts)
}

func (s *NotificationService) UnreadCount(ctx context.Context, workspaceSlug string, userID uuid.UUID) (total, mentions int64, err error) {
	var workspaceID *uuid.UUID
	if workspaceSlug != "" {
		wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
		if err != nil {
			return 0, 0, ErrProjectForbidden
		}
		ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
		if !ok {
			return 0, 0, ErrProjectForbidden
		}
		workspaceID = &wrk.ID
	}
	return s.ns.CountUnread(ctx, userID, workspaceID)
}

func (s *NotificationService) MarkRead(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.MarkRead(ctx, notificationID, userID)
}

func (s *NotificationService) MarkUnread(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.MarkUnread(ctx, notificationID, userID)
}

func (s *NotificationService) Archive(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.Archive(ctx, notificationID, userID)
}

func (s *NotificationService) Unarchive(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.Unarchive(ctx, notificationID, userID)
}

// ErrInvalidSnooze indicates a Snooze call with a non-future timestamp.
var ErrInvalidSnooze = errors.New("snooze: until must be in the future")

func (s *NotificationService) Snooze(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID, until time.Time) error {
	if !until.After(time.Now()) {
		return ErrInvalidSnooze
	}
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.Snooze(ctx, notificationID, userID, until)
}

func (s *NotificationService) Unsnooze(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.Unsnooze(ctx, notificationID, userID)
}

func (s *NotificationService) MarkAllRead(ctx context.Context, workspaceSlug string, userID uuid.UUID) error {
	var workspaceID *uuid.UUID
	if workspaceSlug != "" {
		wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
		if err != nil {
			return ErrProjectForbidden
		}
		ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
		if !ok {
			return ErrProjectForbidden
		}
		workspaceID = &wrk.ID
	}
	return s.ns.MarkAllRead(ctx, userID, workspaceID)
}

// ----- Emit fan-out -------------------------------------------------------

// emitParams carries the per-notification context used to build the row.
type emitParams struct {
	issue           *model.Issue
	actorID         uuid.UUID
	sender          string
	field           string               // optional, for change notifications
	before, after   string               // optional, denormalized human-readable values
	commentPreview  string               // optional, for `commented`
	mentionContext  string               // "description" | "comment", used for sender=mentioned
	classifyMention func(uuid.UUID) bool // optional, returns true if receiver should get sender=mentioned instead of params.sender
}

// emit fans `params` out to one row per receiver.
//
//   - dedupe receivers
//   - exclude the actor (they did the action)
//   - filter through project membership (workspace member who isn't on the
//     project shouldn't get a notification for it)
//   - generate Title + Message JSON server-side and CreateMany
//
// Errors are logged and swallowed.
func (s *NotificationService) emit(ctx context.Context, receivers []uuid.UUID, params emitParams) {
	if params.issue == nil {
		return
	}
	if len(receivers) == 0 {
		return
	}
	clean := dedupExclude(receivers, params.actorID)
	if len(clean) == 0 {
		return
	}

	// Workspace-membership filter: drop receivers who are no longer members of
	// the workspace the issue belongs to. We deliberately don't filter by
	// project_members — Devlane allows assigning a workspace member to an issue
	// without first adding them to project_members, so requiring that row would
	// silently drop legitimately-assigned receivers.
	allowed := make([]uuid.UUID, 0, len(clean))
	for _, id := range clean {
		ok, err := s.ws.IsMember(ctx, params.issue.WorkspaceID, id)
		if err != nil {
			s.logger().Warn("notification workspace-member check failed", "err", err)
			continue
		}
		if !ok {
			continue
		}
		allowed = append(allowed, id)
	}
	if len(allowed) == 0 {
		return
	}

	// Preference gating: in-app rows and email delivery are controlled
	// independently. Mention notifications still classify separately from
	// comment notifications.
	inAppAllowed := allowed
	emailAllowed := allowed
	if s.prefs != nil {
		inAppGated := make([]uuid.UUID, 0, len(allowed))
		emailGated := make([]uuid.UUID, 0, len(allowed))
		for _, id := range allowed {
			pref := s.deliveryPreferenceForSender(ctx, id, params.issue, params.sender, params.classifyMention)
			if pref.InApp {
				inAppGated = append(inAppGated, id)
			}
			if pref.Email {
				emailGated = append(emailGated, id)
			}
		}
		inAppAllowed = inAppGated
		emailAllowed = emailGated
	}
	if len(inAppAllowed) == 0 && len(emailAllowed) == 0 {
		return
	}

	// Resolve denormalized fields used to render the title.
	actorName := s.actorDisplayName(ctx, params.actorID)
	projectIdent := s.projectIdentifier(ctx, params.issue.ProjectID)
	issueRef := fmt.Sprintf("%s-%d", projectIdent, params.issue.SequenceID)

	rows := make([]model.Notification, 0, len(inAppAllowed))
	for _, receiverID := range inAppAllowed {
		sender := params.sender
		if params.classifyMention != nil && params.classifyMention(receiverID) {
			sender = model.NotificationSenderMentioned
		}
		title := buildTitle(sender, actorName, issueRef, params.field, params.before, params.after)
		msg := buildMessage(messageInputs{
			actor:          actorRef{id: params.actorID, name: actorName},
			issue:          issueRef2{id: params.issue.ID, name: params.issue.Name, seq: params.issue.SequenceID, projectIdentifier: projectIdent},
			projectID:      params.issue.ProjectID,
			field:          params.field,
			before:         params.before,
			after:          params.after,
			commentPreview: params.commentPreview,
			contextKind:    params.mentionContext,
		})
		issueID := params.issue.ID
		projectID := params.issue.ProjectID
		actor := params.actorID
		rows = append(rows, model.Notification{
			Title:            title,
			Message:          msg,
			Sender:           sender,
			ReceiverID:       receiverID,
			WorkspaceID:      params.issue.WorkspaceID,
			ProjectID:        &projectID,
			TriggeredByID:    &actor,
			EntityIdentifier: &issueID,
			EntityName:       model.NotificationEntityIssue,
		})
	}
	if len(rows) > 0 {
		if err := s.ns.CreateMany(ctx, rows); err != nil {
			s.logger().Warn("notification fan-out failed", "err", err, "issue_id", params.issue.ID, "receivers", len(rows))
		}
	}

	// Queue notification emails if email infrastructure is available.
	// This runs synchronously but logs+swallows errors to avoid breaking in-app notifications.
	if s.queue != nil && s.emailLog != nil && s.appURL != "" {
		s.enqueueNotificationEmails(ctx, emailAllowed, params, actorName, issueRef)
	}
}

// enqueueNotificationEmails queues an email for each receiver whose email
// preferences allow this notification.
// Errors are logged and swallowed — email delivery is best-effort and must not break in-app notifications.
func (s *NotificationService) enqueueNotificationEmails(ctx context.Context, receivers []uuid.UUID, params emitParams, actorName, issueRef string) {
	if params.issue == nil || len(receivers) == 0 {
		return
	}

	issueURL := fmt.Sprintf("%s/issue/%s", strings.TrimSuffix(s.appURL, "/"), params.issue.ID)

	// Resolve workspace name for email footer
	workspaceName := "Devlane"
	if wrk, err := s.ws.GetByID(ctx, params.issue.WorkspaceID); err == nil && wrk != nil {
		workspaceName = wrk.Name
	}

	for _, receiverID := range receivers {
		receiver, err := s.us.GetByID(ctx, receiverID)
		if err != nil || receiver == nil || receiver.Email == nil || *receiver.Email == "" {
			continue // Skip users without email
		}

		// Determine effective sender (mention override)
		sender := params.sender
		if params.classifyMention != nil && params.classifyMention(receiverID) {
			sender = model.NotificationSenderMentioned
		}

		// Build receiver display name
		receiverName := receiver.DisplayName
		if receiverName == "" {
			receiverName = strings.TrimSpace(receiver.FirstName + " " + receiver.LastName)
		}
		if receiverName == "" {
			receiverName = receiver.Username
		}
		if receiverName == "" {
			receiverName = "there"
		}

		// Build email content
		subject, body := mail.BuildNotificationEmail(sender, mail.NotificationEmailData{
			ReceiverName:   receiverName,
			ActorName:      actorName,
			IssueRef:       issueRef,
			IssueTitle:     params.issue.Name,
			IssueURL:       issueURL,
			WorkspaceName:  workspaceName,
			CommentPreview: params.commentPreview,
			FieldName:      humanFieldName(params.field),
			OldValue:       params.before,
			NewValue:       params.after,
		})

		// Create email log entry (for audit)
		issueID := params.issue.ID
		emailLog := &model.EmailNotificationLog{
			ReceiverID:       receiverID,
			TriggeredByID:    &params.actorID,
			Subject:          subject,
			EntityIdentifier: &issueID,
			EntityName:       model.NotificationEntityIssue,
			Data: model.JSONMap{
				"sender":     sender,
				"issue_ref":  issueRef,
				"issue_name": params.issue.Name,
			},
		}
		if err := s.emailLog.Create(ctx, emailLog); err != nil {
			s.logger().Warn("email log create failed, skipping email", "err", err, "receiver", receiverID)
			continue
		}

		// Queue email via RabbitMQ
		if err := s.queue.PublishSendEmail(ctx, queue.SendEmailPayload{
			To:      *receiver.Email,
			Subject: subject,
			Body:    body,
			Kind:    fmt.Sprintf("notification_%s", sender),
		}); err != nil {
			s.logger().Warn("email queue failed", "err", err, "receiver", receiverID, "log_id", emailLog.ID)
			continue
		}

		// Mark as sent (queued to RabbitMQ)
		now := time.Now()
		if err := s.emailLog.MarkSent(ctx, emailLog.ID, now); err != nil {
			s.logger().Warn("email log mark sent failed", "err", err, "log_id", emailLog.ID)
			// Non-fatal: email is queued, log update failure doesn't matter
		}
	}
}

// actorDisplayName returns the user's display name, falling back through
// first+last name → username → "Someone".
func (s *NotificationService) actorDisplayName(ctx context.Context, id uuid.UUID) string {
	if id == uuid.Nil {
		return "Someone"
	}
	u, err := s.us.GetByID(ctx, id)
	if err != nil || u == nil {
		return "Someone"
	}
	if u.DisplayName != "" {
		return u.DisplayName
	}
	full := strings.TrimSpace(u.FirstName + " " + u.LastName)
	if full != "" {
		return full
	}
	if u.Username != "" {
		return u.Username
	}
	return "Someone"
}

func (s *NotificationService) projectIdentifier(ctx context.Context, projectID uuid.UUID) string {
	p, err := s.ps.GetByID(ctx, projectID)
	if err != nil || p == nil || p.Identifier == "" {
		return "ISSUE"
	}
	return p.Identifier
}

// stateName resolves a state UUID to its display name. Returns "" if not found.
func (s *NotificationService) stateName(ctx context.Context, id *uuid.UUID) string {
	if id == nil || *id == uuid.Nil {
		return ""
	}
	st, err := s.ss.GetByID(ctx, *id)
	if err != nil || st == nil {
		return ""
	}
	return st.Name
}

// computeIssueReceivers returns assignees ∪ creator ∪ subscribers for an issue.
// Used by Comment / StateChange / FieldChange emitters.
func (s *NotificationService) computeIssueReceivers(ctx context.Context, issue *model.Issue) []uuid.UUID {
	out := make([]uuid.UUID, 0, 8)
	if assignees, err := s.is.ListAssigneesForIssue(ctx, issue.ID); err == nil {
		out = append(out, assignees...)
	}
	if issue.CreatedByID != nil {
		out = append(out, *issue.CreatedByID)
	}
	if s.subs != nil {
		if ids, err := s.subs.ListByIssue(ctx, issue.ID); err == nil {
			out = append(out, ids...)
		}
	}
	return out
}

// ----- Public emitters ----------------------------------------------------

// IssueAssigned notifies the newly-added assignees. Receivers = added IDs only.
func (s *NotificationService) IssueAssigned(ctx context.Context, issue *model.Issue, actorID uuid.UUID, added []uuid.UUID) {
	if issue == nil || len(added) == 0 {
		return
	}
	s.emit(ctx, added, emitParams{
		issue:   issue,
		actorID: actorID,
		sender:  model.NotificationSenderAssigned,
	})
}

// IssueMentioned notifies users mentioned in an issue description (or by extension,
// any rich-text where contextKind specifies the source). Used by IssueService.{Create,Update}
// for description-mention diffs.
func (s *NotificationService) IssueMentioned(ctx context.Context, issue *model.Issue, actorID uuid.UUID, mentioned []uuid.UUID, contextKind string) {
	if issue == nil || len(mentioned) == 0 {
		return
	}
	s.emit(ctx, mentioned, emitParams{
		issue:          issue,
		actorID:        actorID,
		sender:         model.NotificationSenderMentioned,
		mentionContext: contextKind,
	})
}

// IssueCommented notifies the issue's followers (assignees ∪ creator) and any
// users mentioned inside the comment body. Mentioned receivers get
// sender=mentioned; everyone else gets sender=commented.
func (s *NotificationService) IssueCommented(ctx context.Context, issue *model.Issue, actorID uuid.UUID, commentText string, mentioned []uuid.UUID) {
	if issue == nil {
		return
	}
	receivers := s.computeIssueReceivers(ctx, issue)
	receivers = append(receivers, mentioned...)
	mentionSet := make(map[uuid.UUID]bool, len(mentioned))
	for _, id := range mentioned {
		mentionSet[id] = true
	}
	preview := stripPreview(commentText, 140)
	s.emit(ctx, receivers, emitParams{
		issue:           issue,
		actorID:         actorID,
		sender:          model.NotificationSenderCommented,
		commentPreview:  preview,
		mentionContext:  "comment",
		classifyMention: func(id uuid.UUID) bool { return mentionSet[id] },
	})
}

// IssueStateChanged notifies followers when state moved.
func (s *NotificationService) IssueStateChanged(ctx context.Context, issue *model.Issue, actorID uuid.UUID, prevStateID, newStateID *uuid.UUID) {
	if issue == nil {
		return
	}
	receivers := s.computeIssueReceivers(ctx, issue)
	s.emit(ctx, receivers, emitParams{
		issue:   issue,
		actorID: actorID,
		sender:  model.NotificationSenderStateChanged,
		field:   "state",
		before:  s.stateName(ctx, prevStateID),
		after:   s.stateName(ctx, newStateID),
	})
}

// IssueFieldChanged is a catch-all for non-state field updates (priority, due dates, parent, name).
func (s *NotificationService) IssueFieldChanged(ctx context.Context, issue *model.Issue, actorID uuid.UUID, field, before, after string) {
	if issue == nil || field == "" {
		return
	}
	receivers := s.computeIssueReceivers(ctx, issue)
	s.emit(ctx, receivers, emitParams{
		issue:   issue,
		actorID: actorID,
		sender:  model.NotificationSenderSubscribed,
		field:   field,
		before:  before,
		after:   after,
	})
}

// IssueDeleted garbage-collects rows pointing at the now-gone issue, so users
// don't click an inbox row that lands on a 404.
func (s *NotificationService) IssueDeleted(ctx context.Context, issueID uuid.UUID) {
	if issueID == uuid.Nil {
		return
	}
	if err := s.ns.DeleteByEntity(ctx, issueID); err != nil {
		s.logger().Warn("notification cleanup on issue delete failed", "err", err, "issue_id", issueID)
	}
}

// ----- Title + Message construction ---------------------------------------

func buildTitle(sender, actor, issueRef, field, before, after string) string {
	switch sender {
	case model.NotificationSenderAssigned:
		return fmt.Sprintf("%s assigned you to %s", actor, issueRef)
	case model.NotificationSenderMentioned:
		return fmt.Sprintf("%s mentioned you in %s", actor, issueRef)
	case model.NotificationSenderCommented:
		return fmt.Sprintf("%s commented on %s", actor, issueRef)
	case model.NotificationSenderStateChanged:
		if before != "" && after != "" {
			return fmt.Sprintf("%s moved %s from %s to %s", actor, issueRef, before, after)
		}
		if after != "" {
			return fmt.Sprintf("%s set %s state to %s", actor, issueRef, after)
		}
		return fmt.Sprintf("%s changed the state of %s", actor, issueRef)
	case model.NotificationSenderSubscribed:
		fieldLabel := humanFieldName(field)
		if before != "" && after != "" {
			return fmt.Sprintf("%s changed %s of %s from %s to %s", actor, fieldLabel, issueRef, before, after)
		}
		if after != "" {
			return fmt.Sprintf("%s set %s of %s to %s", actor, fieldLabel, issueRef, after)
		}
		return fmt.Sprintf("%s updated %s on %s", actor, fieldLabel, issueRef)
	default:
		return fmt.Sprintf("%s updated %s", actor, issueRef)
	}
}

func humanFieldName(field string) string {
	switch field {
	case "start_date":
		return "start date"
	case "target_date":
		return "due date"
	case "parent":
		return "parent"
	case "priority":
		return "priority"
	case "name":
		return "title"
	default:
		return field
	}
}

type actorRef struct {
	id   uuid.UUID
	name string
}
type issueRef2 struct {
	id                uuid.UUID
	name              string
	seq               int
	projectIdentifier string
}
type messageInputs struct {
	actor          actorRef
	issue          issueRef2
	projectID      uuid.UUID
	field          string
	before, after  string
	commentPreview string
	contextKind    string
}

func buildMessage(in messageInputs) model.JSONMap {
	m := model.JSONMap{
		"actor": map[string]any{
			"id":           in.actor.id.String(),
			"display_name": in.actor.name,
		},
		"issue": map[string]any{
			"id":                 in.issue.id.String(),
			"name":               in.issue.name,
			"sequence_id":        in.issue.seq,
			"project_identifier": in.issue.projectIdentifier,
		},
	}
	if in.field != "" {
		m["field"] = in.field
	}
	if in.before != "" {
		m["before"] = in.before
	}
	if in.after != "" {
		m["after"] = in.after
	}
	if in.commentPreview != "" {
		m["comment_preview"] = in.commentPreview
	}
	if in.contextKind != "" {
		m["context"] = in.contextKind
	}
	return m
}

type deliveryPreference struct {
	InApp bool
	Email bool
}

// deliveryPreferenceForSender resolves the receiver's effective scoped
// preferences for this issue and returns the enabled delivery channels.
func (s *NotificationService) deliveryPreferenceForSender(ctx context.Context, userID uuid.UUID, issue *model.Issue, sender string, classify func(uuid.UUID) bool) deliveryPreference {
	effective := sender
	if classify != nil && classify(userID) {
		effective = model.NotificationSenderMentioned
	}
	if s.prefs == nil || issue == nil {
		return deliveryPreference{InApp: true, Email: true}
	}
	p, _, err := s.prefs.ResolveForIssue(ctx, userID, issue.WorkspaceID, issue.ProjectID)
	if err != nil || p == nil {
		// Default: allow everything when no preference row exists.
		return deliveryPreference{InApp: true, Email: true}
	}
	switch effective {
	case model.NotificationSenderMentioned:
		return deliveryPreference{InApp: p.MentionInApp, Email: p.MentionEmail}
	case model.NotificationSenderCommented:
		return deliveryPreference{InApp: p.CommentInApp, Email: p.CommentEmail}
	case model.NotificationSenderStateChanged:
		return deliveryPreference{InApp: p.StateChangeInApp, Email: p.StateChangeEmail}
	case model.NotificationSenderSubscribed:
		return deliveryPreference{InApp: p.PropertyChangeInApp, Email: p.PropertyChangeEmail}
	case model.NotificationSenderAssigned:
		// Assignment notifications are not separately gated — receiving an
		// assignment is fundamental to working on an issue. We honor only
		// PropertyChange here as a coarse opt-out.
		return deliveryPreference{InApp: p.PropertyChangeInApp, Email: p.PropertyChangeEmail}
	}
	return deliveryPreference{InApp: true, Email: true}
}

// dedupExclude returns receivers minus exclude, with duplicates and uuid.Nil removed.
// Order is preserved by first occurrence.
func dedupExclude(receivers []uuid.UUID, exclude uuid.UUID) []uuid.UUID {
	if len(receivers) == 0 {
		return nil
	}
	seen := make(map[uuid.UUID]struct{}, len(receivers))
	out := make([]uuid.UUID, 0, len(receivers))
	for _, id := range receivers {
		if id == uuid.Nil || id == exclude {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// stripPreview reduces an HTML/rich-text snippet to plain text and trims to
// maxLen runes. Truncating by rune (not byte) keeps multi-byte UTF-8 sequences
// intact; otherwise a slice could cut a code point in half and corrupt the
// preview stored in the notification payload.
func stripPreview(htmlContent string, maxLen int) string {
	if htmlContent == "" {
		return ""
	}
	var b strings.Builder
	inTag := false
	for _, r := range htmlContent {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			b.WriteRune(r)
		}
	}
	out := strings.Join(strings.Fields(b.String()), " ")
	runes := []rune(out)
	if len(runes) > maxLen {
		out = strings.TrimSpace(string(runes[:maxLen])) + "…"
	}
	return out
}
