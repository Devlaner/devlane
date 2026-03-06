package rabbitmq

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/Devlaner/devlane/api/internal/config"
	amqp "github.com/rabbitmq/amqp091-go"
)

// Client wraps RabbitMQ connection and provides a channel pool or single channel.
type Client struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	mu      sync.Mutex
	cfg     *config.Config
	log     *slog.Logger
}

// New creates a RabbitMQ connection and a channel.
func New(cfg *config.Config, log *slog.Logger) (*Client, error) {
	conn, err := amqp.Dial(cfg.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("rabbitmq dial: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("rabbitmq channel: %w", err)
	}

	if log != nil {
		log.Info("rabbitmq connected", "url", cfg.RabbitMQURL)
	}

	return &Client{
		conn:    conn,
		channel: ch,
		cfg:     cfg,
		log:     log,
	}, nil
}

// Channel returns the shared channel (caller must not close it). Use for publishing.
func (c *Client) Channel() *amqp.Channel {
	return c.channel
}

// NewChannel returns a new channel from the same connection (e.g. for consumer). Caller must close it when done.
func (c *Client) NewChannel() (*amqp.Channel, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return nil, fmt.Errorf("rabbitmq connection closed")
	}
	return c.conn.Channel()
}

// Close closes the channel and connection.
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var err error
	if c.channel != nil {
		if e := c.channel.Close(); e != nil {
			err = e
		}
		c.channel = nil
	}
	if c.conn != nil {
		if e := c.conn.Close(); e != nil {
			if err == nil {
				err = e
			}
		}
		c.conn = nil
	}
	return err
}
