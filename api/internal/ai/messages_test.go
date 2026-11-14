package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// After a server-side fallback the answer is the text after the last
// "fallback" block; thinking blocks and the declined model's text are dropped.
func TestTextTakesTheAnswerAfterAFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"stop_reason": "end_turn", "content": []map[string]any{
			{"type": "thinking", "thinking": ""},
			{"type": "text", "text": "half an answer"},
			{"type": "fallback"},
			{"type": "thinking", "thinking": ""},
			{"type": "text", "text": "the answer"},
		}})
	}))
	defer srv.Close()
	c := Config{APIKey: "k", BaseURL: srv.URL}
	got, err := c.Text(context.Background(), srv.Client(), Request{Model: "m", User: "u", MaxTokens: 10})
	if err != nil || got != "the answer" {
		t.Fatalf("got %q, %v", got, err)
	}
	if _, err := (Config{}).Text(context.Background(), srv.Client(), Request{}); err != ErrOff {
		t.Errorf("no key: %v", err)
	}
}
