package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"testing"
)

const fakeKey = "test-key-not-real"

func TestFromEnv(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("ANTHROPIC_MODEL", "")
	if FromEnv().Enabled() {
		t.Fatal("enabled with no key")
	}
	t.Setenv("ANTHROPIC_API_KEY", " "+fakeKey+"\n")
	c := FromEnv()
	if !c.Enabled() || c.APIKey.Reveal() != fakeKey {
		t.Fatalf("key not read: enabled=%v", c.Enabled())
	}
}

func TestSecretNeverPrints(t *testing.T) {
	c := Config{APIKey: Secret(fakeKey), Model: "m"}
	var logs bytes.Buffer
	slog.New(slog.NewJSONHandler(&logs, nil)).Info("cfg", "key", c.APIKey, "cfg", c)
	slog.New(slog.NewTextHandler(&logs, nil)).Info("cfg", "key", c.APIKey, "cfg", c)
	js, _ := json.Marshal(c)
	out := strings.Join([]string{
		fmt.Sprint(c.APIKey), fmt.Sprintf("%v %+v %#v %s", c, c, c, c.APIKey),
		string(js), logs.String(),
	}, "\n")
	if strings.Contains(out, fakeKey) {
		t.Fatalf("key leaked:\n%s", out)
	}
}
