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

	"github.com/unsound-mint/parenting-planner/api/internal/ai"
	"github.com/unsound-mint/parenting-planner/api/internal/billing"
	"github.com/unsound-mint/parenting-planner/api/internal/crypt"
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

	// The diary is encrypted at rest. Without DIARY_ENCRYPTION_KEY a random key lasts until
	// the process stops: fine for synthetic demo data, not for a real deployment.
	diaryKey, ephemeral, err := crypt.FromEnv()
	if err != nil {
		return err
	}
	slog.Info("diary encryption", "ephemeral_key", ephemeral)

	aiCfg := ai.FromEnv()
	billingCfg := billing.FromEnv()
	handler, err := httpapi.New(pool, httpapi.Config{
		SecureCookies: os.Getenv("COOKIE_SECURE") != "false",
		AI:            aiCfg,
		Billing:       billingCfg,
		Diary:         diaryKey,
	})
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
	// Log only whether the keys are set, never the keys.
	slog.Info("api listening", "addr", srv.Addr, "ai_plan", aiCfg.Enabled(), "payments", billingCfg.Enabled())
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
