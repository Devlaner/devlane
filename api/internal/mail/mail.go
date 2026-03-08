package mail

import (
	"context"
	"fmt"
	"log/slog"
	"net/smtp"
	"strconv"
	"strings"

	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/store"
)

// smtpSettings from instance "email" section (after decrypting password).
type smtpSettings struct {
	Host        string
	Port        int
	SenderEmail string
	Security    string
	Username    string
	Password    string
}

func getEmailSettings(ctx context.Context, s *store.InstanceSettingStore) (*smtpSettings, error) {
	row, err := s.Get(ctx, "email")
	if err != nil || row == nil {
		return nil, fmt.Errorf("email settings not found")
	}
	v := row.Value
	if v == nil {
		return nil, fmt.Errorf("email settings empty")
	}
	host, _ := v["host"].(string)
	port := 587
	if p, ok := v["port"].(string); ok && p != "" {
		if n, err := strconv.Atoi(p); err == nil {
			port = n
		}
	}
	if p, ok := v["port"].(float64); ok {
		port = int(p)
	}
	sender, _ := v["sender_email"].(string)
	security, _ := v["security"].(string)
	username, _ := v["username"].(string)
	passRaw, _ := v["password"].(string)
	password := crypto.DecryptOrPlain(passRaw)
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("email host not configured")
	}
	return &smtpSettings{
		Host:        host,
		Port:        port,
		SenderEmail: strings.TrimSpace(sender),
		Security:    strings.TrimSpace(security),
		Username:    strings.TrimSpace(username),
		Password:    password,
	}, nil
}

// NewSMTPEmailSender returns a sender function that loads SMTP config from instance
// "email" settings and sends the email. If email is not configured or sending fails,
// it logs and returns an error.
func NewSMTPEmailSender(instanceSettings *store.InstanceSettingStore, log *slog.Logger) func(ctx context.Context, to, subject, body string) error {
	return func(ctx context.Context, to, subject, body string) error {
		cfg, err := getEmailSettings(ctx, instanceSettings)
		if err != nil {
			if log != nil {
				log.Warn("mail skip: instance email not configured", "to", to, "error", err)
			}
			return err
		}
		from := cfg.SenderEmail
		if from == "" {
			from = cfg.Username
		}
		if from == "" {
			if log != nil {
				log.Warn("mail skip: sender_email and username empty", "to", to)
			}
			return fmt.Errorf("sender email not configured")
		}
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
		msg := buildMessage(to, from, subject, body)
		if err := smtp.SendMail(addr, auth, from, []string{to}, msg); err != nil {
			if log != nil {
				log.Warn("mail send failed", "to", to, "error", err)
			}
			return err
		}
		if log != nil {
			log.Info("mail sent", "to", to, "subject", subject)
		}
		return nil
	}
}

func buildMessage(to, from, subject, body string) []byte {
	const crlf = "\r\n"
	h := "To: " + to + crlf +
		"From: " + from + crlf +
		"Subject: " + subject + crlf +
		"Content-Type: text/plain; charset=UTF-8" + crlf +
		"MIME-Version: 1.0" + crlf +
		crlf
	return []byte(h + body)
}
