package httpapi

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

// Abuse limits for a public site with no login (#134, docs/security-review.md).
// They are in memory, per API process: enough for one demo server, and they
// reset on restart.

// Limit is at most N events per Window for one key. N < 0 turns it off; the
// zero value means the default for that limit.
type Limit struct {
	N      int
	Window time.Duration
}

var (
	// Starting a demo seeds a whole family, so one address may start this many
	// per window. Generous: judges on one venue Wi-Fi share an address.
	defaultSessionLimit = Limit{N: 30, Window: 10 * time.Minute}
	// Every weekly plan is a paid Claude API call. Past this many per family
	// the rule-based fallback is shown instead.
	defaultAIPlanLimit = Limit{N: 20, Window: time.Hour}
)

// maxBodyBytes caps every request body before the validator reads it into
// memory. The largest body the contract allows is a portrait (1.5 MB);
// voice notes have their own, smaller cap (capVoiceNoteBody).
const maxBodyBytes = 2 << 20

var errRateLimited = Error{Code: "rate_limited", Message: "too many new demos from this address; try again in a few minutes"}

func (l Limit) or(def Limit) Limit {
	if l.N == 0 {
		return def
	}
	return l
}

// rateLimiter counts events per key in fixed windows. Keys whose window has
// ended are pruned, so the map holds at most the keys of one window.
type rateLimiter struct {
	limit Limit
	now   func() time.Time

	mu        sync.Mutex
	counts    map[string]*window
	lastPrune time.Time
}

type window struct {
	start time.Time
	n     int
}

func newRateLimiter(l Limit, now func() time.Time) *rateLimiter {
	return &rateLimiter{limit: l, now: now, counts: map[string]*window{}}
}

// allow records one event for key and reports whether it is within the limit.
func (rl *rateLimiter) allow(key string) bool {
	if rl.limit.N < 0 {
		return true
	}
	now := rl.now()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if now.Sub(rl.lastPrune) >= rl.limit.Window {
		for k, w := range rl.counts {
			if now.Sub(w.start) >= rl.limit.Window {
				delete(rl.counts, k)
			}
		}
		rl.lastPrune = now
	}
	w, ok := rl.counts[key]
	if !ok || now.Sub(w.start) >= rl.limit.Window {
		w = &window{start: now}
		rl.counts[key] = w
	}
	if w.n >= rl.limit.N {
		return false
	}
	w.n++
	return true
}

// clientIP is the visitor's address. In production the API listens on
// loopback behind Caddy, which replaces X-Forwarded-For from untrusted
// clients with the real peer address, so the rightmost entry is the client.
// The header is trusted only when the direct peer is loopback or private;
// from anywhere else it could be forged, and the peer address is used.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil || !(peer.IsLoopback() || peer.IsPrivate()) {
		return host
	}
	xff := r.Header.Values("X-Forwarded-For")
	if len(xff) == 0 {
		return host
	}
	parts := strings.Split(xff[len(xff)-1], ",")
	if ip, err := netip.ParseAddr(strings.TrimSpace(parts[len(parts)-1])); err == nil {
		return ip.String()
	}
	return host
}

// limitNewSessions answers 429 when one address starts too many demo
// families (POST /demo/sessions and /demo/custom-sessions): each one seeds
// dozens of rows that stay until the family is deleted.
func (s *Server) limitNewSessions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && (r.URL.Path == "/api/demo/sessions" || r.URL.Path == "/api/demo/custom-sessions") {
			if !s.sessionLimiter.allow(clientIP(r)) {
				w.Header().Set("Retry-After", "600")
				writeError(w, http.StatusTooManyRequests, errRateLimited.Code, errRateLimited.Message)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// capBody bounds every request body. A declared length over the cap is 413 at
// once; otherwise reading stops at the cap and the validator answers 400.
func capBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > maxBodyBytes {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "the request body is too large")
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}

// securityHeaders sets safe defaults on every API response. A handler may
// override them (a voice note sets its own Cache-Control). HSTS and the
// page CSP belong to Caddy and Next.js, which serve the HTML.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		// Responses are one family's data: never stored by shared caches.
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
