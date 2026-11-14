package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/monitor"
	"github.com/unsound-mint/parenting-planner/api/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Error reports go to Sentry only when SENTRY_DSN is set; see
	// internal/monitor for what is scrubbed before sending.
	flush, err := monitor.Init(os.Getenv("SENTRY_DSN"), "production")
	if err != nil {
		return err
	}
	defer flush()

	dbURL := env("DATABASE_URL", "postgres://parenting:parenting@localhost:5433/parenting?sslmode=disable")
	pool, err := store.Open(ctx, dbURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	handler, err := httpapi.New(pool, httpapi.Config{SecureCookies: os.Getenv("COOKIE_SECURE") != "false"})
	if err != nil {
		return err
	}
	srv := &http.Server{
		Addr:              env("ADDR", ":8080"),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	slog.Info("api listening", "addr", srv.Addr)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
