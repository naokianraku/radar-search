import fs from "node:fs/promises";
import path from "node:path";

const IN_FILE = path.resolve("cache/wrd/wrd_list_raw.json");
const OUT_FILE = path.resolve("public/wrd_radars.json");

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v) => (v === null || v === undefined || v === "" ? null : String(v));

function normalizeWrdRow(r) {
  const radarId = toStr(r.RADAR_ID);
  const details = radarId ? `https://wrd.mgm.gov.tr/Radar/Details/${radarId}` : null;

  return {
    source: "WRD",
    id: radarId ? `wrd:${radarId}` : null,

    name: toStr(r.RADAR_NAME) ?? radarId,

    country: {
      name: toStr(r.COUNTRY_NAME),
      alpha2: toStr(r.ALPHA2),
    },

    location: {
      lat: toNum(r.RADAR_LAT),
      lon: toNum(r.RADAR_LON),
      elevation_m: toNum(r.ELEVATION),
    },

    band: toStr(r.BAND),
    polarization: toStr(r.POLARIZATION),
    txType: toStr(r.TX_TYPE),
    rxType: toStr(r.RX_TYPE),

    status: toStr(r.STATUS_NAME),
    installDate: toStr(r.INSTALL_DATE),

    links: {
      web: toStr(r.WEB_LINK),
      details,
    }
  };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(IN_FILE, "utf-8"));
  const normalized = raw.map(normalizeWrdRow);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(normalized, null, 2), "utf-8");

  console.log(`[WRD] normalized rows: ${normalized.length}`);
  console.log(`[WRD] saved: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[WRD] FAILED:", e);
  process.exit(1);
});