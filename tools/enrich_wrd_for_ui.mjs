import fs from "node:fs/promises";
import path from "node:path";

const IN_FILE = path.resolve("public/wrd_radars.json");
const OUT_FILE = path.resolve("public/wrd_radars_v2.json");

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
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      uniq.push(t);
    }
  }
  return uniq.join(" ");
}

async function main() {
  const wrd = JSON.parse(await fs.readFile(IN_FILE, "utf-8"));

  const out = wrd.map((r) => {
    const country = r?.country?.name ?? "";
    const site = r?.name ?? "";
    const operator = r?.org?.authorityName ?? r?.org?.ownerName ?? ""; // いまは入ってないが将来用
    const band = r?.band ?? "";
    const pol = r?.polarization ?? "";

    // 既存UI(OPERA)互換のflatキーを同居させる（移行を容易に）
    return {
      ...r,
      // flat互換
      country_name: country,
      site_name: site,
      operator: operator || country,
      country_iso3: r?.country?.alpha3 ?? "", // 現状は入ってないので空（必要ならnormalize_wrdを拡張）
      source_type: "WRD",
      source_title: "WMO Weather Radar Database (WRD)",
      source_url: "https://wrd.mgm.gov.tr/",
      tags: makeTags([country, site, operator || country, band, pol, "wrd"]),
    };
  });

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf-8");
  console.log(`[WRD] enriched: ${out.length}`);
  console.log(`[WRD] saved: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[WRD] FAILED:", e);
  process.exit(1);
});