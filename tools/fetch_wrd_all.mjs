// tools/fetch_wrd_all.cjs
// WRD Radar Search（DataTables）から全件取得してJSON保存
// Node 18+（fetch内蔵）想定

import fs from "node:fs/promises";
import path from "node:path";
import querystring from "node:querystring";

const ENDPOINT = "https://wrd.mgm.gov.tr/Radar/Search";
const OUT_DIR = path.resolve("cache/wrd");
const OUT_FILE = path.join(OUT_DIR, "wrd_list_raw.json");

// 1137件規模なら 100〜200 で十分。大きすぎると失敗しやすいことがあります。
const PAGE_SIZE = 100;

// 通信が不安定なときの保険
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 800; // 指数バックオフの基準
const PAGE_DELAY_MS = 150; // サーバ負荷軽減（必要なら増やす）

const HEADERS = {
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "x-requested-with": "XMLHttpRequest",
  // user-agent を入れたい場合は追加（必須ではないことが多い）
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(start) {
  const body = querystring.stringify({
    draw: 1,
    start,
    length: PAGE_SIZE,
    // DataTables系は色々パラメータを投げることがあるが、
    // 最低限これで通るケースが多い
  });

  let lastErr;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: HEADERS,
        body,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json();

      // 期待する最低限の形チェック（壊れたレスポンス対策）
      if (!json || !Array.isArray(json.data) || typeof json.recordsTotal !== "number") {
        throw new Error(`Unexpected JSON shape at start=${start}`);
      }

      return json;
    } catch (e) {
      lastErr = e;
      const backoff = BASE_DELAY_MS * Math.pow(2, i) + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const all = [];
  let start = 0;
  let total = null;

  while (true) {
    const json = await fetchWithRetry(start);

    if (total === null) {
      total = json.recordsTotal;
      console.log(`[WRD] recordsTotal=${total}`);
    }

    const rows = json.data;
    all.push(...rows);

    console.log(`[WRD] fetched ${all.length}/${total} (start=${start}, got=${rows.length})`);

    if (all.length >= total || rows.length === 0) break;

    start += PAGE_SIZE;
    await sleep(PAGE_DELAY_MS);
  }

  // 念のため重複RADAR_IDを除去（サーバ側の揺れ対策）
  const map = new Map();
  for (const r of all) {
    const id = r?.RADAR_ID;
    if (id) map.set(id, r);
  }
  const deduped = Array.from(map.values());

  await fs.writeFile(OUT_FILE, JSON.stringify(deduped, null, 2), "utf-8");

  console.log(`[WRD] saved: ${OUT_FILE}`);
  console.log(`[WRD] unique rows: ${deduped.length}`);
}

main().catch((e) => {
  console.error("[WRD] FAILED:", e);
  process.exit(1);
});