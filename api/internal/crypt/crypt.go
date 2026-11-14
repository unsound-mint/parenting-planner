// Package crypt encrypts the text of private records (the diary) before it is
// stored. AES-256-GCM from the standard library: the key lives only in the
// server environment (DIARY_ENCRYPTION_KEY, 32 bytes, base64), never in the
// repo and never in a response. A fresh random nonce is stored in front of each
// ciphertext, so equal texts do not look equal in the database.
package crypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// Key is a 256-bit key. It prints as "[redacted]" through fmt and slog.
type Key struct{ b [32]byte }

func (Key) String() string               { return "[redacted]" }
func (Key) GoString() string             { return "[redacted]" }
func (Key) LogValue() slog.Value         { return slog.StringValue("[redacted]") }
func (Key) MarshalJSON() ([]byte, error) { return []byte(`"[redacted]"`), nil }

// NewKey returns a key from 32 raw bytes.
func NewKey(raw []byte) (Key, error) {
	var k Key
	if len(raw) != 32 {
		return k, fmt.Errorf("the key must be 32 bytes, got %d", len(raw))
	}
	copy(k.b[:], raw)
	return k, nil
}

// FromEnv reads DIARY_ENCRYPTION_KEY (base64 of 32 bytes). When it is not set it
// makes a random key that lasts until the process stops, and reports ephemeral
// true: that is fine for demo data, which is synthetic and lives in a sandbox, but
// a real deployment must set the key. A key that is set but malformed is an error.
func FromEnv() (key Key, ephemeral bool, err error) {
	v := strings.TrimSpace(os.Getenv("DIARY_ENCRYPTION_KEY"))
	if v == "" {
		raw := make([]byte, 32)
		if _, err := rand.Read(raw); err != nil {
			return Key{}, false, err
		}
		key, err = NewKey(raw)
		return key, true, err
	}
	raw, err := base64.StdEncoding.DecodeString(v)
	if err != nil {
		return Key{}, false, errors.New("DIARY_ENCRYPTION_KEY is not base64")
	}
	key, err = NewKey(raw)
	return key, false, err
}

func (k Key) aead() (cipher.AEAD, error) {
	block, err := aes.NewCipher(k.b[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// Seal encrypts text. The result is nonce followed by ciphertext.
func (k Key) Seal(text string) ([]byte, error) {
	a, err := k.aead()
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, a.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return a.Seal(nonce, nonce, []byte(text), nil), nil
}

// Open decrypts what Seal made. It fails on a wrong key or altered data.
func (k Key) Open(sealed []byte) (string, error) {
	a, err := k.aead()
	if err != nil {
		return "", err
	}
	if len(sealed) < a.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	plain, err := a.Open(nil, sealed[:a.NonceSize()], sealed[a.NonceSize():], nil)
	if err != nil {
		return "", errors.New("cannot decrypt")
	}
	return string(plain), nil
}
