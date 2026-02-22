// tools/fetch_wrd_list.cjs
import fs from "node:fs/promises";
import querystring from "node:querystring";

const ENDPOINT = "https://wrd.mgm.gov.tr/Radar/Search";
const PAGE_SIZE = 100;

async function fetchPage(start) {
  const body = querystring.stringify({
    draw: 1,
    start,
    length: PAGE_SIZE,
    // フィルタ類は空でOK
    search: "",
  });

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function main() {
  const all = [];
  let start = 0;
  let total = null;

  for (;;) {
    const json = await fetchPage(start);

    if (total === null) {
      total = json.recordsTotal;
      console.log("Total radars:", total);
    }

    all.push(...json.data);
    start += PAGE_SIZE;

    if (all.length >= total) break;
  }

  await fs.mkdir("cache/wrd", { recursive: true });
  await fs.writeFile(
    "cache/wrd/wrd_list_raw.json",
    JSON.stringify(all, null, 2),
    "utf-8"
  );

  console.log("Fetched:", all.length);
}

main().catch(console.error);