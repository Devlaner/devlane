package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Env string

	// Server
	ServerPort string

	// PostgreSQL
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// RabbitMQ
	RabbitMQURL string

	// MinIO
	MinIOEndpoint        string
	MinIOAccessKeyID     string
	MinIOSecretAccessKey string
	MinIOBucket          string
	MinIOUseSSL          bool

	MigrationsPath string

	CORSAllowOrigin string
	// AppBaseURL is the public URL of the frontend (e.g. https://app.example.com). Used for invite links in emails. If empty, CORSAllowOrigin is used.
	AppBaseURL string
	// FrontendPublicURL is the browser-visible SPA origin (e.g. https://app.example.com). Used for OAuth "Authorized JavaScript origins" / homepage hints in instance-admin. If empty, AppBaseURL then CORSAllowOrigin apply (see router).
	FrontendPublicURL string
	// APIPublicURL is the public URL of the API (e.g. https://api.example.com or http://localhost:8080).
	// Used to generate OAuth callback URLs shown in instance-admin and sent to providers.
	APIPublicURL string

	// MagicCodeSecret HMAC key for email login codes. If empty, a dev-only default is used (see auth package).
	MagicCodeSecret string
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	redisDB := 0
	if v := os.Getenv("REDIS_DB"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			redisDB = n
		}
	}

	minioSSL := false
	if v := os.Getenv("MINIO_USE_SSL"); v == "true" || v == "1" {
		minioSSL = true
	}

	cfg := &Config{
		Env:                  getEnv("ENV", "development"),
		ServerPort:           getEnv("SERVER_PORT", "8080"),
		DBHost:               getEnv("DB_HOST", "localhost"),
		DBPort:               getEnv("DB_PORT", "5432"),
		DBUser:               getEnv("DB_USER", "postgres"),
		DBPassword:           getEnv("DB_PASSWORD", "postgres"),
		DBName:               getEnv("DB_NAME", "devlane"),
		DBSSLMode:            getEnv("DB_SSLMODE", "disable"),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RedisDB:              redisDB,
		RabbitMQURL:          getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		MinIOEndpoint:        getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKeyID:     getEnv("MINIO_ACCESS_KEY_ID", "minioadmin"),
		MinIOSecretAccessKey: getEnv("MINIO_SECRET_ACCESS_KEY", "minioadmin"),
		MinIOBucket:          getEnv("MINIO_BUCKET", "devlane"),
		MinIOUseSSL:          minioSSL,
		MigrationsPath:       getEnv("MIGRATIONS_PATH", "migrations"),
		CORSAllowOrigin:      getEnv("CORS_ORIGIN", "http://localhost:5173"),
		AppBaseURL:           getEnv("APP_BASE_URL", ""),
		FrontendPublicURL:    getEnv("FRONTEND_PUBLIC_URL", ""),
		APIPublicURL:         getEnv("API_PUBLIC_URL", ""),
		MagicCodeSecret:      getEnv("MAGIC_CODE_SECRET", ""),
	}

	// Fail closed in non-development environments: a missing MAGIC_CODE_SECRET
	// falls back to a public compiled-in HMAC key, and a missing
	// INSTANCE_ENCRYPTION_KEY causes instance secrets to be stored in plaintext.
	// Both are unacceptable outside local dev.
	if cfg.Env != "development" {
		var missing []string
		if cfg.MagicCodeSecret == "" {
			missing = append(missing, "MAGIC_CODE_SECRET")
		}
		encKey := os.Getenv("INSTANCE_ENCRYPTION_KEY")
		if encKey == "" {
			missing = append(missing, "INSTANCE_ENCRYPTION_KEY")
		}
		if len(missing) > 0 {
			return nil, fmt.Errorf("missing required production secrets %v (set ENV=development only for local dev)", missing)
		}
		// A set-but-weak encryption key is as dangerous as a missing one: it
		// feeds the AES key that protects instance secrets (SMTP password, OAuth
		// client secrets, GitHub App private key). Reject the shipped placeholder
		// and anything too short to be meaningfully random.
		if isWeakSecret(encKey) {
			return nil, fmt.Errorf("INSTANCE_ENCRYPTION_KEY is a placeholder or too short; set a random value of at least 16 characters for production")
		}
	}

	return cfg, nil
}

// isWeakSecret reports whether a production secret is unusable: a known
// .env.example placeholder, or too short to carry meaningful entropy.
func isWeakSecret(v string) bool {
	if len(v) < 16 {
		return true
	}
	switch v {
	case "change-me-generate-a-random-key", "change-me", "changeme":
		return true
	}
	return false
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
