// Package ai holds the server-side settings for the Claude API. The key lives
// only in the server environment (deploy/.env on the server, never in the
// repo). It is never logged and never sent to the browser.
package ai

import (
	"log/slog"
	"os"
	"strings"
)

// Secret is a string that prints as "[redacted]" through fmt, slog and JSON,
// so it cannot leak by accident. Use Reveal only when building the request
// to the Claude API.
type Secret string

const redacted = "[redacted]"

func (s Secret) String() string               { return redacted }
func (s Secret) GoString() string             { return redacted }
func (s Secret) LogValue() slog.Value         { return slog.StringValue(redacted) }
func (s Secret) MarshalJSON() ([]byte, error) { return []byte(`"` + redacted + `"`), nil }
func (s Secret) MarshalText() ([]byte, error) { return []byte(redacted), nil }

// Reveal returns the raw value. Call it only where the key goes into the
// x-api-key header of a request to the Claude API.
func (s Secret) Reveal() string { return string(s) }

// Config is optional: with no key the AI plan is off and the rule plan is
// shown on its own.
type Config struct {
	APIKey Secret
	// Model overrides the model id used for the AI plan; empty means the
	// caller's default.
	Model string
}

// Enabled reports whether a key is set.
func (c Config) Enabled() bool { return c.APIKey != "" }

// FromEnv reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL.
func FromEnv() Config {
	return Config{
		APIKey: Secret(strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))),
		Model:  strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL")),
	}
}
