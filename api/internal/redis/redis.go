package redis

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/redis/go-redis/v9"
)

// Client wraps go-redis client.
type Client struct {
	*redis.Client
}

// New creates a Redis client from config.
func New(cfg *config.Config, log *slog.Logger) (*Client, error) {
	opt := &redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	}

	client := redis.NewClient(opt)

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	if log != nil {
		log.Info("redis connected", "addr", cfg.RedisAddr)
	}

	return &Client{Client: client}, nil
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	return c.Client.Close()
}
