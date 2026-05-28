package minio

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"time"

	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/s3utils"
)

// Client wraps MinIO client.
type Client struct {
	*minio.Client
	bucket string
	useSSL bool
}

// New creates a MinIO client and ensures the bucket exists.
func New(cfg *config.Config, log *slog.Logger) (*Client, error) {
	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIOAccessKeyID, cfg.MinIOSecretAccessKey, ""),
		Secure: cfg.MinIOUseSSL,
	}

	client, err := minio.New(cfg.MinIOEndpoint, opts)
	if err != nil {
		return nil, fmt.Errorf("minio new: %w", err)
	}

	ctx := context.Background()
	exists, err := client.BucketExists(ctx, cfg.MinIOBucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket exists: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.MinIOBucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
		if log != nil {
			log.Info("minio bucket created", "bucket", cfg.MinIOBucket)
		}
	}

	if log != nil {
		log.Info("minio connected", "endpoint", cfg.MinIOEndpoint, "bucket", cfg.MinIOBucket)
	}

	return &Client{Client: client, bucket: cfg.MinIOBucket, useSSL: cfg.MinIOUseSSL}, nil
}

// Bucket returns the default bucket name.
func (c *Client) Bucket() string {
	return c.bucket
}

// PutObject uploads data to the default bucket.
func (c *Client) PutObject(ctx context.Context, objectName string, reader io.Reader, size int64, contentType string) error {
	_, err := c.Client.PutObject(ctx, c.bucket, objectName, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

// GetObject returns a reader for the object from the default bucket.
func (c *Client) GetObject(ctx context.Context, objectName string) (*minio.Object, error) {
	return c.Client.GetObject(ctx, c.bucket, objectName, minio.GetObjectOptions{})
}

// PresignedPostFields generates S3-compatible presigned POST policy fields for direct browser upload.
// Returns the upload URL and form fields to include in the multipart POST.
func (c *Client) PresignedPostFields(ctx context.Context, objectName, contentType string, maxSize int64, expiry time.Duration) (uploadURL string, fields map[string]string, err error) {
	policy := minio.NewPostPolicy()
	if err := policy.SetBucket(c.bucket); err != nil {
		return "", nil, err
	}
	if err := policy.SetKey(objectName); err != nil {
		return "", nil, err
	}
	if err := policy.SetExpires(time.Now().Add(expiry)); err != nil {
		return "", nil, err
	}
	if contentType != "" {
		if err := policy.SetContentType(contentType); err != nil {
			return "", nil, err
		}
	}
	if maxSize > 0 {
		if err := policy.SetContentLengthRange(1, maxSize); err != nil {
			return "", nil, err
		}
	}
	u, formFields, err := c.Client.PresignedPostPolicy(ctx, policy)
	if err != nil {
		return "", nil, err
	}
	return u.String(), formFields, nil
}

// DeleteObject removes an object from the default bucket.
func (c *Client) DeleteObject(ctx context.Context, objectName string) error {
	return c.Client.RemoveObject(ctx, c.bucket, objectName, minio.RemoveObjectOptions{})
}

// PublicURL returns the public-facing URL for an object.
// Falls back to the internal endpoint if no public URL is configured.
func (c *Client) PublicURL(objectName string) string {
	_ = s3utils.CheckValidObjectName(objectName) // no-op; just using the import
	scheme := "http"
	if c.useSSL {
		scheme = "https"
	}
	u := &url.URL{Scheme: scheme, Host: c.Client.EndpointURL().Host, Path: "/" + c.bucket + "/" + objectName}
	return u.String()
}
