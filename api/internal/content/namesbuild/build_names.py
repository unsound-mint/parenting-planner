#!/usr/bin/env python3
"""Builds api/internal/content/baby_names.json, the catalog behind the names quest.

Three stages, each writing a cache file into a work directory (not the repo):

  candidates  Wiktionary categories per heritage list -> candidates.json
              ("English female given names from Irish", "Spanish male given names", ...).
  ssa         Run ssa_extract.mjs on the SSA national file (names.zip) with
              candidates.json. It keeps names that US parents actually use and
              adds rank, count and a trend per sex -> ssa.json. See the note in
              ssa_extract.mjs on how to get names.zip.
  etymology   Fetch the Wiktionary entry of every kept name and save its
              etymology text and URL -> etymology.json. A person reads these and
              writes one short paraphrased meaning per name in meanings.json
              (committed next to this script), citing the entry.
  assemble    ssa.json + meanings.json -> api/internal/content/baby_names.json.

Usage:
  python3 build_names.py candidates WORK
  node ssa_extract.mjs names.zip WORK/candidates.json > WORK/ssa.json
  python3 build_names.py etymology WORK
  python3 build_names.py assemble WORK

Wiktionary text is CC BY-SA 4.0; we store a short paraphrase and link the
entry. SSA baby name data is a US government work in the public domain.
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

API = "https://en.wiktionary.org/w/api.php"
UA = "parenting-planner-names-build/1.0 (hackathon demo)"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "baby_names.json")

# Heritage lists. Each lists Wiktionary categories; a category that does not
# exist is skipped. Only Latin-script categories can match the SSA spelling, so
# non-Latin languages use the "English ... from X" categories. "neutral" and
# "vintage" come from the SSA data itself (see ssa_extract.mjs).
SEXES = ["male", "female", "unisex"]


def both(fmt):
    return [fmt.format(s) for s in SEXES]


LISTS = {
    "english": {"title": "English", "cats": both("English {} given names from Old English") + both("English {} given names from Middle English") + both("English {} given names from English")},
    "irish": {"title": "Irish", "cats": both("English {} given names from Irish") + both("Irish {} given names")},
    "latino": {"title": "Spanish and Latino", "cats": both("English {} given names from Spanish") + both("Spanish {} given names")},
    "italian": {"title": "Italian", "cats": both("English {} given names from Italian") + both("Italian {} given names")},
    "french": {"title": "French", "cats": both("English {} given names from French") + both("French {} given names")},
    "german": {"title": "German", "cats": both("English {} given names from German") + both("German {} given names")},
    "scandinavian": {"title": "Scandinavian", "cats": both("English {} given names from Old Norse") + both("Norwegian {} given names") + both("Swedish {} given names") + both("Danish {} given names")},
    "slavic": {"title": "Slavic", "cats": both("English {} given names from Russian") + both("English {} given names from Slavic languages") + both("Polish {} given names") + both("Czech {} given names")},
    "arabic": {"title": "Arabic", "cats": both("English {} given names from Arabic")},
    "hebrew": {"title": "Hebrew", "cats": both("English {} given names from Hebrew")},
    "indian": {"title": "Indian", "cats": both("English {} given names from Sanskrit") + both("English {} given names from Hindi")},
    "chinese": {"title": "Chinese", "cats": both("English {} given names from Chinese") + both("English {} given names from Mandarin") + both("English {} given names from Cantonese")},
    "japanese": {"title": "Japanese", "cats": both("English {} given names from Japanese")},
    "korean": {"title": "Korean", "cats": both("English {} given names from Korean")},
    "african": {"title": "African", "cats": both("English {} given names from Yoruba") + both("Yoruba {} given names") + both("English {} given names from Swahili") + both("Swahili {} given names") + both("English {} given names from Igbo") + both("Igbo {} given names") + both("English {} given names from Akan") + both("English {} given names from Zulu") + both("English {} given names from Amharic")},
}


# Romanized names US parents use that Wiktionary does not categorize by
# origin. They still pass the SSA filter, and get a meaning only when their
# Wiktionary entry gives one.
EXTRA = {
    "chinese": ["Mei", "Lian", "Jia", "Ying", "Lin", "Wei", "Ming", "Jun", "Xin", "Yi", "Bao", "Li", "Zhen", "Yu", "Hui", "Lei"],
    "korean": ["Seo", "Ji", "Min", "Joon", "Jiho", "Eun", "Hyun", "Yuna", "Haneul", "Bora", "Jin", "Sung", "Minji", "Seojun"],
}


def add_extras(out):
    for key, names in EXTRA.items():
        for n in names:
            out[key]["names"].setdefault(n, {"title": n, "cat": "manual"})


def get(params, tries=8):
    params = dict(params, format="json", formatversion="2")
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # rate limit or a transient error: back off
            wait = 2 ** i
            print(f"  retry in {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit(f"giving up on {url}")


def ascii_fold(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def candidates(work):
    out = {}
    for key, spec in LISTS.items():
        names = {}
        for cat in spec["cats"]:
            cont = {}
            while True:
                d = get({"action": "query", "list": "categorymembers", "cmtitle": "Category:" + cat, "cmlimit": "500", "cmnamespace": "0", **cont})
                for m in d.get("query", {}).get("categorymembers", []):
                    t = m["title"]
                    folded = ascii_fold(t)
                    # SSA names are one ASCII word of letters.
                    if re.fullmatch(r"[A-Za-z]{2,15}", folded):
                        names.setdefault(folded, {"title": t, "cat": cat})
                if "continue" not in d:
                    break
                cont = d["continue"]
                time.sleep(0.3)
            time.sleep(0.3)
        out[key] = {"title": spec["title"], "names": names}
        print(f"{key}: {len(names)}", file=sys.stderr)
    add_extras(out)
    with open(os.path.join(work, "candidates.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


def section(text, lang):
    """The ==lang== level-2 section of a wikitext page."""
    m = re.search(r"^==\s*" + re.escape(lang) + r"\s*==\s*$", text, re.M)
    if not m:
        return None
    rest = text[m.end():]
    n = re.search(r"^==[^=].*==\s*$", rest, re.M)
    return rest[: n.start()] if n else rest


def etymology_of(sec):
    m = re.search(r"^===+\s*Etymology[^=]*===+\s*$(.*?)(?=^===)", sec, re.M | re.S)
    if m:
        return m.group(1).strip()
    # Some entries put the origin in the definition line instead.
    m = re.search(r"^#\s*(.*)$", sec, re.M)
    return m.group(1).strip() if m else ""


def etymology(work):
    ssa = json.load(open(os.path.join(work, "ssa.json")))
    cands = json.load(open(os.path.join(work, "candidates.json")))
    out = {}
    path = os.path.join(work, "etymology.json")
    if os.path.exists(path):
        out = json.load(open(path))
    for n in ssa["names"]:
        name = n["name"]
        if name in out:
            continue
        title, lang = name, "English"
        for key in n["lists"]:
            c = cands.get(key, {}).get("names", {}).get(name)
            if c:
                title = c["title"]
                if not c["cat"].startswith("English"):
                    lang = c["cat"].split(" ")[0]
                break
        d = get({"action": "parse", "page": title, "prop": "wikitext", "redirects": "1"})
        text = d.get("parse", {}).get("wikitext", "")
        used = lang
        sec = section(text, "English") or section(text, lang)
        if section(text, "English"):
            used = "English"
        ety = etymology_of(sec) if sec else ""
        out[name] = {"title": title, "lang": used, "url": "https://en.wiktionary.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")) + "#" + used, "etymology": ety[:900]}
        time.sleep(0.8)
        with open(path, "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(out)} entries", file=sys.stderr)


def assemble(work, checked):
    ssa = json.load(open(os.path.join(work, "ssa.json")))
    meanings = json.load(open(os.path.join(HERE, "meanings.json")))
    titles = {k: v["title"] for k, v in LISTS.items()}
    titles.update({"neutral": "Gender-neutral", "vintage": "Classic and vintage"})
    names = []
    for n in ssa["names"]:
        m = meanings.get(n["name"]) or {}
        entry = {k: n[k] for k in ("name", "sex", "lists", "ssa", "trend")}
        # The reviewer keeps only the lists the cited entry supports; the
        # computed lists (neutral, vintage) always stay.
        if "lists" in m:
            entry["lists"] = [l for l in n["lists"] if l in m["lists"] or l in ("neutral", "vintage")]
        if not entry["lists"]:
            continue
        if m and m.get("meaning"):
            entry.update(origin=m["origin"], meaning=m["meaning"], source=m["url"])
        else:
            # No sourced meaning: the card shows only the lists it came from.
            entry.update(origin="", meaning="", source="")
        names.append(entry)
    out = {
        "year": ssa["year"],
        "trendYears": ssa["trendYears"],
        "checkedAt": checked,
        "sources": {
            "ssa": "https://www.ssa.gov/oact/babynames/limits.html",
            "meanings": "https://en.wiktionary.org/",
        },
        "lists": [{"id": k, "title": titles[k]} for k in [*LISTS.keys(), "neutral", "vintage"]],
        "names": names,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {len(names)} names to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    stage, work = sys.argv[1], sys.argv[2]
    os.makedirs(work, exist_ok=True)
    if stage == "candidates":
        candidates(work)
    elif stage == "etymology":
        etymology(work)
    elif stage == "assemble":
        assemble(work, sys.argv[3] if len(sys.argv) > 3 else time.strftime("%Y-%m-%d"))
    else:
        raise SystemExit(__doc__)
