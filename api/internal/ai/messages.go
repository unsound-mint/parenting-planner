package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	apiURL           = "https://api.anthropic.com"
	apiVersion       = "2023-06-01"
	fallbackBeta     = "server-side-fallback-2026-07-01"
	maxResponseBytes = 1 << 20
)

// Request is one call to the Messages API with a single user turn.
type Request struct {
	Model     string
	System    string
	User      string
	MaxTokens int
	// Effort goes into output_config.effort ("low", "medium", ...); empty
	// leaves the model's default.
	Effort string
	// Timeout bounds the call when the Config sets none.
	Timeout time.Duration
	// Fallbacks lets the API rerun a request its safety classifiers decline
	// on the model it picks for that category (server-side fallbacks beta).
	// Only the Claude API itself accepts it.
	Fallbacks bool
}

// ErrOff means no key is set; the caller uses its fallback.
var ErrOff = errors.New("ai is off")

type wireRequest struct {
	Model        string        `json:"model"`
	MaxTokens    int           `json:"max_tokens"`
	System       string        `json:"system"`
	Messages     []wireMessage `json:"messages"`
	OutputConfig *wireOutput   `json:"output_config,omitempty"`
	Fallbacks    string        `json:"fallbacks,omitempty"`
}

type wireMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type wireOutput struct {
	Effort string `json:"effort,omitempty"`
}

type wireResponse struct {
	StopReason string `json:"stop_reason"`
	Content    []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// Text sends r and returns the first text block of the answer. Any answer
// that did not finish normally (cut off at max_tokens, refused) is an error,
// so the caller falls back instead of using half a reply. Errors never carry
// the key or the response body.
func (c Config) Text(ctx context.Context, client *http.Client, r Request) (string, error) {
	if !c.Enabled() {
		return "", ErrOff
	}
	timeout := c.Timeout
	if timeout == 0 {
		timeout = r.Timeout
	}
	if timeout == 0 {
		timeout = 12 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	wr := wireRequest{Model: r.Model, MaxTokens: r.MaxTokens, System: r.System, Messages: []wireMessage{{Role: "user", Content: r.User}}}
	if r.Effort != "" {
		wr.OutputConfig = &wireOutput{Effort: r.Effort}
	}
	if r.Fallbacks {
		wr.Fallbacks = "default"
	}
	body, err := json.Marshal(wr)
	if err != nil {
		return "", err
	}
	base := c.BaseURL
	if base == "" {
		base = apiURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("anthropic-version", apiVersion)
	req.Header.Set("x-api-key", c.APIKey.Reveal())
	if r.Fallbacks {
		req.Header.Set("anthropic-beta", fallbackBeta)
	}
	res, err := client.Do(req)
	if err != nil {
		return "", errors.New("claude request failed")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBytes))
	if err != nil || res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("claude answered %d", res.StatusCode)
	}
	var out wireResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", errors.New("claude answer is not JSON")
	}
	if out.StopReason != "" && out.StopReason != "end_turn" {
		return "", fmt.Errorf("claude stopped with %s", out.StopReason)
	}
	// Thinking blocks come before the text. After a fallback, text written
	// before the "fallback" block belongs to the model that declined, so only
	// the text after the last one is the answer.
	var text strings.Builder
	for _, b := range out.Content {
		switch b.Type {
		case "fallback":
			text.Reset()
		case "text":
			text.WriteString(b.Text)
		}
	}
	if text.Len() == 0 {
		return "", errors.New("no text in the answer")
	}
	return text.String(), nil
}
