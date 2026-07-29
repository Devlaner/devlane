package queue

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/mail"
	amqp "github.com/rabbitmq/amqp091-go"
)

// TaskHandler is called for each consumed message. Return nil to ack; non-nil triggers republish+ack with incremented x-retry-count (see handle).
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
		// Retries: republish with incremented x-retry-count, then Ack the original delivery.
		// (Nack(requeue=true) on handler failure would redeliver the same headers, so the count would never advance.)
		retryCount := int64(0)
		if d.Headers != nil {
			if v, ok := d.Headers["x-retry-count"]; ok {
				switch n := v.(type) {
				case int64:
					retryCount = n
				case int32:
					retryCount = int64(n)
				case int:
					retryCount = int64(n)
				}
			}
		}
		const maxRetries = 3
		if retryCount >= maxRetries {
			if c.log != nil {
				c.log.Error("task permanently failed, discarding", "queue", queue, "retries", retryCount, "error", err)
			}
			_ = d.Ack(false)
			return
		}
		if c.log != nil {
			c.log.Warn("task failed, retrying", "queue", queue, "retry", retryCount+1, "error", err)
		}
		headers := amqp.Table{"x-retry-count": retryCount + 1}
		pubErr := c.ch.PublishWithContext(ctx, "", queue, false, false, amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  d.ContentType,
			Body:         d.Body,
			Headers:      headers,
		})
		if pubErr != nil {
			if c.log != nil {
				c.log.Error("failed to republish for retry", "queue", queue, "error", pubErr)
			}
			if nackErr := d.Nack(false, true); nackErr != nil && c.log != nil {
				c.log.Error("nack after republish failure", "queue", queue, "error", nackErr)
			}
			return
		}
		_ = d.Ack(false)
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

// HandleSendEmail parses send_email task, logs attempt/result (including invite_url), and runs the given sender.
func HandleSendEmail(log *slog.Logger, sender func(ctx context.Context, to, subject, body string) error) TaskHandler {
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
		p := &msg.Payload
		mail.LogSendAttempt(log, p.To, p.Subject, p.Kind, p.InviteURL)
		err := sender(ctx, p.To, p.Subject, p.Body)
		if err != nil {
			mail.LogFailed(log, p.To, p.Subject, p.InviteURL, err)
			return err
		}
		mail.LogSent(log, p.To, p.Subject, p.InviteURL)
		return nil
	}
}

// HandleWebhook parses webhook_deliver task and runs the given deliverer.
func HandleWebhook(deliverer func(ctx context.Context, p WebhookPayload) error) TaskHandler {
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
		return deliverer(ctx, msg.Payload)
	}
}

// HandleSlackPost parses slack_post task and runs the given poster.
func HandleSlackPost(log *slog.Logger, poster func(ctx context.Context, token, channelID, text string, blocks interface{}) error) TaskHandler {
	return func(ctx context.Context, queue string, body []byte) error {
		var msg struct {
			Type    string           `json:"type"`
			Payload SlackPostPayload `json:"payload"`
		}
		if err := json.Unmarshal(body, &msg); err != nil {
			return err
		}
		if msg.Type != TaskSlackPost {
			return nil
		}
		p := &msg.Payload
		if log != nil {
			log.Info("queue processing slack_post", "channel", p.ChannelID)
		}
		err := poster(ctx, p.Token, p.ChannelID, p.Text, p.Blocks)
		if err != nil {
			if log != nil {
				log.Error("slack post failed", "channel", p.ChannelID, "error", err)
			}
			return err
		}
		if log != nil {
			log.Info("slack post succeeded", "channel", p.ChannelID)
		}
		return nil
	}
}

// HandleImport parses an import_run task and runs the given importer.
func HandleImport(runner func(ctx context.Context, importerID string) error) TaskHandler {
	return func(ctx context.Context, queue string, body []byte) error {
		var msg struct {
			Type    string        `json:"type"`
			Payload ImportPayload `json:"payload"`
		}
		if err := json.Unmarshal(body, &msg); err != nil {
			return err
		}
		if msg.Type != TaskImportRun {
			return nil
		}
		return runner(ctx, msg.Payload.ImporterID)
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

// NoopWebhookDeliverer is a no-op deliverer (log only). Used as a fallback when
// no real deliverer is wired.
func NoopWebhookDeliverer(log *slog.Logger) func(ctx context.Context, p WebhookPayload) error {
	return func(ctx context.Context, p WebhookPayload) error {
		if log != nil {
			log.Info("webhook would be delivered", "url", p.URL, "event", p.Event)
		}
		return nil
	}
}
