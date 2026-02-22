// tools/normalize_wrd.mjs
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

    // 識別子（検索・突合に有用）
    identifiers: {
      radarId,
      wsi: toStr(r.WSI),
      wmoId: toStr(r.WMO_ID),
      numericCountryCode: toStr(r.NUMERIC_CODE),
    },

    name: toStr(r.RADAR_NAME) ?? toStr(r.WMO_ID) ?? radarId,
    alias: toStr(r.RADAR_ALIAS),

    country: {
      name: toStr(r.COUNTRY_NAME),
      alpha2: toStr(r.ALPHA2),
      alpha3: toStr(r.ALPHA3),
    },

    region: {
      wmoRegion: toStr(r.wmoRegion),
      regionId: toStr(r.REGION_ID),
      regionName: toStr(r.REGION_NAME),
      continent: toStr(r.CONTINENT_NAME),
    },

    location: {
      lat: toNum(r.RADAR_LAT),
      lon: toNum(r.RADAR_LON),
      elevation_m: toNum(r.ELEVATION),
      towerHeight_m: toNum(r.TOWER_HEIGHT),
      timeZone: toStr(r.TIME_ZONE_NAME),
      gmtOffset: toStr(r.GMT_OFFSET),
    },

    // 主要装置・運用
    band: toStr(r.BAND),
    polarization: toStr(r.POLARIZATION),
    txType: toStr(r.TX_TYPE),
    rxType: toStr(r.RX_TYPE),
    status: toStr(r.STATUS_NAME),
    installDate: toStr(r.INSTALL_DATE),
    lastUpdate: toStr(r.LAST_UPDATE),

    // 仕様（必要なものだけ。UIに出したければ）
    specs: {
      geometry: toStr(r.GEOMETRY),
      beamWidth_deg: toNum(r.BEAM_WIDTH),
      frequency_mhz: toNum(r.FREQUENCY), // rawは "5625" なので MHz想定（必要なら確認）
      prfMin_hz: toNum(r.PRF_MIN),
      prfMax_hz: toNum(r.PRF_MAX),
      pulseWidth1_us: toNum(r.PULSE_WIDTH_1),
      pulseWidth2_us: toNum(r.PULSE_WIDTH_2),
      lowestAngle_deg: toNum(r.LOWEST_ANGLE),
      highestAngle_deg: toNum(r.HIGHEST_ANGLE),
      cycleTimeMin_s: toNum(r.CYCLETIME_MIN),
      cycleTimeMax_s: toNum(r.CYCLETIME_MAX),
      mds_dbz: toNum(r.MDS_DBZ),
    },

    org: {
      authorityName: toStr(r.AUTHORITY_NAME),
      authorityWeb: toStr(r.AUTHORITY_WEB),
      ownerName: toStr(r.OWNER_NAME),
      manufacturerName: toStr(r.MANUFACTURER_NAME),
      signalProcessorName: toStr(r.SIGNAL_PROCESSOR_NAME),
    },

    links: {
      web: toStr(r.WEB_LINK),
      details,
    },

    // 生データを全部持ちたいならここに入れる（ただしファイルが巨大化するので通常は非推奨）
    // meta: { ...r },
  };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(IN_FILE, "utf-8"));
  const normalized = raw.map(normalizeWrdRow).filter((x) => x.id && x.location.lat !== null && x.location.lon !== null);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(normalized, null, 2), "utf-8");

  console.log(`[WRD] normalized rows: ${normalized.length}`);
  console.log(`[WRD] saved: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[WRD] FAILED:", e);
  process.exit(1);
});