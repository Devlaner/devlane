package mail

import "log/slog"

// LogSendAttempt logs when an email send is about to be attempted.
// inviteURL is optional (e.g. workspace invite link); empty string is omitted from logs.
func LogSendAttempt(log *slog.Logger, to, subject, kind, inviteURL string) {
	if log == nil {
		return
	}
	attrs := []any{"to", to, "subject", subject, "kind", kind}
	if inviteURL != "" {
		attrs = append(attrs, "invite_url", inviteURL)
	}
	log.Info("mail send attempt", attrs...)
}

// LogSent logs successful email delivery.
func LogSent(log *slog.Logger, to, subject, inviteURL string) {
	if log == nil {
		return
	}
	attrs := []any{"to", to, "subject", subject}
	if inviteURL != "" {
		attrs = append(attrs, "invite_url", inviteURL)
	}
	log.Info("mail sent", attrs...)
}

// LogFailed logs a failed email send with error and optional invite URL.
func LogFailed(log *slog.Logger, to, subject, inviteURL string, err error) {
	if log == nil {
		return
	}
	attrs := []any{"to", to, "subject", subject, "error", err}
	if inviteURL != "" {
		attrs = append(attrs, "invite_url", inviteURL)
	}
	log.Error("mail send failed", attrs...)
}

// LogSkip logs when mail is skipped (e.g. not configured).
func LogSkip(log *slog.Logger, reason, to string, err error) {
	if log == nil {
		return
	}
	log.Warn("mail skip", "reason", reason, "to", to, "error", err)
}
