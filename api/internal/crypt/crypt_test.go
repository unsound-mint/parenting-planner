package crypt

import (
	"bytes"
	"fmt"
	"testing"
)

func key(t *testing.T, fill byte) Key {
	k, err := NewKey(bytes.Repeat([]byte{fill}, 32))
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func TestSealOpenRoundTrip(t *testing.T) {
	k := key(t, 1)
	sealed, err := k.Seal("I cried in the car today.")
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("cried")) {
		t.Fatal("the text must not appear in the ciphertext")
	}
	got, err := k.Open(sealed)
	if err != nil || got != "I cried in the car today." {
		t.Errorf("got %q, %v", got, err)
	}
	again, _ := k.Seal("I cried in the car today.")
	if bytes.Equal(sealed, again) {
		t.Error("each seal must use a fresh nonce")
	}
}

func TestOpenRejectsWrongKeyAndTampering(t *testing.T) {
	sealed, _ := key(t, 1).Seal("secret")
	if _, err := key(t, 2).Open(sealed); err == nil {
		t.Error("a wrong key must fail")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := key(t, 1).Open(sealed); err == nil {
		t.Error("altered data must fail")
	}
	if _, err := key(t, 1).Open([]byte{1, 2, 3}); err == nil {
		t.Error("short data must fail")
	}
}

func TestKeyNeverPrints(t *testing.T) {
	k := key(t, 7)
	if s := fmt.Sprintf("%v %+v %#v %s", k, k, k, k); bytes.Contains([]byte(s), []byte{7}) {
		t.Errorf("the key leaked: %q", s)
	}
	if _, err := NewKey(make([]byte, 16)); err == nil {
		t.Error("a short key must be refused")
	}
}

func TestFromEnv(t *testing.T) {
	t.Setenv("DIARY_ENCRYPTION_KEY", "")
	if _, eph, err := FromEnv(); err != nil || !eph {
		t.Errorf("no key: ephemeral=%v err=%v", eph, err)
	}
	t.Setenv("DIARY_ENCRYPTION_KEY", "not base64!!")
	if _, _, err := FromEnv(); err == nil {
		t.Error("a malformed key must be an error")
	}
	t.Setenv("DIARY_ENCRYPTION_KEY", "AAAA")
	if _, _, err := FromEnv(); err == nil {
		t.Error("a short key must be an error")
	}
	t.Setenv("DIARY_ENCRYPTION_KEY", "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=")
	if _, eph, err := FromEnv(); err != nil || eph {
		t.Errorf("a good key: ephemeral=%v err=%v", eph, err)
	}
}
