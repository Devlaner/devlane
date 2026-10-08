package mail

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestSendWithSMTPSettings_TimesOutWhenSMTPServerStalls(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() {
		_ = listener.Close()
	})

	releaseConnection := make(chan struct{})
	t.Cleanup(func() {
		close(releaseConnection)
	})

	// Accept the TCP connection but deliberately never send the SMTP greeting.
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		<-releaseConnection
	}()

	previousTimeout := smtpSendTimeout
	smtpSendTimeout = 100 * time.Millisecond
	t.Cleanup(func() {
		smtpSendTimeout = previousTimeout
	})

	port := listener.Addr().(*net.TCPAddr).Port
	started := time.Now()

	err = SendWithSMTPSettings(
		context.Background(),
		&SMTPSettings{
			Host:        "127.0.0.1",
			Port:        port,
			SenderEmail: "sender@example.test",
			Security:    "None",
		},
		"admin@example.test",
		"Test subject",
		"Test body",
		nil,
	)

	if err == nil {
		t.Fatal("expected SMTP send to time out")
	}

	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("SMTP timeout took too long: %s", elapsed)
	}
}
