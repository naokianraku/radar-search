import fs from "node:fs/promises";
import path from "node:path";

const OPERA_FILE = path.resolve("public/radars.json");
const WRD_FILE = path.resolve("public/wrd_radars.json");
const OUT_FILE = path.resolve("public/radars.json");

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

async function main() {
  const opera = await readJson(OPERA_FILE); // 既存
  const wrd = await readJson(WRD_FILE);     // 今回生成

  // idで重複排除（source prefix付きなら衝突しない想定）
  const map = new Map();
  for (const r of opera) if (r?.id) map.set(r.id, r);
  for (const r of wrd) if (r?.id) map.set(r.id, r);

  const merged = Array.from(map.values());

  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`[MERGE] opera=${opera.length}, wrd=${wrd.length}, merged=${merged.length}`);
  console.log(`[MERGE] saved: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error("[MERGE] FAILED:", e);
  process.exit(1);
});