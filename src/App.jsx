import { useEffect, useMemo, useRef, useState } from "react";
import FlexSearch from "flexsearch";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

function tokenize(q) {
  return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function highlight(text, token) {
  if (!text) return null;
  if (!token) return text;
  const lower = String(text).toLowerCase();
  const t = String(token).toLowerCase();
  const idx = lower.indexOf(t);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + t.length);
  const after = text.slice(idx + t.length);
  return (
    <>
      {before}
      <mark>{match}</mark>
      {after}
    </>
  );
}

function normalizeBand(band) {
  const s = String(band ?? "")
    .trim()
    .toUpperCase()
    .replace(/[- ]/g, "");
  if (!s) return "";
  const c = s[0];
  if (["S", "C", "X"].includes(c)) return c;
  return "";
}

function normalizeStatus(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("operational")) return "Operational";
  if (s.includes("planned")) return "Planned";
  if (s.includes("construction")) return "Under Construction";
  if (s.includes("decommission")) return "Decommissioned";
  return "";
}

function normalizeCountry(r) {
  const raw =
    (r.country_iso3 && r.country_iso3 !== "" ? r.country_iso3 : null) ??
    r.country_name ??
    r.country?.alpha3 ??
    r.country?.name ??
    "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.length === 3 && /^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
  return s;
}

// Leaflet marker icon fix (Vite/ESM)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL(
    "leaflet/dist/images/marker-icon-2x.png",
    import.meta.url
  ).toString(),
  iconUrl: new URL(
    "leaflet/dist/images/marker-icon.png",
    import.meta.url
  ).toString(),
  shadowUrl: new URL(
    "leaflet/dist/images/marker-shadow.png",
    import.meta.url
  ).toString(),
});

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, points]);

  return null;
}

function MapRefSetter({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => { mapRef.current = null; };
  }, [map, mapRef]);
  return null;
}

export default function App() {
  const [data, setData] = useState([]);
  const [index, setIndex] = useState(null);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBands, setSelectedBands] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/radars_v2.json");
      const records = await res.json();
      setData(records);

      const idx = new FlexSearch.Index({ tokenize: "forward" });
      records.forEach((r, i) => idx.add(i, r.tags ?? ""));
      setIndex(idx);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(query);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setQuery(q);
      setSearchQuery(q);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [searchQuery]);

  const searchToken = useMemo(
    () => (tokenize(searchQuery)[0] ?? ""),
    [searchQuery]
  );

  const flyToRecord = (record) => {
    if (!record) return;
    setSelectedId(record.id);
    const lat = record.location?.lat ?? null;
    const lon = record.location?.lon ?? null;
    if (lat != null && lon != null) mapRef.current?.flyTo([lat, lon], 10);
  };

  const results = useMemo(() => {
    if (!index) return [];

    const tokens = tokenize(searchQuery);
    if (tokens.length === 0) return data;

    const sets = tokens.map((t) => new Set(index.search(t)));
    const intersection = sets.reduce(
      (a, b) => new Set([...a].filter((x) => b.has(x)))
    );
    return [...intersection].map((i) => data[i]);
  }, [searchQuery, index, data]);

  const bandFilteredResults = useMemo(() => {
    if (selectedBands.size === 0) return results;
    return results.filter((r) => selectedBands.has(normalizeBand(r.band)));
  }, [results, selectedBands]);

  const statusFilteredResults = useMemo(() => {
    if (selectedStatuses.size === 0) return bandFilteredResults;
    return bandFilteredResults.filter((r) =>
      selectedStatuses.has(normalizeStatus(r.status))
    );
  }, [bandFilteredResults, selectedStatuses]);

  const filteredResults = useMemo(() => {
    if (!selectedCountry) return statusFilteredResults;
    return statusFilteredResults.filter(
      (r) => normalizeCountry(r) === selectedCountry
    );
  }, [statusFilteredResults, selectedCountry]);

  const countriesAvailable = useMemo(() => {
    const set = new Set();
    data.forEach((r) => {
      const c = normalizeCountry(r);
      if (c) set.add(c);
    });
    const arr = [...set].sort((a, b) => a.localeCompare(b));
    if (typeof window !== "undefined") {
      console.log("countriesAvailable.length", arr.length);
    }
    return arr;
  }, [data]);

  const mapPoints = useMemo(() => {
    return filteredResults
      .map((r) => {
        const lat = r.location?.lat ?? null;
        const lon = r.location?.lon ?? null;
        if (lat === null || lon === null) return null;

        return {
          id: r.id,
          site: r.site_name ?? r.name ?? r.id,
          country:
            (r.country_iso3 && r.country_iso3 !== "" ? r.country_iso3 : null) ??
            r.country_name ??
            r.country?.alpha3 ??
            r.country?.name ??
            "",
          band: r.band ?? "",
          lat,
          lon,
        };
      })
      .filter(Boolean);
  }, [filteredResults]);

  const BAND_OPTIONS = [
    { value: "S", label: "S-band" },
    { value: "C", label: "C-band" },
    { value: "X", label: "X-band" },
  ];

  const STATUS_OPTIONS = [
    "Operational",
    "Planned",
    "Under Construction",
    "Decommissioned",
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h2>Weather Radar Finder</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 520px", gap: 16 }}>
        {/* LEFT */}
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setSearchQuery("");
                setSelectedId(null);
              } else if (e.key === "Enter") {
                if (filteredResults.length > 0) {
                  flyToRecord(filteredResults[0]);
                }
              }
            }}
            placeholder="例: japan C D"
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 8,
              fontSize: 14,
              marginBottom: 10,
            }}
          />

          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, marginRight: 4 }}>Band:</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedBands.size === 0}
                onChange={() => setSelectedBands(new Set())}
              />
              <span>All</span>
            </label>
            {BAND_OPTIONS.map((b) => (
              <label key={b.value} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedBands.has(b.value)}
                  onChange={(e) => {
                    setSelectedBands((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(b.value);
                      else next.delete(b.value);
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, marginRight: 4 }}>Status:</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedStatuses.size === 0}
                onChange={() => setSelectedStatuses(new Set())}
              />
              <span>All</span>
            </label>
            {STATUS_OPTIONS.map((statusVal) => (
              <label key={statusVal} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedStatuses.has(statusVal)}
                  onChange={(e) => {
                    setSelectedStatuses((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(statusVal);
                      else next.delete(statusVal);
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{statusVal}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>Country:</span>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 13, minWidth: 120 }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">All</option>
              {countriesAvailable.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10 }}>Hits: {filteredResults.length}</div>

          <ul style={{ paddingLeft: 20 }}>
            {filteredResults.map((r) => {
              const site = r.site_name ?? r.name ?? "(no name)";

              const country =
                (r.country_iso3 && r.country_iso3 !== "" ? r.country_iso3 : null) ??
                r.country_name ??
                r.country?.alpha3 ??
                r.country?.name ??
                "";

              const source = r.source_type ?? r.source ?? "";
              const operator =
                r.operator ?? r.org?.authorityName ?? r.org?.ownerName ?? "";

              const band = r.band ?? "";
              const pol = r.polarization ?? "";
              const tx = r.txType ?? "";
              const rx = r.rxType ?? "";
              const status = r.status ?? "";

              const install = r.installDate ?? "";
              const elev =
                r.location?.elevation_m !== null &&
                r.location?.elevation_m !== undefined
                  ? `${r.location.elevation_m} m`
                  : "";

              const lat = r.location?.lat ?? null;
              const lon = r.location?.lon ?? null;

              const handleRowClick = () => flyToRecord(r);

              const tagsRaw = typeof r.tags === "string" ? r.tags : "";
              const tagList = tagsRaw.split(/[,\s;]+/).filter(Boolean);
              const shownTags = tagList.slice(0, 5);
              const tagsOverflow = tagList.length > 5;

              const detailsUrl = r.links?.details ?? null;
              const sourceUrl = r.source_url || r.links?.web || "";

              const specParts = [
                band ? `Band ${band}` : null,
                pol ? `Pol ${pol}` : null,
                tx ? `Tx ${tx}` : null,
                rx ? `Rx ${rx}` : null,
                status ? `Status ${status}` : null,
              ].filter(Boolean);

              const infoParts = [
                operator ? `Operator ${operator}` : null,
                install ? `Install ${install}` : null,
                elev ? `Elev ${elev}` : null,
                lat !== null && lon !== null
                  ? `LatLon ${lat.toFixed(4)}, ${lon.toFixed(4)}`
                  : null,
              ].filter(Boolean);

              const isSelected = r.id === selectedId;

              return (
                <li
                  key={r.id}
                  onClick={handleRowClick}
                  style={{
                    margin: "12px 0",
                    cursor: "pointer",
                    ...(isSelected
                      ? { backgroundColor: "rgba(33, 150, 243, 0.15)", borderLeft: "3px solid #2196f3", paddingLeft: 17 }
                      : {}),
                  }}
                >
                  <div style={{ fontSize: 16 }}>
                    <b>{highlight(site, searchToken)}</b>{" "}
                    <span style={{ opacity: 0.85 }}>
                      {country ? `(${country})` : ""} {source ? ` / ${source}` : ""}
                    </span>
                  </div>

                  {specParts.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>
                      {specParts.join(" / ")}
                    </div>
                  )}

                  {infoParts.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                      {infoParts.join(" / ")}
                    </div>
                  )}

                  {shownTags.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                      Tags: {shownTags.join(", ")}{tagsOverflow ? " …" : ""}
                    </div>
                  )}

                  <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
                    {detailsUrl && (
                      <a href={detailsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        details
                      </a>
                    )}
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        source
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* RIGHT */}
        <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
          <div
            style={{
              height: 700,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #444",
            }}
          >
            <MapContainer
              center={[35.6812, 139.7671]}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FitBounds points={mapPoints} />
              <MapRefSetter mapRef={mapRef} />

              <MarkerClusterGroup chunkedLoading>
                {mapPoints.map((p) => (
                  <Marker key={p.id} position={[p.lat, p.lon]}>
                    <Popup>
                      <div><b>{p.site}</b></div>
                      <div>{p.country} {p.band ? `/ ${p.band}` : ""}</div>
                      <div>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Map shows only records with lat/lon (WRD mostly).
          </div>
        </div>
      </div>
    </div>
  );
}