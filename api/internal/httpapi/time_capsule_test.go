package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func lettersPath(m httpapi.Parent) string { return "/api/members/" + m.Id.String() + "/letters" }

func letterBody(occasion, opens, body, vis string) map[string]any {
	return map[string]any{"occasion": occasion, "opensOn": opens, "body": body, "visibility": vis}
}

func lettersByOccasion(c *testutil.Client, m httpapi.Parent) map[string]httpapi.Letter {
	var l httpapi.LetterList
	c.Get(lettersPath(m), http.StatusOK, &l)
	out := map[string]httpapi.Letter{}
	for _, x := range l.Items {
		out[x.Occasion] = x
	}
	return out
}

func TestLettersThePartnerSeesTheEnvelopeNotTheText(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom, jake := testutil.Parent(t, fam, httpapi.ParentRoleMother), testutil.Parent(t, fam, httpapi.ParentRolePartner)
	var made httpapi.Letter
	c.Post(lettersPath(mom), letterBody("Graduation", "2045-06-01", "Secret words for later.", "private"), http.StatusCreated, &made)
	if made.Body == nil || *made.Body != "Secret words for later." || made.AuthorId != mom.Id {
		t.Errorf("created = %+v", made)
	}
	// Seeded: Emily's "18th birthday" is private, Jake's "First day of school" is shared.
	moms, jakes := lettersByOccasion(c, mom), lettersByOccasion(c, jake)
	if moms["18th birthday"].Body == nil || moms["First day of school"].Body == nil {
		t.Error("Emily reads her own and the one Jake shared")
	}
	if l, ok := jakes["18th birthday"]; !ok || l.Body != nil || l.AuthorId != mom.Id {
		t.Errorf("Jake sees that Emily's letter exists but not its text: %+v", l)
	}
	if jakes["Graduation"].Body != nil {
		t.Error("a private letter leaked to the partner")
	}
	// Jake cannot edit or delete Emily's letter, and cannot find it.
	c.Put(lettersPath(jake)+"/"+made.Id.String(), letterBody("x", "2045-06-01", "x", "partner"), http.StatusNotFound, nil)
	c.Delete(lettersPath(jake)+"/"+made.Id.String(), http.StatusNotFound, nil)
	// Emily shares it: Jake can now read it. She can also edit.
	c.Put(lettersPath(mom)+"/"+made.Id.String(), letterBody("Graduation", "2045-06-01", "Edited and shared.", "partner"), http.StatusOK, nil)
	if got := lettersByOccasion(c, jake)["Graduation"]; got.Body == nil || *got.Body != "Edited and shared." {
		t.Errorf("shared letter: %+v", got)
	}
	// The text is encrypted at rest.
	var plain int
	if err := c.Pool.QueryRow(t.Context(), `SELECT count(*) FROM time_capsule_letters WHERE family_id = $1 AND position(convert_to('Edited', 'UTF8') in body_sealed) > 0`, fam.Id).Scan(&plain); err != nil || plain != 0 {
		t.Errorf("clear text stored: %d %v", plain, err)
	}
	c.Delete(lettersPath(mom)+"/"+made.Id.String(), http.StatusNoContent, nil)
	if _, ok := lettersByOccasion(c, mom)["Graduation"]; ok {
		t.Error("deleted letter is still listed")
	}
}

func TestLettersValidationAndAudit(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	c.Post(lettersPath(mom), letterBody("x", "2020-01-01", "past", "private"), http.StatusBadRequest, nil)
	c.Post(lettersPath(mom), letterBody("x", "2040-01-01", "ok", "family"), http.StatusBadRequest, nil)
	c.Post(lettersPath(mom), letterBody("x", "2040-01-01", "", "private"), http.StatusBadRequest, nil)
	c.Post(lettersPath(mom), letterBody("x", "2040-01-01", strings.Repeat("a", 8001), "private"), http.StatusBadRequest, nil)
	c.Post(lettersPath(mom), letterBody("  ", "2040-01-01", "ok", "private"), http.StatusBadRequest, nil)
	var l httpapi.Letter
	c.Post(lettersPath(mom), letterBody("Wedding day", "2050-01-01", "ok", "private"), http.StatusCreated, &l)
	c.Put(lettersPath(mom)+"/"+uuid.NewString(), letterBody("x", "2050-01-01", "ok", "private"), http.StatusNotFound, nil)
	lettersByOccasion(c, mom)
	for _, a := range []string{"create", "read"} {
		if c.AuditCount(fam.Id, a, "time_capsule_letter") < 1 {
			t.Errorf("%s not audited", a)
		}
	}
	testutil.New(t).Get(lettersPath(mom), http.StatusUnauthorized, nil)
}

func TestLettersAreParentsOnlyAndSeededForEveryFamily(t *testing.T) {
	c := testutil.New(t)
	for _, tmpl := range []string{"planning", "pregnancy", "newborn", "preschool"} {
		fam := c.StartDemo(tmpl)
		mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
		if len(lettersByOccasion(c, mom)) < 2 {
			t.Errorf("%s: want a sealed letter from each parent", tmpl)
		}
		for _, cg := range fam.Caregivers {
			c.Get("/api/members/"+cg.Id.String()+"/letters", http.StatusNotFound, nil)
			c.Delete("/api/members/"+cg.Id.String()+"/letters/"+uuid.NewString(), http.StatusNotFound, nil)
		}
	}
}
