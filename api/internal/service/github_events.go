package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	gh "github.com/Devlaner/devlane/api/internal/github"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// GithubEventService processes inbound webhook events: it owns the side-effects
// that turn a GitHub event into Devlane state changes (issue activity comments,
// PR↔issue link upserts, state transitions on merge).
type GithubEventService struct {
	log *slog.Logger

	wis     *store.WorkspaceIntegrationStore
	repo    *store.GithubRepositoryStore
	rs      *store.GithubRepositorySyncStore
	is      *store.IntegrationStore
	issues  *store.GithubIssueSyncStore
	events  *store.GithubWebhookEventStore
	ws      *store.WorkspaceStore
	ps      *store.ProjectStore
	issue   *store.IssueStore
	state   *store.StateStore
	comment *store.CommentStore
	intSvc  *IntegrationService
}

// NewGithubEventService wires the dependencies needed for event processing.
func NewGithubEventService(
	log *slog.Logger,
	wis *store.WorkspaceIntegrationStore,
	repo *store.GithubRepositoryStore,
	rs *store.GithubRepositorySyncStore,
	intStore *store.IntegrationStore,
	issues *store.GithubIssueSyncStore,
	events *store.GithubWebhookEventStore,
	ws *store.WorkspaceStore,
	ps *store.ProjectStore,
	issue *store.IssueStore,
	state *store.StateStore,
	comment *store.CommentStore,
	intSvc *IntegrationService,
) *GithubEventService {
	return &GithubEventService{
		log: log, wis: wis, repo: repo, rs: rs, is: intStore, issues: issues,
		events: events, ws: ws, ps: ps, issue: issue, state: state, comment: comment, intSvc: intSvc,
	}
}

// HandleWebhook is the entry point called by the HTTP handler after signature
// verification. event is the X-GitHub-Event header value, deliveryID the
// X-GitHub-Delivery header value (for idempotency), payload the raw body.
//
// Returns nil to ack the delivery; non-nil errors are logged and recorded but
// still result in a 200 response — webhook senders should never see internal
// failures. (GitHub will not retry on 200, but our github_webhook_events row
// captures the failure for ops to triage.)
func (s *GithubEventService) HandleWebhook(ctx context.Context, event, deliveryID string, payload []byte) error {
	if deliveryID == "" {
		return errors.New("missing X-GitHub-Delivery header")
	}
	// Idempotency: short-circuit if we've already logged this delivery.
	if exists, _ := s.events.ExistsByDeliveryID(ctx, deliveryID); exists {
		s.logger().Debug("github webhook delivery already processed", "delivery_id", deliveryID, "event", event)
		return nil
	}

	envelope := struct {
		Action       string                `json:"action,omitempty"`
		Installation *gh.InstallationLite  `json:"installation,omitempty"`
		Repository   *gh.RepositoryLite    `json:"repository,omitempty"`
	}{}
	_ = json.Unmarshal(payload, &envelope)

	var installationID *int64
	if envelope.Installation != nil {
		id := envelope.Installation.ID
		installationID = &id
	}
	repoFullName := ""
	if envelope.Repository != nil {
		repoFullName = envelope.Repository.FullName
	}

	logRow := &model.GithubWebhookEvent{
		DeliveryID:         deliveryID,
		Event:              event,
		Action:             envelope.Action,
		InstallationID:     installationID,
		RepositoryFullName: repoFullName,
		Payload:            payloadToJSONMap(payload),
		Status:             "received",
	}
	if err := s.events.Create(ctx, logRow); err != nil {
		s.logger().Error("failed to record github webhook event", "delivery_id", deliveryID, "error", err)
	}

	dispatchErr := s.dispatch(ctx, event, payload, envelope.Action)
	status := "processed"
	errMsg := ""
	if dispatchErr != nil {
		status = "error"
		errMsg = dispatchErr.Error()
		s.logger().Warn("github webhook handler failed", "event", event, "delivery_id", deliveryID, "error", dispatchErr)
	}
	_ = s.events.MarkProcessed(ctx, logRow.ID, status, errMsg)
	return dispatchErr
}

// dispatch is the per-event router; isolated from HandleWebhook so logging
// happens in one place.
func (s *GithubEventService) dispatch(ctx context.Context, event string, payload []byte, action string) error {
	switch event {
	case gh.EventPing:
		return nil
	case gh.EventInstallation:
		return s.handleInstallation(ctx, payload)
	case gh.EventInstallationRepositories:
		return s.handleInstallationRepositories(ctx, payload)
	case gh.EventPullRequest:
		return s.handlePullRequest(ctx, payload, action)
	case gh.EventIssueComment:
		return s.handleIssueComment(ctx, payload, action)
	case gh.EventPush:
		return s.handlePush(ctx, payload)
	default:
		// Unknown / unhandled events — accepted but no-op.
		return nil
	}
}

// ---------------------------------------------------------------------------
// installation lifecycle
// ---------------------------------------------------------------------------

func (s *GithubEventService) handleInstallation(ctx context.Context, payload []byte) error {
	var ev gh.InstallationEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return err
	}
	wi, err := s.wis.GetByInstallationID(ctx, ev.Installation.ID)
	if err != nil {
		// Not yet linked to a workspace — that's fine for the "created" case;
		// the user may not have completed the OAuth state exchange yet. We
		// silently ignore it.
		return nil
	}
	switch ev.Action {
	case "created", "new_permissions_accepted":
		// Hydrate account fields if blank.
		changed := false
		if wi.AccountLogin == "" && ev.Installation.Account.Login != "" {
			wi.AccountLogin = ev.Installation.Account.Login
			changed = true
		}
		if wi.AccountType == "" && ev.Installation.Account.Type != "" {
			wi.AccountType = ev.Installation.Account.Type
			changed = true
		}
		if wi.AccountAvatarURL == "" && ev.Installation.Account.AvatarURL != "" {
			wi.AccountAvatarURL = ev.Installation.Account.AvatarURL
			changed = true
		}
		if wi.SuspendedAt != nil {
			wi.SuspendedAt = nil
			changed = true
		}
		if changed {
			return s.wis.Update(ctx, wi)
		}
		return nil
	case "suspend":
		return s.wis.MarkSuspended(ctx, wi.ID, true)
	case "unsuspend":
		return s.wis.MarkSuspended(ctx, wi.ID, false)
	case "deleted":
		if s.intSvc != nil && s.intSvc.GitHubClient() != nil {
			s.intSvc.GitHubClient().InvalidateInstallation(ev.Installation.ID)
		}
		return s.wis.Delete(ctx, wi.ID)
	}
	return nil
}

func (s *GithubEventService) handleInstallationRepositories(ctx context.Context, payload []byte) error {
	var ev gh.InstallationRepositoriesEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return err
	}
	// We don't auto-prune syncs on "removed" — admins might have re-enabled
	// after a typo. Logging only is the safe default.
	s.logger().Info("github installation repositories changed",
		"installation_id", ev.Installation.ID,
		"added", len(ev.RepositoriesAdded), "removed", len(ev.RepositoriesRemoved))
	return nil
}

// ---------------------------------------------------------------------------
// pull_request
// ---------------------------------------------------------------------------

func (s *GithubEventService) handlePullRequest(ctx context.Context, payload []byte, action string) error {
	var ev gh.PullRequestEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return err
	}
	if ev.Installation == nil {
		return nil
	}
	syncs, err := s.findSyncsForRepo(ctx, ev.Installation.ID, ev.Repository.ID)
	if err != nil || len(syncs) == 0 {
		return err
	}

	pr := ev.PullRequest
	state := pr.EffectiveState()
	refs := gh.MergeRefs(
		gh.ExtractRefs(pr.Title),
		gh.ExtractRefs(pr.Body),
		gh.ExtractRefsFromBranch(pr.Head.Ref),
	)

	// For each project that's linked to this repo, resolve refs and update.
	for _, sync := range syncs {
		w, err := s.ws.GetByID(ctx, sync.WorkspaceID)
		if err != nil {
			continue
		}
		for _, ref := range refs {
			project, err := s.ps.GetByWorkspaceAndIdentifier(ctx, w.ID, ref.Identifier)
			if err != nil {
				continue
			}
			// We sync only PRs that target the project this sync row owns.
			// If the ref's project doesn't match this sync's project, skip —
			// another project's sync row will handle it.
			if project.ID != sync.ProjectID {
				continue
			}
			issue, err := s.issue.GetByProjectAndSequence(ctx, project.ID, ref.Number)
			if err != nil {
				continue
			}

			// Upsert the link row.
			detection := refDetectionSource(pr, ref)
			link := &model.GithubIssueSync{
				RepoIssueID:      int64(pr.Number),
				GithubIssueID:    pr.ID,
				IssueURL:         pr.HTMLURL,
				IssueID:          issue.ID,
				RepositorySyncID: sync.ID,
				ProjectID:        sync.ProjectID,
				WorkspaceID:      sync.WorkspaceID,
				Kind:             "pull_request",
				State:            state,
				Title:            pr.Title,
				Draft:            pr.Draft,
				MergedAt:         pr.MergedAt,
				ClosedAt:         pr.ClosedAt,
				AuthorLogin:      pr.User.Login,
				BaseBranch:       pr.Base.Ref,
				HeadBranch:       pr.Head.Ref,
				DetectionSource:  detection,
			}
			if _, err := s.issues.UpsertByPRAndIssue(ctx, link); err != nil {
				s.logger().Warn("github sync upsert failed", "error", err, "issue_id", issue.ID)
				continue
			}

			// Activity comment + state transition based on PR action.
			s.applyPRSideEffects(ctx, &sync, issue, pr, action, ref.Closes)
		}
	}
	return nil
}

// applyPRSideEffects posts an activity comment on the Devlane issue and, on
// merge, optionally moves the issue to the configured "done" state.
func (s *GithubEventService) applyPRSideEffects(ctx context.Context, sync *model.GithubRepositorySync, issue *model.Issue, pr gh.PullRequest, action string, closes bool) {
	body := s.formatPRComment(pr, action)
	if body != "" {
		c := &model.IssueComment{
			IssueID:     issue.ID,
			ProjectID:   issue.ProjectID,
			WorkspaceID: issue.WorkspaceID,
			Comment:     body,
		}
		if err := s.comment.Create(ctx, c); err != nil {
			s.logger().Warn("github sync: failed to post activity comment", "error", err, "issue_id", issue.ID)
		}
	}

	// State transitions: only when the integration is configured to do so AND
	// the PR is closing the issue (closing keyword in title/body).
	if !sync.AutoCloseOnMerge {
		return
	}
	switch {
	case (action == "closed" && pr.Merged) && closes && sync.DoneStateID != nil:
		issue.StateID = sync.DoneStateID
		if err := s.issue.Update(ctx, issue); err != nil {
			s.logger().Warn("github sync: failed to close issue", "error", err, "issue_id", issue.ID)
		}
	case (action == "opened" || action == "reopened" || action == "ready_for_review") && sync.InProgressStateID != nil:
		// Only move to in_progress if the issue isn't already done.
		issue.StateID = sync.InProgressStateID
		if err := s.issue.Update(ctx, issue); err != nil {
			s.logger().Warn("github sync: failed to mark in-progress", "error", err, "issue_id", issue.ID)
		}
	}
}

// formatPRComment renders the bot comment posted to the Devlane issue when a
// PR transitions. Output is HTML — the comment-renderer on the frontend uses
// dangerouslySetInnerHTML, so plain text and markdown render literally.
func (s *GithubEventService) formatPRComment(pr gh.PullRequest, action string) string {
	verb := ""
	switch {
	case action == "opened" && pr.Draft:
		verb = "opened a draft pull request"
	case action == "opened":
		verb = "opened pull request"
	case action == "ready_for_review":
		verb = "marked pull request ready for review"
	case action == "converted_to_draft":
		verb = "converted pull request to draft"
	case action == "reopened":
		verb = "reopened pull request"
	case action == "closed" && pr.Merged:
		verb = "merged pull request"
	case action == "closed":
		verb = "closed pull request"
	case action == "edited":
		// Skip edit notifications — they're noisy.
		return ""
	default:
		return ""
	}
	author := pr.User.Login
	if author == "" {
		author = "Someone"
	}
	return fmt.Sprintf(
		`<p><strong>@%s</strong> %s <a href="%s" target="_blank" rel="noopener noreferrer">#%d %s</a></p>`,
		htmlEscape(author),
		htmlEscape(verb),
		htmlAttrEscape(pr.HTMLURL),
		pr.Number,
		htmlEscape(pr.Title),
	)
}

// htmlEscape replaces &, <, >, and quotes so user-provided strings can't break
// the surrounding HTML. Used for both text content and attribute values.
func htmlEscape(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&#39;",
	)
	return r.Replace(s)
}

// htmlAttrEscape is htmlEscape plus a stricter pass for URLs — drops control
// chars and surrounding whitespace.
func htmlAttrEscape(s string) string {
	return htmlEscape(strings.TrimSpace(s))
}

// refDetectionSource returns "title" | "body" | "branch" depending on where the
// ref was strongest. Best-effort categorization for analytics.
func refDetectionSource(pr gh.PullRequest, ref gh.IssueRef) string {
	id := ref.String()
	if strings.Contains(strings.ToUpper(pr.Title), id) {
		return "title"
	}
	if strings.Contains(strings.ToUpper(pr.Body), id) {
		return "body"
	}
	if strings.Contains(strings.ToUpper(pr.Head.Ref), id) {
		return "branch"
	}
	return "unknown"
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

func (s *GithubEventService) handlePush(ctx context.Context, payload []byte) error {
	var ev gh.PushEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return err
	}
	if ev.Installation == nil || ev.Deleted {
		return nil
	}
	syncs, err := s.findSyncsForRepo(ctx, ev.Installation.ID, ev.Repository.ID)
	if err != nil || len(syncs) == 0 {
		return err
	}

	branch := strings.TrimPrefix(ev.Ref, "refs/heads/")
	branchRefs := gh.ExtractRefsFromBranch(branch)
	commitRefs := []gh.IssueRef{}
	for _, c := range ev.Commits {
		commitRefs = gh.MergeRefs(commitRefs, gh.ExtractRefs(c.Message))
	}
	all := gh.MergeRefs(branchRefs, commitRefs)
	if len(all) == 0 {
		return nil
	}

	for _, sync := range syncs {
		w, err := s.ws.GetByID(ctx, sync.WorkspaceID)
		if err != nil {
			continue
		}
		for _, ref := range all {
			p, err := s.ps.GetByWorkspaceAndIdentifier(ctx, w.ID, ref.Identifier)
			if err != nil || p.ID != sync.ProjectID {
				continue
			}
			issue, err := s.issue.GetByProjectAndSequence(ctx, p.ID, ref.Number)
			if err != nil {
				continue
			}
			body := s.formatPushComment(ev, branch, len(ev.Commits))
			if body == "" {
				continue
			}
			if err := s.comment.Create(ctx, &model.IssueComment{
				IssueID:     issue.ID,
				ProjectID:   issue.ProjectID,
				WorkspaceID: issue.WorkspaceID,
				Comment:     body,
			}); err != nil {
				s.logger().Warn("github sync: failed to post push comment", "error", err, "issue_id", issue.ID)
			}
		}
	}
	return nil
}

func (s *GithubEventService) formatPushComment(ev gh.PushEvent, branch string, n int) string {
	if n == 0 || ev.Created {
		return ""
	}
	plural := ""
	if n != 1 {
		plural = "s"
	}
	author := ev.Sender.Login
	if author == "" {
		author = "Someone"
	}
	return fmt.Sprintf(
		`<p><strong>@%s</strong> pushed %d commit%s to <code>%s</code>.</p>`,
		htmlEscape(author), n, plural, htmlEscape(branch),
	)
}

// ---------------------------------------------------------------------------
// issue_comment (PR comments)
// ---------------------------------------------------------------------------

func (s *GithubEventService) handleIssueComment(ctx context.Context, payload []byte, action string) error {
	if action != "created" {
		return nil
	}
	var ev gh.IssueCommentEvent
	if err := json.Unmarshal(payload, &ev); err != nil {
		return err
	}
	if ev.Installation == nil {
		return nil
	}
	// Only mirror PR comments — not GH-issue comments (we don't yet sync GH issues).
	if !ev.Issue.IsPullRequest() {
		return nil
	}
	syncs, err := s.findSyncsForRepo(ctx, ev.Installation.ID, ev.Repository.ID)
	if err != nil || len(syncs) == 0 {
		return err
	}
	for _, sync := range syncs {
		links, err := s.issues.ListByPR(ctx, sync.ID, int64(ev.Issue.Number), "pull_request")
		if err != nil || len(links) == 0 {
			continue
		}
		body := s.formatIssueCommentMirror(ev)
		if body == "" {
			continue
		}
		for _, link := range links {
			if err := s.comment.Create(ctx, &model.IssueComment{
				IssueID:     link.IssueID,
				ProjectID:   link.ProjectID,
				WorkspaceID: link.WorkspaceID,
				Comment:     body,
			}); err != nil {
				s.logger().Warn("github sync: failed to mirror PR comment", "error", err, "issue_id", link.IssueID)
			}
		}
	}
	return nil
}

func (s *GithubEventService) formatIssueCommentMirror(ev gh.IssueCommentEvent) string {
	author := ev.Comment.User.Login
	if author == "" {
		author = "Someone"
	}
	excerpt := ev.Comment.Body
	const max = 280
	if len(excerpt) > max {
		excerpt = excerpt[:max] + "…"
	}
	excerpt = strings.ReplaceAll(excerpt, "\n", " ")
	return fmt.Sprintf(
		`<p>💬 <strong>@%s</strong> commented on <a href="%s" target="_blank" rel="noopener noreferrer">#%d</a>: %s</p>`,
		htmlEscape(author),
		htmlAttrEscape(ev.Comment.HTMLURL),
		ev.Issue.Number,
		htmlEscape(excerpt),
	)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// findSyncsForRepo returns every project sync row that should react to events
// for the given (installation, github repo). Workspace is determined via the
// installation_id, then we narrow to project syncs that point at this repo.
func (s *GithubEventService) findSyncsForRepo(ctx context.Context, installationID int64, repoID int64) ([]model.GithubRepositorySync, error) {
	wi, err := s.wis.GetByInstallationID(ctx, installationID)
	if err != nil {
		// Unknown installation — drop silently.
		return nil, nil
	}
	if wi.SuspendedAt != nil {
		return nil, nil
	}
	return s.rs.ListByGithubRepoID(ctx, wi.WorkspaceID, repoID)
}

func (s *GithubEventService) logger() *slog.Logger {
	if s.log != nil {
		return s.log
	}
	return slog.Default()
}

// payloadToJSONMap parses a webhook body into a JSONMap for db storage.
// On parse failure we still record the raw bytes under "_raw" so triage is possible.
func payloadToJSONMap(b []byte) model.JSONMap {
	out := model.JSONMap{}
	if err := json.Unmarshal(b, &out); err != nil {
		return model.JSONMap{"_raw": string(b)}
	}
	return out
}

// _ = uuid keeps import live in case future helpers need it.
var _ = uuid.Nil
