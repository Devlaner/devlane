package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Devlaner/devlane/api/internal/minio"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrAttachmentNotFound = errors.New("attachment not found")

// AttachmentResponse is what the frontend expects for TIssueAttachment.
type AttachmentResponse struct {
	ID         uuid.UUID              `json:"id"`
	AssetID    uuid.UUID              `json:"asset_id"`
	Attributes map[string]interface{} `json:"attributes"`
	AssetURL   string                 `json:"asset_url"`
	IssueID    uuid.UUID              `json:"issue_id"`
	UpdatedAt  time.Time              `json:"updated_at"`
	UpdatedBy  string                 `json:"updated_by"`
	CreatedBy  string                 `json:"created_by"`
}

// PresignedUploadResponse matches TIssueAttachmentUploadResponse.
type PresignedUploadResponse struct {
	AssetID    uuid.UUID          `json:"asset_id"`
	AssetURL   string             `json:"asset_url"`
	UploadData UploadData         `json:"upload_data"`
	Attachment AttachmentResponse `json:"attachment"`
}

// UploadData holds the URL and fields for the direct browser upload.
type UploadData struct {
	URL    string            `json:"url"`
	Fields map[string]string `json:"fields"`
}

// AttachmentService handles file attachment business logic.
type AttachmentService struct {
	is       *store.IssueStore
	ps       *store.ProjectStore
	ws       *store.WorkspaceStore
	minio    *minio.Client
	activity *store.IssueActivityStore // optional — records attachment add/delete on the issue
}

func NewAttachmentService(is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore, m *minio.Client) *AttachmentService {
	return &AttachmentService{is: is, ps: ps, ws: ws, minio: m}
}

// SetActivityStore wires the issue-activity store so attachment add/delete show
// up in the work-item history. Optional.
func (s *AttachmentService) SetActivityStore(a *store.IssueActivityStore) { s.activity = a }

// assetName is the human-readable file name stored on a file asset, or "" when
// absent.
func assetName(a *model.FileAsset) string {
	if a == nil || a.Attributes == nil {
		return ""
	}
	name, _ := a.Attributes["name"].(string)
	return name
}

func (s *AttachmentService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) error {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, wrk.ID, projectID, userID); err != nil {
		return err
	}
	return nil
}

// ensureIssueAccess validates workspace membership + project-in-workspace AND
// that the target issue actually belongs to the URL project. Without the issue
// check, any workspace member could read/modify attachments on an issue from a
// different project/workspace by supplying that issue's id.
func (s *AttachmentService) ensureIssueAccess(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) error {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue == nil || issue.ProjectID != projectID {
		return ErrAttachmentNotFound
	}
	return nil
}

// AuthorizeDownload checks that userID may fetch the attachment identified by an
// object path "attachments/<issueID>/<assetID>". It resolves the attachment
// record (404 if missing) and requires the caller to be a member of the
// attachment's workspace, so a leaked object URL can't be fetched by outsiders.
func (s *AttachmentService) AuthorizeDownload(ctx context.Context, issueID, assetID, userID uuid.UUID) error {
	att, err := s.is.GetAttachmentByAssetID(ctx, assetID, issueID)
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && att == nil) {
		return ErrAttachmentNotFound
	}
	if err != nil {
		return err // a real datastore failure — surface it as 5xx, not a 404
	}
	ok, err := s.ws.IsMember(ctx, att.WorkspaceID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrProjectForbidden
	}
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, att.WorkspaceID, att.ProjectID, userID); err != nil {
		return err
	}
	return nil
}

// InitiateUpload creates the DB records and returns the presigned upload URL + attachment shape.
func (s *AttachmentService) InitiateUpload(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name string, size float64, contentType string) (*PresignedUploadResponse, error) {
	if s.minio == nil {
		return nil, errors.New("file storage is not configured")
	}
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectForbidden
	}

	assetID := uuid.New()
	objectName := fmt.Sprintf("attachments/%s/%s", issueID.String(), assetID.String())

	asset := &model.FileAsset{
		ID:          assetID,
		Asset:       objectName,
		Attributes:  model.JSONMap{"name": name, "size": size},
		Size:        size,
		IsUploaded:  false,
		WorkspaceID: &wrk.ID,
		ProjectID:   &projectID,
		IssueID:     &issueID,
		CreatedByID: &userID,
	}
	if err := s.is.CreateFileAsset(ctx, asset); err != nil {
		return nil, err
	}

	attachment := &model.IssueAttachment{
		IssueID:     issueID,
		AssetID:     assetID,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		CreatedByID: &userID,
	}
	if err := s.is.CreateAttachment(ctx, attachment); err != nil {
		return nil, err
	}

	uploadURL, fields, err := s.minio.PresignedPostFields(ctx, objectName, contentType, 50<<20, 30*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("presign: %w", err)
	}

	resp := &PresignedUploadResponse{
		AssetID:  assetID,
		AssetURL: "/api/files/" + objectName,
		UploadData: UploadData{
			URL:    uploadURL,
			Fields: fields,
		},
		Attachment: AttachmentResponse{
			ID:         attachment.ID,
			AssetID:    assetID,
			Attributes: map[string]interface{}{"name": name, "size": size},
			AssetURL:   "/api/files/" + objectName,
			IssueID:    issueID,
			UpdatedAt:  attachment.CreatedAt,
			UpdatedBy:  userID.String(),
			CreatedBy:  userID.String(),
		},
	}
	return resp, nil
}

// ConfirmUpload marks the file asset as uploaded (PATCH step).
func (s *AttachmentService) ConfirmUpload(ctx context.Context, workspaceSlug string, projectID, issueID, assetID uuid.UUID, userID uuid.UUID) error {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	asset, err := s.is.GetFileAssetByID(ctx, assetID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrAttachmentNotFound
		}
		return err
	}
	if asset.IssueID == nil || *asset.IssueID != issueID {
		return ErrAttachmentNotFound
	}
	if err := s.is.MarkFileAssetUploaded(ctx, assetID, asset.Asset); err != nil {
		return err
	}
	if issue, err := s.is.GetByID(ctx, issueID); err == nil {
		recordIssueActivity(ctx, s.activity, issue, userID, "attachment_added", "", assetName(asset))
	}
	return nil
}

// ListAttachments returns uploaded attachments for an issue.
func (s *AttachmentService) ListAttachments(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]AttachmentResponse, error) {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	attachments, assets, err := s.is.ListAttachmentsWithAssets(ctx, issueID)
	if err != nil {
		return nil, err
	}
	assetMap := make(map[uuid.UUID]model.FileAsset, len(assets))
	for _, a := range assets {
		assetMap[a.ID] = a
	}
	result := make([]AttachmentResponse, 0, len(attachments))
	for _, att := range attachments {
		asset, ok := assetMap[att.AssetID]
		if !ok {
			continue
		}
		createdBy := ""
		if att.CreatedByID != nil {
			createdBy = att.CreatedByID.String()
		}
		result = append(result, AttachmentResponse{
			ID:         att.ID,
			AssetID:    att.AssetID,
			Attributes: map[string]interface{}{"name": asset.Attributes["name"], "size": asset.Size},
			AssetURL:   "/api/files/" + asset.Asset,
			IssueID:    issueID,
			UpdatedAt:  att.UpdatedAt,
			UpdatedBy:  createdBy,
			CreatedBy:  createdBy,
		})
	}
	return result, nil
}

// DeleteAttachment removes an attachment and its file asset.
func (s *AttachmentService) DeleteAttachment(ctx context.Context, workspaceSlug string, projectID, issueID, assetID uuid.UUID, userID uuid.UUID) error {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	asset, err := s.is.GetFileAssetByID(ctx, assetID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrAttachmentNotFound
		}
		return err
	}
	if asset.IssueID == nil || *asset.IssueID != issueID {
		return ErrAttachmentNotFound
	}
	if err := s.is.SoftDeleteAttachment(ctx, assetID, issueID); err != nil {
		return err
	}
	if err := s.is.SoftDeleteFileAsset(ctx, assetID); err != nil {
		return err
	}
	if s.minio != nil && asset.IsUploaded && asset.Asset != "" {
		_ = s.minio.DeleteObject(ctx, asset.Asset)
	}
	if issue, err := s.is.GetByID(ctx, issueID); err == nil {
		recordIssueActivity(ctx, s.activity, issue, userID, "attachment_removed", assetName(asset), "")
	}
	return nil
}
