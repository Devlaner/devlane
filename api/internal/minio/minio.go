package minio

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps MinIO client.
type Client struct {
	*minio.Client
	bucket string
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

	return &Client{Client: client, bucket: cfg.MinIOBucket}, nil
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
