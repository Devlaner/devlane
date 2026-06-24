package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueReaction matches table "issue_reactions". Unique on (issue_id,
// reaction, actor_id) so each user can drop one of each emoji per issue.
type IssueReaction struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID     uuid.UUID `gorm:"column:issue_id;type:uuid;not null" json:"issue_id"`
	Reaction    string    `gorm:"type:varchar(50);not null" json:"reaction"`
	ActorID     uuid.UUID `gorm:"column:actor_id;type:uuid;not null" json:"actor_id"`
	ProjectID   uuid.UUID `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

func (IssueReaction) TableName() string { return "issue_reactions" }

func (r *IssueReaction) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
