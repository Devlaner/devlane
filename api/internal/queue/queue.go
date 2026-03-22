package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Queue names (one queue per task type or shared).
const (
	QueueEmails   = "devlane.emails"
	QueueWebhooks = "devlane.webhooks"
	QueueDefault  = "devlane.default"
)

// Task types for routing or payload identification.
const (
	TaskSendEmail      = "send_email"
	TaskWebhookDeliver = "webhook_deliver"
)

// SendEmailPayload is the payload for send_email task.
type SendEmailPayload struct {
	To        string            `json:"to"`
	Subject   string            `json:"subject"`
	Body      string            `json:"body"`
	Kind      string            `json:"kind"`                 // e.g. forgot_password, workspace_invite, project_invite
	InviteURL string            `json:"invite_url,omitempty"` // optional; logged for debugging (e.g. workspace invite link)
	Extra     map[string]string `json:"extra,omitempty"`
}

// WebhookPayload is the payload for webhook_deliver task.
type WebhookPayload struct {
	URL     string                 `json:"url"`
	Secret  string                 `json:"secret,omitempty"`
	Event   string                 `json:"event"`
	Payload map[string]interface{} `json:"payload"`
}

// Publisher publishes tasks to RabbitMQ.
type Publisher struct {
	ch     *amqp.Channel
	log    *slog.Logger
	queues map[string]bool
}

// NewPublisher declares queues and returns a publisher.
func NewPublisher(ch *amqp.Channel, log *slog.Logger) (*Publisher, error) {
	for _, q := range []string{QueueEmails, QueueWebhooks, QueueDefault} {
		if _, err := ch.QueueDeclare(q, true, false, false, false, nil); err != nil {
			return nil, fmt.Errorf("declare queue %s: %w", q, err)
		}
	}
	return &Publisher{ch: ch, log: log, queues: map[string]bool{
		QueueEmails: true, QueueWebhooks: true, QueueDefault: true,
	}}, nil
}

// PublishJSON publishes a JSON body to the given queue.
func (p *Publisher) PublishJSON(ctx context.Context, queue string, body interface{}) error {
	if !p.queues[queue] {
		return fmt.Errorf("unknown queue: %s", queue)
	}
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return p.ch.PublishWithContext(ctx, "", queue, false, false, amqp.Publishing{
		DeliveryMode: amqp.Persistent,
		ContentType:  "application/json",
		Body:         data,
		Timestamp:    time.Now(),
	})
}

// PublishSendEmail enqueues a send_email task.
func (p *Publisher) PublishSendEmail(ctx context.Context, payload SendEmailPayload) error {
	if p.log != nil {
		p.log.Debug("queue publish send_email", "to", payload.To, "kind", payload.Kind)
	}
	return p.PublishJSON(ctx, QueueEmails, map[string]interface{}{
		"type":    TaskSendEmail,
		"payload": payload,
	})
}

// PublishWebhook enqueues a webhook_deliver task.
func (p *Publisher) PublishWebhook(ctx context.Context, payload WebhookPayload) error {
	if p.log != nil {
		p.log.Debug("queue publish webhook", "url", payload.URL, "event", payload.Event)
	}
	return p.PublishJSON(ctx, QueueWebhooks, map[string]interface{}{
		"type":    TaskWebhookDeliver,
		"payload": payload,
	})
}
