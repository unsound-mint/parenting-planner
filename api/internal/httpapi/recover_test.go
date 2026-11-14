package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPanicBecomesInternalError(t *testing.T) {
	h := recoverPanics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/api/plan", nil))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if strings.Contains(w.Body.String(), "boom") {
		t.Errorf("panic text leaked into the response: %s", w.Body.String())
	}
}
