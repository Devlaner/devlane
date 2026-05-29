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
	is    *store.IssueStore
	ps    *store.ProjectStore
	ws    *store.WorkspaceStore
	minio *minio.Client
}

func NewAttachmentService(is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore, m *minio.Client) *AttachmentService {
	return &AttachmentService{is: is, ps: ps, ws: ws, minio: m}
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
	return nil
}

// InitiateUpload creates the DB records and returns the presigned upload URL + attachment shape.
func (s *AttachmentService) InitiateUpload(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name string, size float64, contentType string) (*PresignedUploadResponse, error) {
	if s.minio == nil {
		return nil, errors.New("file storage is not configured")
	}
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
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
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
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
	return s.is.MarkFileAssetUploaded(ctx, assetID, asset.Asset)
}

// ListAttachments returns uploaded attachments for an issue.
func (s *AttachmentService) ListAttachments(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]AttachmentResponse, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
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
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
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
	return nil
}
