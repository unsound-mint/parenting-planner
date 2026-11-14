// SSA stage of the names catalog build (see build_names.py).
//
// Reads the SSA national baby names file (names.zip: one yobYYYY.txt per year,
// lines "Name,Sex,Count", sorted by count) and the Wiktionary candidates, and
// keeps the names US parents use, with rank, count and a trend per sex.
//
// Getting names.zip: it is linked as "National data" on
// https://www.ssa.gov/oact/babynames/limits.html. SSA answers scripted
// downloads with 403, so download it in a browser. Two ways to run this file:
//   node ssa_extract.mjs names.zip candidates.json > ssa.json
//   or, in the browser console on that SSA page (same origin, nothing saved):
//   const { extract } = await import(<this file as a blob URL>);
//   copy(JSON.stringify(await extract(await (await fetch("names.zip")).arrayBuffer(), candidates)))
//
// The catalog for 2026-11-14 was produced the second way, in a browser tab on
// ssa.gov, because the download is blocked for scripts.

export const TREND_STEP = 10; // a trend point every ten years from 1950
const PER_LIST = 18; // the most used names of a list
const RARE_PER_LIST = 6; // plus a few rare ones, so the rare end of the slider has cards
const RARE_MAX = 300; // babies in the latest year: at most this many counts as rare
const SPECIAL = 22; // size of the computed lists (neutral, vintage)

// inflate returns the bytes of a raw-deflate stream, in node or a browser.
async function inflate(bytes) {
  if (typeof process !== "undefined" && process.versions?.node) {
    const zlib = await import("node:zlib");
    return new Uint8Array(zlib.inflateRawSync(bytes));
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// unzip lists the entries of a zip archive from its central directory.
async function unzip(buf) {
  const v = new DataView(buf);
  let eocd = buf.byteLength - 22;
  while (eocd >= 0 && v.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    files[name] = { method, size, local };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    names: Object.keys(files),
    async text(name) {
      const f = files[name];
      const start = f.local + 30 + v.getUint16(f.local + 26, true) + v.getUint16(f.local + 28, true);
      const raw = new Uint8Array(buf, start, f.size);
      return dec.decode(f.method === 0 ? raw : await inflate(raw));
    },
  };
}

// year parses one yobYYYY.txt into name -> { F: {rank, count}, M: {rank, count} }.
// Rank is the position within the sex, as in the file (sorted by count).
function parseYear(text) {
  const out = new Map();
  const pos = { F: 0, M: 0 };
  for (const line of text.split(/\r?\n/)) {
    const [name, sex, n] = line.split(",");
    if (!name || !(sex in pos)) continue;
    pos[sex]++;
    const e = out.get(name) ?? {};
    e[sex] = { rank: pos[sex], count: Number(n) };
    out.set(name, e);
  }
  return out;
}

const total = (e) => (e?.F?.count ?? 0) + (e?.M?.count ?? 0);

export async function extract(buf, candidates) {
  const zip = await unzip(buf);
  const years = zip.names.map((n) => /^yob(\d{4})\.txt$/.exec(n)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
  const latest = years.at(-1);
  const trendYears = [];
  for (let y = 1950; y < latest; y += TREND_STEP) trendYears.push(y);
  trendYears.push(latest);
  const load = async (y) => parseYear(await zip.text(`yob${y}.txt`));
  const data = new Map();
  for (const y of new Set([...trendYears, 1910, 1920])) data.set(y, await load(y));
  const now = data.get(latest);

  const picked = new Map(); // name -> lists
  const add = (name, list) => {
    const l = picked.get(name) ?? [];
    if (!l.includes(list)) l.push(list);
    picked.set(name, l);
  };

  // Native-language categories share pan-European names (Daniel, Anna). A name
  // joins a list when Wiktionary says English took it from that language, when
  // it was added by hand, or when it is in at most two lists.
  const lists = new Map();
  for (const spec of Object.values(candidates)) for (const n of Object.keys(spec.names)) lists.set(n, (lists.get(n) ?? 0) + 1);
  const specific = (spec, n) => !spec.names[n].cat?.endsWith(" given names") || spec.names[n].cat.startsWith("English") || lists.get(n) <= 2;

  for (const [list, spec] of Object.entries(candidates)) {
    const used = Object.keys(spec.names)
      .filter((n) => total(now.get(n)) >= 5 && specific(spec, n))
      .sort((a, b) => total(now.get(b)) - total(now.get(a)) || a.localeCompare(b));
    const top = used.slice(0, PER_LIST);
    const rare = used.slice(PER_LIST).filter((n) => total(now.get(n)) <= RARE_MAX);
    const step = Math.max(1, Math.floor(rare.length / RARE_PER_LIST));
    const spread = rare.filter((_, i) => i % step === 0).slice(0, RARE_PER_LIST);
    for (const n of [...top, ...spread]) add(n, list);
  }

  // Gender-neutral: at least 30% of the babies in the latest year were of the other sex.
  const neutral = [...now.entries()]
    .filter(([, e]) => total(e) >= 300 && Math.min(e.F?.count ?? 0, e.M?.count ?? 0) / total(e) >= 0.3)
    .sort((a, b) => total(b[1]) - total(a[1]))
    .slice(0, SPECIAL);
  for (const [n] of neutral) add(n, "neutral");

  // Classic and vintage: in the top 60 for its sex in 1910 or 1920 and still given today.
  const old = (n) => [1910, 1920].some((y) => {
    const e = data.get(y).get(n);
    return (e?.F?.rank ?? 1e9) <= 60 || (e?.M?.rank ?? 1e9) <= 60;
  });
  const vintage = [...now.entries()]
    .filter(([n, e]) => total(e) >= 200 && old(n))
    .sort((a, b) => total(b[1]) - total(a[1]))
    .slice(0, SPECIAL);
  for (const [n] of vintage) add(n, "vintage");

  const names = [...picked.entries()].map(([name, lists]) => {
    const e = now.get(name);
    const f = e.F?.count ?? 0;
    const m = e.M?.count ?? 0;
    const minor = Math.min(f, m) / (f + m);
    return {
      name,
      sex: minor >= 0.25 ? "N" : f > m ? "F" : "M",
      lists,
      ssa: e,
      // Babies given the name in each trend year; 0 means fewer than 5 (SSA leaves those out).
      trend: trendYears.map((y) => total(data.get(y).get(name))),
    };
  });
  names.sort((a, b) => a.name.localeCompare(b.name));
  return { year: latest, trendYears, names };
}

if (typeof process !== "undefined" && process.argv[1]?.endsWith("ssa_extract.mjs")) {
  const fs = await import("node:fs");
  const buf = fs.readFileSync(process.argv[2]);
  const cands = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  const out = await extract(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), Object.fromEntries(Object.entries(cands).map(([k, v]) => [k, v])));
  process.stdout.write(JSON.stringify(out));
}
