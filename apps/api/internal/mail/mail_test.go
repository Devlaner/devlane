package mail

import (
	"bufio"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestNewSMTPAuthWithoutUsernameReturnsNil(t *testing.T) {
	if auth := newSMTPAuth("smtp.example.test", "", "password"); auth != nil {
		t.Fatal("expected SMTP authentication to be disabled without a username")
	}
}

func TestNewSMTPAuthWithUsernameReturnsAuth(t *testing.T) {
	if auth := newSMTPAuth("smtp.example.test", "sender", "password"); auth == nil {
		t.Fatal("expected SMTP authentication when a username is configured")
	}
}

func TestSendMailWithConfigNoneDoesNotAttemptSTARTTLS(t *testing.T) {
	server := startSMTPProbe(t, []string{"STARTTLS"})
	port := smtpTestPort(t, server.addr)
	if err := sendMailWithConfig(context.Background(), server.addr, "smtp.example.test", port, " None ", nil,
		"sender@example.com", "recipient@example.com", []byte("Subject: test\r\n\r\nbody")); err != nil {
		t.Fatalf("sendMailWithConfig returned an error: %v", err)
	}
	result := server.wait(t)
	if containsSMTPCommand(result.commands, "STARTTLS") {
		t.Fatalf("client attempted STARTTLS when security was None: %v", result.commands)
	}
}

func TestSendMailWithConfigTLSRequiresSTARTTLS(t *testing.T) {
	for _, security := range []string{"TLS", ""} {
		t.Run("security="+security, func(t *testing.T) {
			server := startSMTPProbe(t, nil)
			port := smtpTestPort(t, server.addr)
			err := sendMailWithConfig(context.Background(), server.addr, "smtp.example.test", port, security, nil,
				"sender@example.com", "recipient@example.com", []byte("Subject: test\r\n\r\nbody"))
			result := server.wait(t)
			if err == nil || !strings.Contains(err.Error(), "does not support STARTTLS") {
				t.Fatalf("expected TLS mode to fail when STARTTLS is unavailable, got %v", err)
			}
			if containsSMTPCommand(result.commands, "STARTTLS") {
				t.Fatalf("client attempted an unadvertised STARTTLS command: %v", result.commands)
			}
			assertNoSensitiveSMTPCommands(t, result.commands)
		})
	}
}

func TestSendMailWithConfigTLSRejectsUntrustedSTARTTLSCertificate(t *testing.T) {
	certificate := smtpTestCertificate(t)
	server := startSMTPProbe(t, []string{"STARTTLS", "AUTH PLAIN"}, &certificate)
	port := smtpTestPort(t, server.addr)

	err := sendMailWithConfig(context.Background(), server.addr, "example.com", port, "TLS", nil,
		"sender@example.com", "recipient@example.com", []byte("Subject: test\r\n\r\nbody"))
	if err == nil || !strings.Contains(err.Error(), "certificate signed by unknown authority") {
		t.Fatalf("expected TLS mode to reject the untrusted certificate, got %v", err)
	}

	select {
	case result := <-server.result:
		if result.err == nil {
			t.Fatal("expected the server to observe the client reject the TLS handshake")
		}
		if !containsSMTPCommand(result.commands, "STARTTLS") {
			t.Fatalf("expected the client to request STARTTLS, got %v", result.commands)
		}
		assertNoSensitiveSMTPCommands(t, result.commands)
	case <-time.After(6 * time.Second):
		t.Fatal("timed out waiting for fake SMTP server")
	}
}

func TestSendMailWithConfigTLSDoesNotDowngradeWhenSTARTTLSFails(t *testing.T) {
	server := startSMTPProbe(t, []string{"STARTTLS", "AUTH PLAIN"})
	port := smtpTestPort(t, server.addr)
	err := sendMailWithConfig(context.Background(), server.addr, "smtp.example.test", port, "TLS", nil,
		"sender@example.com", "recipient@example.com", []byte("Subject: test\r\n\r\nbody"))
	if err == nil || !strings.Contains(err.Error(), "STARTTLS unavailable") {
		t.Fatalf("expected STARTTLS refusal error, got %v", err)
	}
	result := server.wait(t)
	if !containsSMTPCommand(result.commands, "STARTTLS") {
		t.Fatalf("expected a STARTTLS command, got %v", result.commands)
	}
	assertNoSensitiveSMTPCommands(t, result.commands)
}

func TestSendMailWithConfigNoneDoesNotSendPlainAuthCredentialsRemotely(t *testing.T) {
	server := startSMTPProbe(t, []string{"STARTTLS", "AUTH PLAIN"})
	port := smtpTestPort(t, server.addr)
	auth := smtp.PlainAuth("", "sender", "password", "smtp.example.test")

	err := sendMailWithConfig(context.Background(), server.addr, "smtp.example.test", port, "None", auth,
		"sender@example.com", "recipient@example.com", []byte("Subject: test\r\n\r\nbody"))
	if err == nil || !strings.Contains(err.Error(), "unencrypted connection") {
		t.Fatalf("expected Go to refuse PLAIN authentication over plaintext, got %v", err)
	}

	result := server.wait(t)
	if containsSMTPCommand(result.commands, "STARTTLS") {
		t.Fatalf("client attempted STARTTLS when security was None: %v", result.commands)
	}
	assertNoSensitiveSMTPCommands(t, result.commands)
}

func TestSendMailWithConfigSSLUsesImplicitTLS(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	firstByte := make(chan byte, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		var header [1]byte
		if _, err := conn.Read(header[:]); err == nil {
			firstByte <- header[0]
		}
	}()

	// Use a local ephemeral listener while passing the standard implicit-TLS port.
	// The probe closes during the handshake; the first byte still proves the
	// client started TLS immediately instead of sending an SMTP greeting.
	if err := sendMailWithConfig(context.Background(), listener.Addr().String(), "smtp.example.test", 465, "SSL", nil,
		"sender@example.com", "recipient@example.com", nil); err == nil {
		t.Fatal("expected the SMTP probe to close the incomplete TLS handshake")
	}
	select {
	case got := <-firstByte:
		if got != 0x16 {
			t.Fatalf("expected a TLS handshake byte, got 0x%x", got)
		}
	case <-time.After(6 * time.Second):
		t.Fatal("timed out waiting for the implicit TLS handshake")
	}
}

type smtpProbe struct {
	addr   string
	result <-chan smtpProbeResult
}

type smtpProbeResult struct {
	commands []string
	err      error
}

func startSMTPProbe(t *testing.T, extensions []string, tlsCertificates ...*tls.Certificate) smtpProbe {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	result := make(chan smtpProbeResult, 1)
	var tlsCertificate *tls.Certificate
	if len(tlsCertificates) > 0 {
		tlsCertificate = tlsCertificates[0]
	}
	go func() {
		probeResult := smtpProbeResult{}
		defer func() { result <- probeResult }()
		conn, err := listener.Accept()
		if err != nil {
			probeResult.err = err
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		reader := bufio.NewReader(conn)
		write := func(line string) error {
			_, err := fmt.Fprint(conn, line+"\r\n")
			return err
		}
		if err := write("220 smtp.example.test ESMTP"); err != nil {
			probeResult.err = err
			return
		}
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					probeResult.err = err
				}
				return
			}
			command := strings.TrimSpace(line)
			probeResult.commands = append(probeResult.commands, command)
			switch {
			case strings.HasPrefix(strings.ToUpper(command), "EHLO "):
				if len(extensions) == 0 {
					if err := write("250 smtp.example.test"); err != nil {
						probeResult.err = err
						return
					}
					continue
				}
				if err := write("250-smtp.example.test"); err != nil {
					probeResult.err = err
					return
				}
				for i, extension := range extensions {
					separator := "-"
					if i == len(extensions)-1 {
						separator = " "
					}
					if err := write("250" + separator + extension); err != nil {
						probeResult.err = err
						return
					}
				}
			case strings.EqualFold(command, "STARTTLS"):
				if tlsCertificate == nil {
					if err := write("454 4.7.0 STARTTLS unavailable in SMTP probe"); err != nil {
						probeResult.err = err
						return
					}
					continue
				}
				if err := write("220 2.0.0 Ready to start TLS"); err != nil {
					probeResult.err = err
					return
				}
				tlsConn := tls.Server(conn, &tls.Config{Certificates: []tls.Certificate{*tlsCertificate}})
				if err := tlsConn.Handshake(); err != nil {
					probeResult.err = err
					return
				}
				conn = tlsConn
				reader = bufio.NewReader(conn)
			case strings.HasPrefix(strings.ToUpper(command), "AUTH "):
				if err := write("235 2.7.0 authenticated"); err != nil {
					probeResult.err = err
					return
				}
			case strings.HasPrefix(strings.ToUpper(command), "MAIL FROM:"):
				if err := write("250 sender accepted"); err != nil {
					probeResult.err = err
					return
				}
			case strings.HasPrefix(strings.ToUpper(command), "RCPT TO:"):
				if err := write("250 recipient accepted"); err != nil {
					probeResult.err = err
					return
				}
			case strings.EqualFold(command, "DATA"):
				if err := write("354 send message"); err != nil {
					probeResult.err = err
					return
				}
				for {
					dataLine, err := reader.ReadString('\n')
					if err != nil {
						probeResult.err = err
						return
					}
					if strings.TrimRight(dataLine, "\r\n") == "." {
						break
					}
				}
				if err := write("250 message accepted"); err != nil {
					probeResult.err = err
					return
				}
			case strings.EqualFold(command, "QUIT"):
				probeResult.err = write("221 goodbye")
				return
			default:
				probeResult.err = fmt.Errorf("unexpected SMTP command %q", command)
				return
			}
		}
	}()
	return smtpProbe{addr: listener.Addr().String(), result: result}
}

func (server smtpProbe) wait(t *testing.T) smtpProbeResult {
	t.Helper()
	select {
	case result := <-server.result:
		if result.err != nil {
			t.Fatalf("fake SMTP server: %v", result.err)
		}
		return result
	case <-time.After(6 * time.Second):
		t.Fatal("timed out waiting for fake SMTP server")
		return smtpProbeResult{}
	}
}

func smtpTestPort(t *testing.T, addr string) int {
	t.Helper()
	_, portText, err := net.SplitHostPort(addr)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portText)
	if err != nil {
		t.Fatal(err)
	}
	return port
}

func smtpTestCertificate(t *testing.T) tls.Certificate {
	t.Helper()
	server := httptest.NewTLSServer(http.NotFoundHandler())
	defer server.Close()
	return server.TLS.Certificates[0]
}

func assertNoSensitiveSMTPCommands(t *testing.T, commands []string) {
	t.Helper()
	for _, command := range commands {
		upper := strings.ToUpper(command)
		if strings.HasPrefix(upper, "AUTH ") || strings.HasPrefix(upper, "MAIL FROM:") {
			t.Fatalf("credentials or message were sent before secure SMTP was established: %v", commands)
		}
	}
}

func containsSMTPCommand(commands []string, want string) bool {
	for _, command := range commands {
		if strings.EqualFold(command, want) {
			return true
		}
	}
	return false
}
