package minio

import (
	"context"
	"fmt"
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
