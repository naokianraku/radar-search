const { makeTags, norm } = require("./tags.cjs");

const COUNTRY_TO_ISO3 = {
  Germany: "DEU",
  "United Kingdom": "GBR",
  France: "FRA",
};

function normalizeOpera(rawArray) {
  if (!Array.isArray(rawArray)) throw new Error("OPERA raw must be an array");

  return rawArray.map((r) => {
    const countryName = r.country ?? "";
    const iso3 = COUNTRY_TO_ISO3[countryName] ?? "";

    const site = r.location ?? r.odimcode ?? r.wmocode ?? "unknown";
    const band = (r.band ?? "UNK").toString().toUpperCase();
    const pol = (r.polarization ?? "unknown").toString().toLowerCase();

    // OPERAに「operator」が無い場合があるので、暫定で国名（後で改善可能）
    const operator = r.operator ?? countryName ?? "unknown";

    // 安定ID：OPERA側の "number" があるならそれを優先
    const sourceId = r.number != null ? String(r.number) : `${iso3}_${norm(site)}_${band}`;
    const id = `OPERA:${sourceId}`;

    const sourceUrl = "https://www.eumetnet.eu/opera"; // 入口URL（個別URLがあるなら差し替え）
    const lastVerified = new Date().toISOString().slice(0, 10);

    return {
      id,
      source_type: "OPERA",
      source_title: "EUMETNET OPERA Database",
      source_url: sourceUrl,
      last_verified: lastVerified,

      country_iso3: iso3,
      country_name: countryName,

      site_name: site,
      operator,
      band,
      polarization: pol,

      tags: makeTags([
        countryName,
        iso3,
        site,
        operator,
        band,
        pol,
        "opera",
      ]),
    };
  });
}

module.exports = { normalizeOpera, COUNTRY_TO_ISO3 };