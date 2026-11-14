package billing

import (
	"errors"
	"testing"
	"time"
)

// The expected signature was computed independently:
//
//	printf '1700000000.{"id":"evt_1"}' | openssl dgst -sha256 -hmac whsec_test_secret
const (
	knownSecret = "whsec_test_secret"
	knownBody   = `{"id":"evt_1"}`
	knownTS     = 1700000000
	knownSig    = "248a374f50f943a28b0f6ab50faf9a7e7e29b710fa26df9fb1618b9bf8ea9c9a"
)

func TestVerifySignature(t *testing.T) {
	now := time.Unix(knownTS, 0).Add(time.Minute)
	body := []byte(knownBody)
	valid := "t=1700000000,v1=" + knownSig
	cases := []struct {
		name, header, secret string
		body                 []byte
		now                  time.Time
		ok                   bool
	}{
		{"valid", valid, knownSecret, body, now, true},
		{"valid among rotated signatures and unknown entries", "t=1700000000,v1=00ff,v1=" + knownSig + ",v0=abc,payload=a25aefc6", knownSecret, body, now, true},
		{"tampered body", valid, knownSecret, []byte(`{"id":"evt_2"}`), now, false},
		{"wrong secret", valid, "whsec_other", body, now, false},
		{"too old", valid, knownSecret, body, time.Unix(knownTS, 0).Add(SignatureTolerance + time.Second), false},
		{"from the future", valid, knownSecret, body, time.Unix(knownTS, 0).Add(-SignatureTolerance - time.Second), false},
		{"no v1", "t=1700000000,v0=" + knownSig, knownSecret, body, now, false},
		{"no timestamp", "v1=" + knownSig, knownSecret, body, now, false},
		{"empty header", "", knownSecret, body, now, false},
		{"no secret configured", valid, "", body, now, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := VerifySignature(c.body, c.header, c.secret, c.now)
			if c.ok && err != nil {
				t.Fatalf("want ok, got %v", err)
			}
			if !c.ok && !errors.Is(err, ErrBadSignature) {
				t.Fatalf("want ErrBadSignature, got %v", err)
			}
		})
	}
}

func TestSignatureHeaderRoundTrips(t *testing.T) {
	body := []byte(`{"id":"evt_9","type":"checkout.session.completed"}`)
	h := SignatureHeader(body, knownSecret, knownTS)
	if err := VerifySignature(body, h, knownSecret, time.Unix(knownTS, 0)); err != nil {
		t.Fatal(err)
	}
}
