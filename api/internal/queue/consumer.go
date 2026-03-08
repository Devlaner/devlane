package queue

import (
	"context"
	"encoding/json"
	"log/slog"

	amqp "github.com/rabbitmq/amqp091-go"
)

// TaskHandler is called for each consumed message. Return nil to ack; non-nil to nack/requeue.
type TaskHandler func(ctx context.Context, queue string, body []byte) error

// Consumer consumes from RabbitMQ queues and dispatches to handlers.
type Consumer struct {
	ch       *amqp.Channel
	log      *slog.Logger
	handlers map[string]TaskHandler
}

// NewConsumer returns a consumer. Handlers are registered per queue.
func NewConsumer(ch *amqp.Channel, log *slog.Logger) *Consumer {
	return &Consumer{ch: ch, log: log, handlers: make(map[string]TaskHandler)}
}

// Register adds a handler for a queue.
func (c *Consumer) Register(queue string, h TaskHandler) {
	c.handlers[queue] = h
}

// Run consumes from the given queues and runs until ctx is cancelled.
func (c *Consumer) Run(ctx context.Context, queues []string) error {
	for _, q := range queues {
		deliveries, err := c.ch.Consume(q, "", false, false, false, false, nil)
		if err != nil {
			return err
		}
		handler := c.handlers[q]
		if handler == nil {
			handler = c.defaultHandler
		}
		q := q
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case d, ok := <-deliveries:
					if !ok {
						return
					}
					c.handle(ctx, q, d, handler)
				}
			}
		}()
	}
	return nil
}

func (c *Consumer) handle(ctx context.Context, queue string, d amqp.Delivery, h TaskHandler) {
	err := h(ctx, queue, d.Body)
	if err != nil {
		if c.log != nil {
			c.log.Warn("task failed", "queue", queue, "error", err)
		}
		_ = d.Nack(false, true)
		return
	}
	_ = d.Ack(false)
}

func (c *Consumer) defaultHandler(ctx context.Context, queue string, body []byte) error {
	if c.log != nil {
		c.log.Debug("unhandled task", "queue", queue, "body", string(body))
	}
	return nil
}

// --- Handlers for email and webhook (can be extended with real SMTP/HTTP) ---

// HandleSendEmail parses send_email task and runs the given sender.
func HandleSendEmail(sender func(ctx context.Context, to, subject, body string) error) TaskHandler {
	return func(ctx context.Context, queue string, body []byte) error {
		var msg struct {
			Type    string           `json:"type"`
			Payload SendEmailPayload `json:"payload"`
		}
		if err := json.Unmarshal(body, &msg); err != nil {
			return err
		}
		if msg.Type != TaskSendEmail {
			return nil
		}
		return sender(ctx, msg.Payload.To, msg.Payload.Subject, msg.Payload.Body)
	}
}

// HandleWebhook parses webhook_deliver task and runs the given deliverer.
func HandleWebhook(deliverer func(ctx context.Context, url, secret, event string, payload map[string]interface{}) error) TaskHandler {
	return func(ctx context.Context, queue string, body []byte) error {
		var msg struct {
			Type    string         `json:"type"`
			Payload WebhookPayload `json:"payload"`
		}
		if err := json.Unmarshal(body, &msg); err != nil {
			return err
		}
		if msg.Type != TaskWebhookDeliver {
			return nil
		}
		return deliverer(ctx, msg.Payload.URL, msg.Payload.Secret, msg.Payload.Event, msg.Payload.Payload)
	}
}

// NoopEmailSender is a no-op sender (log only). Replace with real SMTP in production.
func NoopEmailSender(log *slog.Logger) func(ctx context.Context, to, subject, body string) error {
	return func(ctx context.Context, to, subject, body string) error {
		if log != nil {
			log.Info("email would be sent", "to", to, "subject", subject)
		}
		return nil
	}
}

// NoopWebhookDeliverer is a no-op deliverer (log only). Replace with real HTTP POST in production.
func NoopWebhookDeliverer(log *slog.Logger) func(ctx context.Context, url, secret, event string, payload map[string]interface{}) error {
	return func(ctx context.Context, url, secret, event string, payload map[string]interface{}) error {
		if log != nil {
			log.Info("webhook would be delivered", "url", url, "event", event)
		}
		_ = secret
		_ = payload
		return nil
	}
}
