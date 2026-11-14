#!/usr/bin/env python3
"""Regenerate api/internal/content/library_topics.json from the topic atlas.

Usage: python3 -I scripts/import-atlas.py /path/to/atlas.json

The atlas is our research file (one topic per parent question, each with
sources opened on their checkedAt date and an evidence label). This keeps
only what the Questions library shows, leaves out topics that are not ready
or that carry a reviewNote (a detail the source pass could not confirm),
drops Wikipedia links (every topic keeps at least one other opened page), and
writes the result sorted by id so a rerun gives a small diff.
library_test.go checks the output (sources, labels, ages, no dangling ids).
"""
import json
import os
import re
import sys
from pathlib import Path

# A reviewNote that only records a recheck which settled the question.
RESOLVED_REVIEW = {"hepatitis-b-birth-dose", "kazakhstan-newborn-vaccine-schedule"}

# The library is for US families for now (Denis, 2026-11-14). These topics are
# about Kazakhstan or CIS practice; set ATLAS_INCLUDE_CIS=1 to bring them back.
# cultureNote (the CIS framing of a topic) is left out for the same reason.
CIS_TOPICS = {
    "naming-the-baby", "labor-routine-interventions-then-and-now", "parental-leave-and-birth-benefits",
    "cis-maternity-practices", "birth-certificate-and-registration", "circumcision-religion-culture-and-sunnet",
    "daily-walks", "hats-warm-dressing-and-drafts", "health-insurance-enrolment", "kazakhstan-newborn-vaccine-schedule",
    "kz-polyclinic-attachment", "seclusion-evil-eye-and-visitors", "specialist-checkups", "gender-stereotypes-cis",
    "clubs-and-sections-culture", "readiness-tests", "school-starting-age", "work-and-maternity-leave-rights",
}
CIS_SOURCE = re.compile(r"\.kz/|\.ru/|orexca\.com|qazaqculture\.com")

# US sources first when a topic has both US and NHS ones.
US_RANK = [r"healthychildren\.org|aap\.org", r"cdc\.gov", r"acog\.org", r"fda\.gov", r"\.gov/"]

def us_first(sources):
    def rank(src):
        for i, pat in enumerate(US_RANK):
            if re.search(pat, src["url"]):
                return i
        return len(US_RANK)
    return sorted(sources, key=rank)

# Emergency and helpline numbers: the app says "your local emergency number",
# with 911 for the US, and names no other country's numbers (the atlas quotes
# NHS pages, which say 999 and 111). library_test.go fails if one slips through.
NUMBER_FIXES = [
    (r"call 999 \(use your local emergency number\)", "call your local emergency number (911 in the US)"),
    (r"\(or your local emergency number; the NHS page says 999\)", "(or your local emergency number)"),
    (r"\(999 or A&E in the UK\)", "(call your local emergency number, 911 in the US)"),
    (r"; the St John Ambulance pages we opened name 999 or 112 in the UK; we did not open a Kazakhstan source", ""),
    (r"NHS 111 equivalent", "local health advice line"),
    (r"\(NHS: GP or 111\)", "(your doctor or local health advice line)"),
    (r"the GP or 111", "your doctor or local health advice line"),
    (r"call 111 or see a GP", "call your doctor or local health advice line"),
]

def fix_numbers(v):
    if isinstance(v, str):
        for pat, rep in NUMBER_FIXES:
            v = re.sub(pat, rep, v)
        return v
    if isinstance(v, list):
        return [fix_numbers(x) for x in v]
    if isinstance(v, dict):
        return {k: (x if k in ("url", "id") else fix_numbers(x)) for k, x in v.items()}
    return v

KEEP = [
    "id", "title", "parentQuestions", "category", "ageStart", "ageEnd",
    "whatToKnow", "whatToDo", "seeClinicianIf", "evidence", "evidenceNote",
    "sources", "related", "urgent",
]

def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    topics = json.loads(Path(sys.argv[1]).read_text())
    kept, skipped = [], []
    for t in topics:
        if t["id"] in CIS_TOPICS and not os.environ.get("ATLAS_INCLUDE_CIS"):
            skipped.append(t["id"])
            continue
        if t.get("ready") is False or (t.get("reviewNote") and t["id"] not in RESOLVED_REVIEW):
            skipped.append(t["id"])
            continue
        out = fix_numbers({k: t[k] for k in KEEP if t.get(k) not in (None, "", [])})
        # Wikipedia is background reading in the atlas, never a cited source here.
        out["sources"] = us_first([s for s in out.get("sources", []) if "wikipedia.org" not in s["url"]
                                   and (os.environ.get("ATLAS_INCLUDE_CIS") or not CIS_SOURCE.search(s["url"]))])
        if not out["sources"]:
            skipped.append(t["id"])
            continue
        kept.append(out)
    ids = {t["id"] for t in kept}
    for t in kept:
        # A related topic that was left out is dropped rather than linked.
        rel = [r for r in t.get("related", []) if r in ids and r != t["id"]]
        if rel:
            t["related"] = rel
        else:
            t.pop("related", None)
    kept.sort(key=lambda t: t["id"])
    dest = Path(__file__).resolve().parent.parent / "api/internal/content/library_topics.json"
    dest.write_text(json.dumps(kept, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(kept)} topics to {dest}; left out {len(skipped)}: {', '.join(skipped)}")

if __name__ == "__main__":
    main()
