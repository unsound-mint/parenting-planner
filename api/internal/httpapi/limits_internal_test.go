package httpapi

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientIPTrustsForwardedForOnlyFromAProxy(t *testing.T) {
	for _, tc := range []struct {
		name, peer string
		xff        []string
		want       string
	}{
		{"direct client", "203.0.113.7:5000", nil, "203.0.113.7"},
		{"direct client forging the header", "203.0.113.7:5000", []string{"10.0.0.1"}, "203.0.113.7"},
		{"behind Caddy on loopback", "127.0.0.1:4000", []string{"198.51.100.9"}, "198.51.100.9"},
		{"behind Caddy from the Docker bridge", "172.18.0.1:4000", []string{"198.51.100.9"}, "198.51.100.9"},
		{"rightmost entry is the one the proxy added", "127.0.0.1:4000", []string{"6.6.6.6, 198.51.100.9"}, "198.51.100.9"},
		{"last header line wins", "127.0.0.1:4000", []string{"6.6.6.6", "198.51.100.9"}, "198.51.100.9"},
		{"garbage falls back to the peer", "127.0.0.1:4000", []string{"not-an-ip"}, "127.0.0.1"},
		{"proxy without the header", "127.0.0.1:4000", nil, "127.0.0.1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/api/demo/sessions", nil)
			r.RemoteAddr = tc.peer
			for _, v := range tc.xff {
				r.Header.Add("X-Forwarded-For", v)
			}
			if got := clientIP(r); got != tc.want {
				t.Errorf("clientIP = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRateLimiterWindowsAndPruning(t *testing.T) {
	now := time.Date(2026, 11, 14, 15, 0, 0, 0, time.UTC)
	rl := newRateLimiter(Limit{N: 2, Window: time.Minute}, func() time.Time { return now })
	if !rl.allow("a") || !rl.allow("a") || rl.allow("a") {
		t.Fatal("two per window for a")
	}
	if !rl.allow("b") {
		t.Fatal("b has its own budget")
	}
	now = now.Add(time.Minute)
	if !rl.allow("a") {
		t.Fatal("a new window starts over")
	}
	if _, ok := rl.counts["b"]; ok {
		t.Error("keys of ended windows are pruned")
	}
	off := newRateLimiter(Limit{N: -1}, time.Now)
	for range 100 {
		if !off.allow("a") {
			t.Fatal("N < 0 is off")
		}
	}
}
