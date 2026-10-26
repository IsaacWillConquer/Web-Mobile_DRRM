import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "../../components/ui";
import { CHART_COLORS } from "../../components/chartColors";
import { STYLE_URL, hideNonPlaceLabels, recolorWater } from "../dispatch/mapStyle";

const DEFAULT_CENTER = [120.8114, 14.8433]; // Malolos, Bulacan

const RANGES = [
  { id: "week", label: "Week", days: 7 },
  { id: "month", label: "Month", days: 30 },
  { id: "year", label: "Year", days: 365 },
  { id: "all", label: "All time", days: null },
];
const SCOPES = [
  { id: "rescues", label: "Rescues only" },
  { id: "all", label: "All reports" },
];
const VIEWS = [
  { id: "heat", label: "Heatmap" },
  { id: "pins", label: "Pins" },
];

// "Rescued" = finished incidents. "All reports" skips things that were never real incidents.
const RESCUED_STATUSES = ["Resolved", "Closed"];
const EXCLUDED_STATUSES = ["Rejected", "Duplicate", "Cancelled"];

const TYPE_COLORS = {
  Flood: CHART_COLORS.blue,
  Fire: CHART_COLORS.red,
  Earthquake: CHART_COLORS.violet,
  Landslide: CHART_COLORS.amber,
  Typhoon: CHART_COLORS.sky,
  "Storm Surge": CHART_COLORS.teal,
  Other: CHART_COLORS.slate,
};

// ["match", ["get","type"], "Flood", "#..", ..., fallback]
const PIN_COLOR_EXPRESSION = [
  "match",
  ["get", "type"],
  ...Object.entries(TYPE_COLORS).flat(),
  CHART_COLORS.slate,
];

// Start (midnight) of the window for a range id; null for "All time".
// Kept out of render so `new Date()` isn't called during render (purity).
function startOfRange(rangeId) {
  const days = RANGES.find((r) => r.id === rangeId)?.days ?? null;
  if (!days) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Chips({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap rounded-xl bg-white p-1 ring-1 ring-inset ring-slate-200"
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              active ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Past incidents on a map: heatmap (hotspots) or pins, filtered by time range and scope.
export default function IncidentMap({ reports, records, typeFilter, areaOf }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const fitKeyRef = useRef("");
  const [ready, setReady] = useState(false);

  const [range, setRange] = useState("month");
  const [scope, setScope] = useState("rescues");
  const [view, setView] = useState("heat");
  const [rangeStart, setRangeStart] = useState(() => startOfRange("month"));

  function changeRange(id) {
    setRange(id);
    setRangeStart(startOfRange(id));
  }

  // ---- data: which reports are on the map right now ----
  const rescuedIds = useMemo(
    () => new Set(records.map((r) => r.reportId).filter(Boolean)),
    [records],
  );

  const points = useMemo(() => {
    const start = rangeStart;

    return reports
      .filter((r) => {
        if (typeof r.lat !== "number" || typeof r.lng !== "number") return false;
        if (EXCLUDED_STATUSES.includes(r.status)) return false;
        if (typeFilter !== "all" && r.disasterType !== typeFilter) return false;
        if (scope === "rescues" && !RESCUED_STATUSES.includes(r.status) && !rescuedIds.has(r.id)) {
          return false;
        }
        if (start) {
          const date = tsToDate(r.createdAt);
          if (!date || date < start) return false;
        }
        return true;
      })
      .map((r) => ({ ...r, _date: tsToDate(r.createdAt) }));
  }, [reports, rescuedIds, rangeStart, scope, typeFilter]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: points.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: {
          type: r.disasterType ?? "Other",
          status: r.status ?? "",
          date: r._date ? r._date.toLocaleDateString() : "",
          people: r.peopleAffected ?? 0,
        },
      })),
    }),
    [points],
  );

  // ~1 km grid cells (2-decimal lat/lng), ranked by number of reports.
  const hotspots = useMemo(() => {
    const cells = new Map();
    points.forEach((r) => {
      const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
      const cell = cells.get(key) ?? { n: 0, lat: 0, lng: 0, people: 0, areas: {}, types: {} };
      cell.n += 1;
      cell.lat += r.lat;
      cell.lng += r.lng;
      cell.people += Number(r.peopleAffected) || 0;
      const area = areaOf ? areaOf(r) : "Unknown area";
      cell.areas[area] = (cell.areas[area] ?? 0) + 1;
      const type = r.disasterType ?? "Other";
      cell.types[type] = (cell.types[type] ?? 0) + 1;
      cells.set(key, cell);
    });

    const top = (counts, skip) =>
      Object.entries(counts)
        .filter(([name]) => name !== skip)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

    return [...cells.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map((c) => {
        const lat = c.lat / c.n;
        const lng = c.lng / c.n;
        return {
          n: c.n,
          people: c.people,
          lat,
          lng,
          label: top(c.areas, "Unknown area") ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
          topType: top(c.types),
        };
      });
  }, [points, areaOf]);

  const maxHotspot = hotspots[0]?.n ?? 1;

  // ---- map setup (once) ----
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("style.load", () => {
      hideNonPlaceLabels(map);
      recolorWater(map);

      map.addSource("incidents", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Hotspots: cool (few) -> hot (many)
      map.addLayer({
        id: "incident-heat",
        type: "heatmap",
        source: "incidents",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 14, 1.8],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 16, 14, 40],
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(14,165,233,0)",
            0.15,
            "rgba(14,165,233,0.45)",
            0.4,
            "#FBBF24",
            0.7,
            "#F59E0B",
            1,
            "#DC2626",
          ],
        },
      });

      // Pins: one dot per report, colored by disaster type
      map.addLayer({
        id: "incident-pins",
        type: "circle",
        source: "incidents",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8],
          "circle-color": PIN_COLOR_EXPRESSION,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      });

      map.on("click", "incident-pins", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties;
        const box = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = p.type;
        const line = document.createElement("div");
        line.style.fontSize = "12px";
        line.textContent = `${p.status}${p.date ? ` · ${p.date}` : ""}`;
        box.append(title, line);
        if (Number(p.people) > 0) {
          const people = document.createElement("div");
          people.style.fontSize = "12px";
          people.textContent = `${p.people} people affected`;
          box.append(people);
        }
        new maplibregl.Popup({ offset: 10 })
          .setLngLat(feature.geometry.coordinates)
          .setDOMContent(box)
          .addTo(map);
      });
      map.on("mouseenter", "incident-pins", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "incident-pins", () => {
        map.getCanvas().style.cursor = "";
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- keep the map in sync ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource("incidents")?.setData(geojson);
  }, [geojson, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("incident-heat", "visibility", view === "heat" ? "visible" : "none");
    map.setLayoutProperty("incident-pins", "visibility", view === "pins" ? "visible" : "none");
  }, [view, ready]);

  // Re-fit the camera when the filters change (not on every live update).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || points.length === 0) return;
    const key = `${range}|${scope}|${typeFilter}`;
    if (fitKeyRef.current === key) return;
    fitKeyRef.current = key;

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 13, essential: true });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((r) => bounds.extend([r.lng, r.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
  }, [points, range, scope, typeFilter, ready]);

  function focusHotspot(h) {
    mapRef.current?.flyTo({ center: [h.lng, h.lat], zoom: 14, essential: true });
  }

  const scopeLabel = scope === "rescues" ? "completed rescues" : "reports";

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <h3 className="font-semibold text-slate-900">Incident map</h3>
          <p className="text-sm text-slate-500">
            {points.length} {scopeLabel}
            {typeFilter !== "all" ? ` · ${typeFilter}` : ""} · by report date
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chips label="Map time range" options={RANGES} value={range} onChange={changeRange} />
          <Chips label="Map incidents" options={SCOPES} value={scope} onChange={setScope} />
          <Chips label="Map view" options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px]">
        <div className="relative h-[460px]">
          <div ref={containerRef} className="h-full w-full" />

          {points.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10">
              <div className="rounded-xl bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow">
                No {scopeLabel} in this range
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 p-2 text-[11px] text-slate-600 shadow ring-1 ring-slate-200">
            {view === "heat" ? (
              <div className="w-32">
                <div
                  className="h-2 rounded-full"
                  style={{
                    background: "linear-gradient(to right, #0EA5E9, #FBBF24, #F59E0B, #DC2626)",
                  }}
                />
                <div className="mt-1 flex justify-between">
                  <span>Fewer</span>
                  <span>More</span>
                </div>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                  <li key={type} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: color }}
                    />
                    {type}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 p-4 lg:border-l lg:border-t-0">
          <h4 className="text-sm font-semibold text-slate-900">Top hotspot areas</h4>
          <p className="mb-3 text-xs text-slate-500">Busiest ~1 km zones. Click one to zoom in.</p>

          {hotspots.length === 0 ? (
            <p className="text-sm text-slate-400">No hotspots in this range.</p>
          ) : (
            <ol className="space-y-2">
              {hotspots.map((h, i) => (
                <li key={`${h.lat}-${h.lng}`}>
                  <button
                    type="button"
                    onClick={() => focusHotspot(h)}
                    className="w-full rounded-xl p-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{h.label}</p>
                        <p className="text-xs text-slate-500">
                          {h.n} {h.n === 1 ? "report" : "reports"}
                          {h.topType ? ` · mostly ${h.topType}` : ""}
                          {h.people > 0 ? ` · ${h.people} people` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-blue-700"
                        style={{ width: `${Math.max(8, (h.n / maxHotspot) * 100)}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}
