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
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
