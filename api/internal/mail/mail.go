package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net/smtp"
	"strconv"
	"strings"

	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/store"
)

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
	if crypto.LooksEncrypted(passRaw) && password == "" {
		return nil, fmt.Errorf(
			"SMTP password cannot be decrypted: ensure INSTANCE_ENCRYPTION_KEY matches the key used when the password was saved, or open instance email settings and save the SMTP password again",
		)
	}
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

// NewSMTPEmailSender returns a sender that loads SMTP config from instance "email"
// settings and sends mail. If not configured or send fails, logs and returns error.
func NewSMTPEmailSender(instanceSettings *store.InstanceSettingStore, log *slog.Logger) func(ctx context.Context, to, subject, body string) error {
	return func(ctx context.Context, to, subject, body string) error {
		if instanceSettings == nil {
			LogSkip(log, "instance settings store is nil", to, fmt.Errorf("no settings store"))
			return fmt.Errorf("email not configured: no settings store")
		}
		cfg, err := getEmailSettings(ctx, instanceSettings)
		if err != nil {
			LogSkip(log, "instance email not configured", to, err)
			return err
		}
		from := cfg.SenderEmail
		if from == "" {
			from = cfg.Username
		}
		if from == "" {
			LogSkip(log, "sender_email and username empty", to, fmt.Errorf("sender not set"))
			return fmt.Errorf("sender email not configured")
		}
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
		msg := buildMessage(to, from, subject, body)
		if err := sendMailWithConfig(addr, cfg.Host, cfg.Port, cfg.Security, auth, from, to, msg); err != nil {
			return err
		}
		return nil
	}
}

// sendMailWithConfig sends email using smtp.SendMail or, for port 465 with SSL,
// an explicit TLS connection (smtp.SendMail only supports STARTTLS).
func sendMailWithConfig(addr, host string, port int, security string, auth smtp.Auth, from, to string, msg []byte) error {
	useImplicitTLS := port == 465 && strings.EqualFold(strings.TrimSpace(security), "SSL")
	if useImplicitTLS {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
		if err != nil {
			return err
		}
		defer conn.Close()
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
		defer client.Close()
		if err := client.Auth(auth); err != nil {
			return err
		}
		if err := client.Mail(from); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write(msg); err != nil {
			_ = w.Close()
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		return client.Quit()
	}
	// STARTTLS (port 587) or no security: standard SendMail
	return smtp.SendMail(addr, auth, from, []string{to}, msg)
}

// sanitizeHeader removes CR/LF to prevent header injection.
func sanitizeHeader(s string) string {
	return strings.NewReplacer("\r", "", "\n", "").Replace(s)
}

func buildMessage(to, from, subject, body string) []byte {
	const crlf = "\r\n"
	to = sanitizeHeader(to)
	from = sanitizeHeader(from)
	subject = sanitizeHeader(subject)
	h := "To: " + to + crlf +
		"From: " + from + crlf +
		"Subject: " + subject + crlf +
		"Content-Type: text/plain; charset=UTF-8" + crlf +
		"MIME-Version: 1.0" + crlf +
		crlf
	return []byte(h + body)
}
