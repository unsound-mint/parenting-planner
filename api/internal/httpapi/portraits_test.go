package httpapi_test

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unsound-mint/parenting-planner/api/internal/httpapi"
	"github.com/unsound-mint/parenting-planner/api/internal/testutil"
)

func portraitsPath(memberID uuid.UUID) string {
	return "/api/members/" + memberID.String() + "/portraits"
}

func portraitPath(memberID, id uuid.UUID) string { return portraitsPath(memberID) + "/" + id.String() }

func portraitImagePath(memberID, id uuid.UUID) string { return portraitPath(memberID, id) + "/image" }

func uploadPortrait(t *testing.T, c *testutil.Client, path, contentType string, body []byte) (int, httpapi.Portrait) {
	t.Helper()
	code, raw := c.Raw(http.MethodPost, path, contentType, bytes.NewReader(body))
	var p httpapi.Portrait
	if code == http.StatusCreated {
		if err := json.Unmarshal(raw, &p); err != nil {
			t.Fatal(err)
		}
	}
	return code, p
}

func listPortraits(t *testing.T, c *testutil.Client, memberID uuid.UUID) []httpapi.Portrait {
	t.Helper()
	var l httpapi.PortraitList
	c.Get(portraitsPath(memberID), http.StatusOK, &l)
	return l.Items
}

func testImage(w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, color.RGBA{uint8(x * 255 / w), uint8(y * 255 / h), 120, 255})
		}
	}
	return img
}

// gpsJPEG is a JPEG with an EXIF APP1 segment whose GPS IFD puts the photo at
// 51°30'N 0°7'W, the way a phone camera writes it.
func gpsJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	var plain bytes.Buffer
	if err := jpeg.Encode(&plain, testImage(w, h), &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	be := binary.BigEndian
	var tiff bytes.Buffer
	tiff.WriteString("MM\x00\x2a")
	_ = binary.Write(&tiff, be, uint32(8))
	// IFD0: one entry, GPSInfo (0x8825) pointing at the GPS IFD at offset 26.
	_ = binary.Write(&tiff, be, uint16(1))
	_ = binary.Write(&tiff, be, []uint16{0x8825, 4})
	_ = binary.Write(&tiff, be, []uint32{1, 26})
	_ = binary.Write(&tiff, be, uint32(0))
	// GPS IFD: LatitudeRef "N", Latitude 51/1 30/1 0/1, LongitudeRef "W", Longitude 0/1 7/1 0/1.
	entries := uint32(4)
	data := 26 + 2 + entries*12 + 4
	_ = binary.Write(&tiff, be, uint16(entries))
	_ = binary.Write(&tiff, be, []uint16{1, 2})
	_ = binary.Write(&tiff, be, uint32(2))
	tiff.WriteString("N\x00\x00\x00")
	_ = binary.Write(&tiff, be, []uint16{2, 5})
	_ = binary.Write(&tiff, be, []uint32{3, data})
	_ = binary.Write(&tiff, be, []uint16{3, 2})
	_ = binary.Write(&tiff, be, uint32(2))
	tiff.WriteString("W\x00\x00\x00")
	_ = binary.Write(&tiff, be, []uint16{4, 5})
	_ = binary.Write(&tiff, be, []uint32{3, data + 24})
	_ = binary.Write(&tiff, be, uint32(0))
	_ = binary.Write(&tiff, be, []uint32{51, 1, 30, 1, 0, 1, 0, 1, 7, 1, 0, 1})
	app1 := append([]byte("Exif\x00\x00"), tiff.Bytes()...)
	seg := []byte{0xFF, 0xE1, byte((len(app1) + 2) >> 8), byte(len(app1) + 2)}
	src := plain.Bytes()
	out := append([]byte{}, src[:2]...) // SOI
	out = append(out, seg...)
	out = append(out, app1...)
	out = append(out, src[2:]...)
	if _, err := jpeg.Decode(bytes.NewReader(out)); err != nil {
		t.Fatalf("test JPEG with EXIF does not decode: %v", err)
	}
	return out
}

func TestPortraitUploadStripsEXIFAndLocation(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	in := gpsJPEG(t, 64, 48)
	if !bytes.Contains(in, []byte("Exif")) {
		t.Fatal("the test image must carry EXIF")
	}
	// The header says PNG; the bytes are a JPEG. The bytes decide.
	code, p := uploadPortrait(t, c, portraitsPath(mom.Id)+"?week=25", "image/png", in)
	if code != http.StatusCreated {
		t.Fatalf("upload: status %d, want 201", code)
	}
	if p.Kind != httpapi.Photo || p.Week == nil || *p.Week != 25 || p.ChildId != nil ||
		p.Width == nil || *p.Width != 64 || p.Height == nil || *p.Height != 48 || p.UploadedBy == nil || *p.UploadedBy != mom.Id {
		t.Errorf("portrait = %+v", p)
	}

	code, out := c.Raw(http.MethodGet, portraitImagePath(mom.Id, p.Id), "", nil)
	if code != http.StatusOK {
		t.Fatalf("image: status %d", code)
	}
	if ct := c.LastHeader.Get("Content-Type"); ct != "image/jpeg" {
		t.Errorf("Content-Type = %q", ct)
	}
	if cc := c.LastHeader.Get("Cache-Control"); !strings.HasPrefix(cc, "private") {
		t.Errorf("Cache-Control = %q, want private", cc)
	}
	if bytes.Contains(out, []byte("Exif")) || bytes.Contains(out, []byte{0xFF, 0xE1}) || bytes.Contains(out, []byte("MM\x00\x2a")) {
		t.Error("the stored image still carries an EXIF segment")
	}
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil || img.Bounds().Dx() != 64 || img.Bounds().Dy() != 48 {
		t.Fatalf("stored image: %v, err %v", img.Bounds(), err)
	}
	// Nothing in the row either: the database holds only the re-encoded bytes.
	var stored []byte
	if err := c.Pool.QueryRow(t.Context(), `SELECT image FROM portraits WHERE id = $1`, p.Id).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(stored, out) {
		t.Error("served bytes differ from the stored ones")
	}
	if got := c.AuditCount(fam.Id, "create", "portrait"); got != 1 {
		t.Errorf("create audit rows = %d, want 1", got)
	}
}

func TestPortraitUploadAcceptsPNGAndReplacesTheSlot(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	before := listPortraits(t, c, mom.Id)
	if len(before) != 5 {
		t.Fatalf("seeded bump drawings = %d, want 5", len(before))
	}
	transparent := image.NewNRGBA(image.Rect(0, 0, 10, 20)) // fully transparent
	var buf bytes.Buffer
	if err := png.Encode(&buf, transparent); err != nil {
		t.Fatal(err)
	}
	code, p := uploadPortrait(t, c, portraitsPath(mom.Id)+"?week=24", "image/png", buf.Bytes())
	if code != http.StatusCreated {
		t.Fatalf("png upload: status %d", code)
	}
	after := listPortraits(t, c, mom.Id)
	if len(after) != 5 || after[0].Id != p.Id || after[0].Kind != httpapi.Photo {
		t.Fatalf("the photo must replace the week 24 drawing: %+v", after)
	}
	_, out := c.Raw(http.MethodGet, portraitImagePath(mom.Id, p.Id), "", nil)
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	// Transparency lands on the paper colour, not black.
	if r, g, b, _ := img.At(5, 5).RGBA(); r>>8 < 0xF0 || g>>8 < 0xF0 || b>>8 < 0xE0 {
		t.Errorf("transparent pixel became %d,%d,%d", r>>8, g>>8, b>>8)
	}
	// A seeded drawing has no image.
	if code, _ := c.Raw(http.MethodGet, portraitImagePath(mom.Id, after[1].Id), "", nil); code != http.StatusNotFound {
		t.Errorf("image of a drawing: status %d, want 404", code)
	}
}

func TestPortraitUploadRejectsOtherTypesAndOversize(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	path := portraitsPath(mom.Id) + "?week=25"

	var g bytes.Buffer
	if err := gif.Encode(&g, testImage(8, 8), nil); err != nil {
		t.Fatal(err)
	}
	// A WebP header (RIFF....WEBP): the standard library cannot decode it, so the browser sends JPEG.
	webp := append([]byte("RIFF\x24\x00\x00\x00WEBPVP8 "), make([]byte, 24)...)
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	for name, body := range map[string][]byte{"gif": g.Bytes(), "webp": webp, "svg": svg, "text": []byte("not an image")} {
		if code, _ := uploadPortrait(t, c, path, "image/jpeg", body); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
	if code, _ := uploadPortrait(t, c, path, "image/jpeg", nil); code != http.StatusBadRequest {
		t.Errorf("empty: status %d, want 400", code)
	}
	// A cut-off JPEG starts like one but does not decode.
	whole := gpsJPEG(t, 32, 32)
	if code, _ := uploadPortrait(t, c, path, "image/jpeg", whole[:len(whole)/2]); code != http.StatusBadRequest {
		t.Errorf("truncated: status %d, want 400", code)
	}
	// A small file with a huge canvas is refused before it is decoded.
	var wide bytes.Buffer
	if err := png.Encode(&wide, image.NewGray(image.Rect(0, 0, 5000, 1))); err != nil {
		t.Fatal(err)
	}
	if code, _ := uploadPortrait(t, c, path, "image/png", wide.Bytes()); code != http.StatusBadRequest {
		t.Errorf("5000 px wide: status %d, want 400", code)
	}
	// Over 1.5 MB: 413 whether the size is declared or only found while reading.
	big := append(gpsJPEG(t, 16, 16), make([]byte, 1536<<10)...)
	if code, _ := uploadPortrait(t, c, path, "image/jpeg", big); code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversize: status %d, want 413", code)
	}
	if code, _ := c.Raw(http.MethodPost, path, "image/jpeg", struct{ *bytes.Reader }{bytes.NewReader(big)}); code != http.StatusRequestEntityTooLarge {
		t.Errorf("oversize without Content-Length: status %d, want 413", code)
	}
	if code, _ := uploadPortrait(t, c, portraitsPath(mom.Id)+"?week=25&month=2", "image/jpeg", whole); code != http.StatusBadRequest {
		t.Errorf("week and month: status %d, want 400", code)
	}
	if code, _ := uploadPortrait(t, c, portraitsPath(mom.Id)+"?month=2", "image/jpeg", whole); code != http.StatusBadRequest {
		t.Errorf("month without a child: status %d, want 400", code)
	}
	if code, _ := uploadPortrait(t, c, portraitsPath(mom.Id)+"?month=2&childId="+uuid.NewString(), "image/jpeg", whole); code != http.StatusNotFound {
		t.Errorf("unknown child: status %d, want 404", code)
	}
	if n := len(listPortraits(t, c, mom.Id)); n != 5 {
		t.Errorf("a rejected upload stored something: %d portraits", n)
	}
}

func TestPortraitsAreFamilyScoped(t *testing.T) {
	ours, theirs := testutil.New(t), testutil.New(t)
	fam := ours.StartDemo("newborn")
	other := theirs.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	otherMom := testutil.Parent(t, other, httpapi.ParentRoleMother)
	leo := fam.Children[0].Id

	code, p := uploadPortrait(t, ours, portraitsPath(mom.Id)+"?month=1&childId="+leo.String(), "image/jpeg", gpsJPEG(t, 20, 20))
	if code != http.StatusCreated || p.ChildId == nil || *p.ChildId != leo || p.Month == nil || *p.Month != 1 {
		t.Fatalf("upload for Leo: %d %+v", code, p)
	}
	// The other family can neither see, fetch nor delete it, nor upload for our child.
	for _, it := range listPortraits(t, theirs, otherMom.Id) {
		if it.Id == p.Id {
			t.Fatal("another family lists our portrait")
		}
	}
	if code, _ := theirs.Raw(http.MethodGet, portraitImagePath(otherMom.Id, p.Id), "", nil); code != http.StatusNotFound {
		t.Errorf("other family image: %d, want 404", code)
	}
	theirs.Delete(portraitPath(otherMom.Id, p.Id), http.StatusNotFound, nil)
	if code, _ := uploadPortrait(t, theirs, portraitsPath(otherMom.Id)+"?month=1&childId="+leo.String(), "image/jpeg", gpsJPEG(t, 8, 8)); code != http.StatusNotFound {
		t.Errorf("upload for another family's child: %d, want 404", code)
	}
	// Our member id in their session is not a member of their family.
	theirs.Get(portraitsPath(mom.Id), http.StatusNotFound, nil)

	// Either parent may delete; the photo is gone, the slot is empty.
	partner := testutil.Parent(t, fam, httpapi.ParentRolePartner)
	ours.Delete(portraitPath(partner.Id, p.Id), http.StatusNoContent, nil)
	ours.Delete(portraitPath(partner.Id, p.Id), http.StatusNotFound, nil)
	if code, _ := ours.Raw(http.MethodGet, portraitImagePath(mom.Id, p.Id), "", nil); code != http.StatusNotFound {
		t.Errorf("deleted image: %d, want 404", code)
	}
	if got := ours.AuditCount(fam.Id, "delete", "portrait"); got != 1 {
		t.Errorf("delete audit rows = %d, want 1", got)
	}
}

func TestPortraitsSeedFromBumpToBaby(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("newborn")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	var got []string
	for _, p := range listPortraits(t, c, mom.Id) {
		if p.Kind != httpapi.Illustration || p.Width != nil {
			t.Errorf("seeded portrait must be a drawing: %+v", p)
		}
		switch {
		case p.Month != nil:
			got = append(got, "m"+itoa(*p.Month))
		case p.Week != nil:
			got = append(got, "w"+itoa(*p.Week))
		}
	}
	if want := "m1 m0 w36 w28 w20 w12"; strings.Join(got, " ") != want {
		t.Errorf("newborn series = %v, want newest first %s", got, want)
	}
	c2 := testutil.New(t)
	pre := c2.StartDemo("preschool")
	if n := len(listPortraits(t, c2, testutil.Parent(t, pre, httpapi.ParentRoleMother).Id)); n != 6 {
		t.Errorf("preschool portraits = %d, want 6", n)
	}
	c3 := testutil.New(t)
	plan := c3.StartDemo("planning")
	if n := len(listPortraits(t, c3, testutil.Parent(t, plan, httpapi.ParentRoleMother).Id)); n != 0 {
		t.Errorf("planning portraits = %d, want 0", n)
	}
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }

func TestPortraitsCaregiverAccess(t *testing.T) {
	c := testutil.New(t)
	p := seededNewbornFamily(c, t)
	leo := p.fam.Children[0].Id
	_, photo := uploadPortrait(t, c, portraitsPath(p.mom.Id)+"?week=40", "image/jpeg", gpsJPEG(t, 12, 12))

	// The grandmother has baby_passport and pregnancy_updates: everything.
	if n := len(listPortraits(t, c, p.grandma.Id)); n != 7 {
		t.Errorf("grandmother sees %d portraits, want 7", n)
	}
	if code, _ := c.Raw(http.MethodGet, portraitImagePath(p.grandma.Id, photo.Id), "", nil); code != http.StatusOK {
		t.Errorf("grandmother bump photo: %d, want 200", code)
	}
	// The nanny has baby_passport only: Leo, not the bump.
	nanny := listPortraits(t, c, p.nanny.Id)
	if len(nanny) != 2 {
		t.Errorf("nanny sees %d portraits, want Leo's 2", len(nanny))
	}
	for _, it := range nanny {
		if it.ChildId == nil || *it.ChildId != leo {
			t.Errorf("nanny sees a bump portrait: %+v", it)
		}
	}
	if code, _ := c.Raw(http.MethodGet, portraitImagePath(p.nanny.Id, photo.Id), "", nil); code != http.StatusNotFound {
		t.Errorf("nanny bump photo: %d, want 404", code)
	}
	// Caregivers never upload or delete.
	if code, _ := uploadPortrait(t, c, portraitsPath(p.grandma.Id)+"?month=1&childId="+leo.String(), "image/jpeg", gpsJPEG(t, 8, 8)); code != http.StatusForbidden {
		t.Errorf("grandmother upload: %d, want 403", code)
	}
	c.Delete(portraitPath(p.grandma.Id, photo.Id), http.StatusForbidden, nil)
	// Without either permission: 403.
	if _, err := c.Pool.Exec(t.Context(), `UPDATE members SET permissions = '{schedule}' WHERE id = $1`, p.nanny.Id); err != nil {
		t.Fatal(err)
	}
	c.Get(portraitsPath(p.nanny.Id), http.StatusForbidden, nil)
	// Caregivers' reads are audited (list and image), a parent's are not.
	if got := c.AuditCount(p.fam.Id, "read", "portrait"); got != 3 {
		t.Errorf("read audit rows = %d, want 3 (two caregiver lists, one image)", got)
	}
}

func TestPortraitPhotosGoWithTheDemo(t *testing.T) {
	c := testutil.New(t)
	fam := c.StartDemo("pregnancy")
	mom := testutil.Parent(t, fam, httpapi.ParentRoleMother)
	uploadPortrait(t, c, portraitsPath(mom.Id)+"?week=25", "image/jpeg", gpsJPEG(t, 12, 12))
	count := func(familyID uuid.UUID, kind string) int {
		var n int
		if err := c.Pool.QueryRow(t.Context(), `SELECT count(*) FROM portraits WHERE family_id = $1 AND kind = $2`, familyID, kind).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if count(fam.Id, "photo") != 1 {
		t.Fatal("the photo was not stored")
	}
	// Reset demo: the browser starts a new family and the old one's photos go.
	next := c.StartDemo("newborn")
	if count(fam.Id, "photo") != 0 {
		t.Error("starting a new demo must delete the old family's photos")
	}
	if count(fam.Id, "illustration") != 5 {
		t.Error("the old family's drawings are not personal and may stay")
	}
	// Deleting the family deletes everything.
	nextMom := testutil.Parent(t, next, httpapi.ParentRoleMother)
	uploadPortrait(t, c, portraitsPath(nextMom.Id)+"?month=1&childId="+next.Children[0].Id.String(), "image/jpeg", gpsJPEG(t, 12, 12))
	c.Delete("/api/family", http.StatusNoContent, nil)
	if count(next.Id, "photo")+count(next.Id, "illustration") != 0 {
		t.Error("deleting the family must delete its portraits")
	}
}
