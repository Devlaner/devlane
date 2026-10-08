package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/crypto"
	"github.com/Devlaner/devlane/api/internal/store"
)

type SMTPSettings struct {
	Host        string
	Port        int
	SenderEmail string
	Security    string
	Username    string
	Password    string
}

func getEmailSettings(ctx context.Context, s *store.InstanceSettingStore) (*SMTPSettings, error) {
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
	return &SMTPSettings{
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
		if err := SendWithSMTPSettings(ctx, cfg, to, subject, body, log); err != nil {
			return err
		}
		return nil
	}
}

var smtpSendTimeout = 15 * time.Second

// SendWithSMTPSettings sends an email using the supplied SMTP settings without persisting them.
func SendWithSMTPSettings(ctx context.Context, cfg *SMTPSettings, to, subject, body string, log *slog.Logger) error {
	if cfg == nil {
		return fmt.Errorf("SMTP settings not configured")
	}
	from := cfg.SenderEmail

	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, smtpSendTimeout)
	defer cancel()

	if from == "" {
		from = cfg.Username
	}
	if from == "" {
		LogSkip(log, "sender_email and username empty", to, fmt.Errorf("sender not set"))
		return fmt.Errorf("sender email not configured")
	}
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	var auth smtp.Auth
	if cfg.Username != "" || cfg.Password != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}
	msg := buildMessage(to, from, subject, body)
	if err := sendMailWithConfig(ctx, addr, cfg.Host, cfg.Port, cfg.Security, auth, from, to, msg); err != nil {
		return err
	}
	return nil
}

// sendMailWithConfig delivers an email over SMTP using context-aware dialing
// and connection deadlines to bound SMTP read and write operations.
func sendMailWithConfig(
	ctx context.Context,
	addr, host string,
	port int,
	security string,
	auth smtp.Auth,
	from, to string,
	msg []byte,
) error {
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		if err := conn.SetDeadline(deadline); err != nil {
			return err
		}
	}

	stopCancel := context.AfterFunc(ctx, func() {
		_ = conn.SetDeadline(time.Now())
	})
	defer stopCancel()

	var client *smtp.Client
	useImplicitTLS := port == 465 && strings.EqualFold(strings.TrimSpace(security), "SSL")

	if useImplicitTLS {
		tlsConn := tls.Client(conn, &tls.Config{ServerName: host})
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			return err
		}

		client, err = smtp.NewClient(tlsConn, host)
		if err != nil {
			return err
		}
	} else {
		client, err = smtp.NewClient(conn, host)
		if err != nil {
			return err
		}

		// Preserve smtp.SendMail's existing behavior: use STARTTLS when the
		// server advertises it.
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: host}); err != nil {
				return err
			}
		}
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
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
