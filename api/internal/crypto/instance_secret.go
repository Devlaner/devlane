package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
)

const encryptedPrefix = "enc:"

func getKey() []byte {
	s := os.Getenv("INSTANCE_ENCRYPTION_KEY")
	if s == "" {
		return nil
	}
	h := sha256.Sum256([]byte(s))
	return h[:]
}

func Encrypt(plaintext string) (string, error) {
	key := getKey()
	if key == nil {
		return plaintext, nil
	}
	if plaintext == "" {
		return "", nil
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encryptedPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	if len(value) < len(encryptedPrefix) || value[:len(encryptedPrefix)] != encryptedPrefix {
		return value, nil
	}
	key := getKey()
	if key == nil {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(value[len(encryptedPrefix):])
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func EncryptOrPlain(plaintext string) string {
	out, _ := Encrypt(plaintext)
	return out
}

func DecryptOrPlain(value string) string {
	out, err := Decrypt(value)
	if err != nil {
		return ""
	}
	return out
}
