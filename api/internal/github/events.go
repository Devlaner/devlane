package github

import "time"

// Event header values we care about.
const (
	EventPing                    = "ping"
	EventPullRequest             = "pull_request"
	EventPullRequestReview       = "pull_request_review"
	EventIssueComment            = "issue_comment"
	EventPush                    = "push"
	EventInstallation            = "installation"
	EventInstallationRepositories = "installation_repositories"
)

// EventEnvelope captures the fields common to all events we handle (action +
// installation + repository). The full payload still arrives as a JSON map for
// per-event decoding.
type EventEnvelope struct {
	Action       string             `json:"action,omitempty"`
	Installation *InstallationLite  `json:"installation,omitempty"`
	Repository   *RepositoryLite    `json:"repository,omitempty"`
	Sender       *AccountLite       `json:"sender,omitempty"`
}

// InstallationLite is the embedded {"installation": {...}} on every event.
type InstallationLite struct {
	ID      int64       `json:"id"`
	Account AccountLite `json:"account"`
}

// AccountLite is the GitHub user/org that owns the installation.
type AccountLite struct {
	Login     string `json:"login"`
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	AvatarURL string `json:"avatar_url"`
}

// RepositoryLite is the {"repository": {...}} on most events.
type RepositoryLite struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	HTMLURL  string `json:"html_url"`
	Owner    struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
	} `json:"owner"`
}

// PullRequestEvent is the payload for the "pull_request" webhook event.
// Action values we react to: opened, edited, closed, reopened, ready_for_review,
// converted_to_draft, synchronize.
type PullRequestEvent struct {
	Action       string            `json:"action"`
	Number       int               `json:"number"`
	PullRequest  PullRequest       `json:"pull_request"`
	Repository   RepositoryLite    `json:"repository"`
	Installation *InstallationLite `json:"installation,omitempty"`
	Sender       AccountLite       `json:"sender"`
}

// PullRequest is the trimmed representation we use.
type PullRequest struct {
	ID        int64      `json:"id"`
	NodeID    string     `json:"node_id"`
	Number    int        `json:"number"`
	State     string     `json:"state"` // "open" or "closed"
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	HTMLURL   string     `json:"html_url"`
	Draft     bool       `json:"draft"`
	Merged    bool       `json:"merged"`
	MergedAt  *time.Time `json:"merged_at"`
	ClosedAt  *time.Time `json:"closed_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	User      AccountLite `json:"user"`
	Head      Branch     `json:"head"`
	Base      Branch     `json:"base"`
}

// Branch is the head/base reference on a PR.
type Branch struct {
	Ref  string `json:"ref"`
	SHA  string `json:"sha"`
	Repo struct {
		FullName string `json:"full_name"`
	} `json:"repo"`
}

// EffectiveState returns "open" | "merged" | "closed".
func (p PullRequest) EffectiveState() string {
	if p.Merged {
		return "merged"
	}
	if p.State == "closed" {
		return "closed"
	}
	return "open"
}

// PushEvent is the payload for the "push" webhook event.
type PushEvent struct {
	Ref          string            `json:"ref"`     // "refs/heads/feature/dev-42-foo"
	Before       string            `json:"before"`
	After        string            `json:"after"`
	Created      bool              `json:"created"` // branch creation
	Deleted      bool              `json:"deleted"`
	Forced       bool              `json:"forced"`
	Commits      []PushCommit      `json:"commits"`
	HeadCommit   *PushCommit       `json:"head_commit,omitempty"`
	Repository   RepositoryLite    `json:"repository"`
	Installation *InstallationLite `json:"installation,omitempty"`
	Sender       AccountLite       `json:"sender"`
}

// PushCommit is a single commit in a push payload.
type PushCommit struct {
	ID      string `json:"id"`
	Message string `json:"message"`
	URL     string `json:"url"`
	Author  struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Username string `json:"username"`
	} `json:"author"`
	Timestamp time.Time `json:"timestamp"`
}

// IssueCommentEvent is the payload for the "issue_comment" event (comments on
// PRs come through this event because PRs are issues in GitHub's API).
type IssueCommentEvent struct {
	Action       string            `json:"action"`
	Issue        IssueLite         `json:"issue"`
	Comment      IssueComment      `json:"comment"`
	Repository   RepositoryLite    `json:"repository"`
	Installation *InstallationLite `json:"installation,omitempty"`
	Sender       AccountLite       `json:"sender"`
}

// IssueLite is the GitHub issue/PR stub on issue_comment events.
type IssueLite struct {
	ID          int64        `json:"id"`
	Number      int          `json:"number"`
	Title       string       `json:"title"`
	HTMLURL     string       `json:"html_url"`
	State       string       `json:"state"`
	PullRequest *struct{}    `json:"pull_request,omitempty"`
	User        AccountLite  `json:"user"`
}

// IsPullRequest is true when the issue is actually a pull request.
func (i IssueLite) IsPullRequest() bool { return i.PullRequest != nil }

// IssueComment is a GitHub issue/PR comment.
type IssueComment struct {
	ID      int64       `json:"id"`
	Body    string      `json:"body"`
	HTMLURL string      `json:"html_url"`
	User    AccountLite `json:"user"`
}

// InstallationEvent is the payload for the "installation" event.
// Action values: created, deleted, suspend, unsuspend, new_permissions_accepted.
type InstallationEvent struct {
	Action       string           `json:"action"`
	Installation InstallationLite `json:"installation"`
	Sender       AccountLite      `json:"sender"`
}

// InstallationRepositoriesEvent fires when an installation's accessible repos
// change (added or removed by the installer).
type InstallationRepositoriesEvent struct {
	Action              string           `json:"action"`
	Installation        InstallationLite `json:"installation"`
	RepositoriesAdded   []RepositoryLite `json:"repositories_added"`
	RepositoriesRemoved []RepositoryLite `json:"repositories_removed"`
	Sender              AccountLite      `json:"sender"`
}
