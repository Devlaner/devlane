package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Devlaner/devlane/api/internal/config"
	"github.com/Devlaner/devlane/api/internal/database"
	"github.com/Devlaner/devlane/api/internal/mail"
	"github.com/Devlaner/devlane/api/internal/minio"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/rabbitmq"
	"github.com/Devlaner/devlane/api/internal/redis"
	"github.com/Devlaner/devlane/api/internal/router"
	"github.com/Devlaner/devlane/api/internal/store"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(log)

	cfg, err := config.Load()
	if err != nil {
		log.Error("load config", "error", err)
		os.Exit(1)
	}

	// Run migrations (optional: skip in prod if run separately)
	if err := database.RunMigrations(cfg, log); err != nil {
		log.Warn("migrations", "error", err)
	}

	db, err := database.NewDB(cfg, log)
	if err != nil {
		log.Error("database", "error", err)
		os.Exit(1)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Error("get underlying sql.DB", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	// Redis
	var rdb *redis.Client
	if client, err := redis.New(cfg, log); err != nil {
		log.Warn("redis", "error", err)
	} else {
		rdb = client
		defer rdb.Close()
	}

	// RabbitMQ
	var queuePublisher *queue.Publisher
	var rmq *rabbitmq.Client
	if client, err := rabbitmq.New(cfg, log); err != nil {
		log.Warn("rabbitmq", "error", err)
	} else {
		rmq = client
		defer rmq.Close()
		if pub, err := queue.NewPublisher(rmq.Channel(), log); err != nil {
			log.Warn("queue publisher", "error", err)
		} else {
			queuePublisher = pub
		}
	}

	// MinIO (optional: file uploads for covers, avatars, logos)
	var mc *minio.Client
	if client, err := minio.New(cfg, log); err != nil {
		log.Warn("minio", "error", err)
	} else {
		mc = client
	}

	r := router.New(router.Config{
		Log:                log,
		DB:                 db,
		Redis:              rdb,
		Queue:              queuePublisher,
		Minio:              mc,
		CORSAllowOrigin:    cfg.CORSAllowOrigin,
		AppBaseURL:         cfg.AppBaseURL,
		GoogleClientID:     cfg.GoogleClientID,
		GoogleClientSecret: cfg.GoogleClientSecret,
		GitHubClientID:     cfg.GitHubClientID,
		GitHubClientSecret: cfg.GitHubClientSecret,
		GitLabClientID:     cfg.GitLabClientID,
		GitLabClientSecret: cfg.GitLabClientSecret,
		GitLabHost:         cfg.GitLabHost,
	})

	// Start task consumer when RabbitMQ is available
	consumerCtx, cancelConsumer := context.WithCancel(context.Background())
	defer cancelConsumer()
	if rmq != nil {
		if chConsume, err := rmq.NewChannel(); err == nil {
			defer chConsume.Close()
			consumer := queue.NewConsumer(chConsume, log)
			instanceSettingStore := store.NewInstanceSettingStore(db)
			emailSender := mail.NewSMTPEmailSender(instanceSettingStore, log)
			consumer.Register(queue.QueueEmails, queue.HandleSendEmail(log, emailSender))
			consumer.Register(queue.QueueWebhooks, queue.HandleWebhook(queue.NoopWebhookDeliverer(log)))
			if err := consumer.Run(consumerCtx, []string{queue.QueueEmails, queue.QueueWebhooks}); err != nil {
				log.Warn("queue consumer", "error", err)
			}
		}
	}

	addr := ":" + cfg.ServerPort
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info("server listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("shutting down server...")
	cancelConsumer()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("server shutdown", "error", err)
		os.Exit(1)
	}

	log.Info("server stopped")
	fmt.Println("goodbye")
}
