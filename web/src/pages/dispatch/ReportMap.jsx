import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ageBucket, formatDuration, tsMillis } from "./constants";
import { STYLE_URL, hideNonPlaceLabels } from "./mapStyle";

const EMPTY_FC = { type: "FeatureCollection", features: [] };
const CENTER = [121.774, 12.8797];

function densityCells(reports) {
  const cells = {};
  reports.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    if (!cells[key]) cells[key] = { key, lat: 0, lng: 0, count: 0, oldestMs: null };
    const cell = cells[key];
    cell.lat += r.lat;
    cell.lng += r.lng;
    cell.count += 1;
    const ms = tsMillis(r.createdAt);
    if (ms != null && (cell.oldestMs == null || ms < cell.oldestMs)) cell.oldestMs = ms;
  });
  const now = Date.now();
  return Object.values(cells).map((c) => ({
    ...c,
    lat: c.lat / c.count,
    lng: c.lng / c.count,
    waitingMs: c.oldestMs != null ? Math.max(0, now - c.oldestMs) : 0,
  }));
}

function buildFeatureCollection(reports, mode, selectedId, rankById = {}, waitingById = {}) {
  const features = [];
  const now = Date.now();
  const waitingFor = (r) => {
    if (waitingById[r.id] != null) return waitingById[r.id];
    const ms = tsMillis(r.createdAt);
    return ms != null ? Math.max(0, now - ms) : 0;
  };

  if (mode === "density") {
    const cells = densityCells(reports);
    const max = Math.max(1, ...cells.map((c) => c.count));
    cells.forEach((c) => {
      features.push({
        type: "Feature",
        properties: {
          id: null,
          label: `${c.count} report${c.count > 1 ? "s" : ""} nearby\nOldest waiting ${formatDuration(c.waitingMs)}`,
          radius: 12 + (c.count / max) * 24,
          color: ageBucket(c.waitingMs).color,
          opacity: 0.35,
          strokeWidth: 1,
        },
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      });
    });
    return { type: "FeatureCollection", features };
  }

  reports.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    const selected = r.id === selectedId;
    const rank = rankById[r.id];
    const waiting = waitingFor(r);
    features.push({
      type: "Feature",
      properties: {
        id: r.id,
        label: `${r.disasterType} · ${r.status}${
          rank ? `\n#${rank} in queue` : ""
        }\nWaiting ${formatDuration(waiting)}`,
        radius: selected ? 10 : 7,
        color: ageBucket(waiting).color,
        opacity: 1,
        strokeWidth: selected ? 3 : 2,
      },
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    });
  });
  return { type: "FeatureCollection", features };
}

export default function ReportMap({
  reports,
  selectedId,
  onSelect,
  mode = "pins",
  rankById = {},
  waitingById = {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const data = useMemo(
    () => buildFeatureCollection(reports, mode, selectedId, rankById, waitingById),
    [reports, mode, selectedId, rankById, waitingById],
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    let layersAdded = false;

    const addLayers = (map) => {
      if (cancelled || layersAdded) return;
      if (map.getSource("reports")) {
        layersAdded = true;
        setReady(true);
        return;
      }
      map.addSource("reports", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "reports",
        type: "circle",
        source: "reports",
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["get", "strokeWidth"],
        },
      });

      map.on("click", "reports", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current?.(id);
      });
      map.on("mouseenter", "reports", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (f) {
          popupRef.current
            .setLngLat(f.geometry.coordinates)
            .setText(f.properties.label ?? "")
            .addTo(map);
        }
      });
      map.on("mousemove", "reports", (e) => {
        const f = e.features?.[0];
        if (f && popupRef.current) popupRef.current.setLngLat(f.geometry.coordinates);
      });
      map.on("mouseleave", "reports", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });

      layersAdded = true;
      setReady(true);
    };

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      center: CENTER,
      zoom: 6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("error", (e) => {
      console.error("[maplibre]", e?.error ?? e);
      if (!layersAdded) setMapError(true);
    });
    // Add our pin layer as soon as the style is ready (independent of tiles).
    map.on("style.load", () => {
      hideNonPlaceLabels(map);
      addLayers(map);
    });
    map.on("load", () => {
      hideNonPlaceLabels(map);
      addLayers(map);
      map.resize();
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource("reports");
    if (source) source.setData(data);
  }, [ready, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const selected = reports.find((r) => r.id === selectedId);
    if (selected?.lat != null && selected?.lng != null) {
      map.flyTo({ center: [selected.lng, selected.lat], zoom: 13, duration: 600 });
    }
  }, [ready, selectedId, reports]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {mapError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-sm">
            Map failed to load.
          </p>
        </div>
      ) : null}
    </div>
  );
}
