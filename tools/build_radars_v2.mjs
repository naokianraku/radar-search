import fs from "node:fs/promises";
import path from "node:path";

const WRD_FILE = path.resolve("public/wrd_radars_v2.json");
const OPERA_FILE = path.resolve("public/radars.json"); // 既存のOPERA最小スキーマ
const OUT_FILE = path.resolve("public/radars_v2.json");

const TODAY = new Date().toISOString().slice(0, 10);

const toStr = (v) => (v === null || v === undefined ? "" : String(v).trim());
const toTag = (v) =>
  toStr(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function makeTags(parts) {
  const tokens = parts
    .flatMap((p) => toTag(p).split(/\s+/))
    .filter(Boolean);

  const seen = new Set();
  const uniq = [];
  const out = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.join(" ");
}

function operaToWrdCanonical(o) {
  // id例: "OPERA:1128" → "opera:1128" に正規化（衝突回避）
  const rawId = toStr(o.id);
  const id = rawId ? `opera:${rawId.replace(/^OPERA:/i, "")}` : null;

  const country = toStr(o.country_name);
  const site = toStr(o.site_name);
  const operator = toStr(o.operator) || country;
  const band = toStr(o.band).toUpperCase();
  const pol = toStr(o.polarization); // OPERAは "s" 等

  // WRD canonical スキーマに合わせる（location等は不明なのでnull）
  return {
    source: "OPERA",
    id,
    name: site || rawId || id,

    country: {
      name: country || null,
      alpha2: null,
      alpha3: toStr(o.country_iso3) || null,
    },

    location: {
      lat: null,
      lon: null,
      elevation_m: null,
    },

    band: band || null,
    polarization: pol || null,
    txType: null,
    rxType: null,
    status: null,
    installDate: null,

    links: {
      web: toStr(o.source_url) || "https://www.eumetnet.eu/opera",
      details: null,
    },

    // UI移行用のflat互換（WRD側と同じキー名を持たせる）
    source_type: "OPERA",
    source_title: toStr(o.source_title) || "EUMETNET OPERA Database",
    source_url: toStr(o.source_url) || "https://www.eumetnet.eu/opera",
    last_verified: toStr(o.last_verified) || TODAY,
    country_iso3: toStr(o.country_iso3) || "",
    country_name: country || "",
    site_name: site || "",
    operator: operator || "",
    tags: toStr(o.tags) || makeTags([country, site, operator, band, pol, "opera"]),
  };
}

async function main() {
  const wrd = JSON.parse(await fs.readFile(WRD_FILE, "utf-8"));
  const opera = JSON.parse(await fs.readFile(OPERA_FILE, "utf-8"));

  const operaAsWrd = opera.map(operaToWrdCanonical).filter((x) => x.id);

  // idで重複排除（wrd: と opera: で基本衝突しない）
  const map = new Map();
  for (const r of wrd) if (r?.id) map.set(r.id, r);
  for (const r of operaAsWrd) if (r?.id) map.set(r.id, r);

  const merged = Array.from(map.values());

  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`[V2] wrd=${wrd.length}, opera=${opera.length}, operaAsWrd=${operaAsWrd.length}, merged=${merged.length}`);
  console.log(`[V2] saved: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[V2] FAILED:", e);
  process.exit(1);
});