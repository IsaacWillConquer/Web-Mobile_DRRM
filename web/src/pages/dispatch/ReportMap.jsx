import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PRIORITY_COLORS } from "./constants";

const DENSITY_COLORS = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#2563eb",
};

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 13, { duration: 0.6 });
  }, [position, map]);
  return null;
}

function densityCells(reports) {
  const cells = {};
  reports.forEach((r) => {
    if (r.lat == null || r.lng == null) return;
    const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    if (!cells[key]) {
      cells[key] = { key, lat: 0, lng: 0, count: 0, priority: "low" };
    }
    const cell = cells[key];
    cell.lat += r.lat;
    cell.lng += r.lng;
    cell.count += 1;
    if (r.priority === "high" || (r.priority === "medium" && cell.priority !== "high")) {
      cell.priority = r.priority;
    }
  });
  return Object.values(cells).map((c) => ({
    ...c,
    lat: c.lat / c.count,
    lng: c.lng / c.count,
  }));
}

export default function ReportMap({ reports, selectedId, onSelect, mode = "pins" }) {
  const selected = reports.find((r) => r.id === selectedId);
  const position =
    selected && selected.lat != null && selected.lng != null
      ? [selected.lat, selected.lng]
      : null;

  const cells = useMemo(() => densityCells(reports), [reports]);
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  return (
    <MapContainer
      center={[12.8797, 121.774]}
      zoom={6}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter position={position} />

      {mode === "density"
        ? cells.map((cell) => (
            <CircleMarker
              key={cell.key}
              center={[cell.lat, cell.lng]}
              radius={12 + (cell.count / maxCount) * 24}
              pathOptions={{
                color: "#ffffff",
                weight: 1,
                fillColor: DENSITY_COLORS[cell.priority] ?? "#64748B",
                fillOpacity: 0.35,
              }}
            >
              <Tooltip>{`${cell.count} report${cell.count > 1 ? "s" : ""} nearby`}</Tooltip>
            </CircleMarker>
          ))
        : reports.map(
            (report) =>
              report.lat != null &&
              report.lng != null && (
                <CircleMarker
                  key={report.id}
                  center={[report.lat, report.lng]}
                  radius={selectedId === report.id ? 10 : 7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: PRIORITY_COLORS[report.priority] ?? "#64748B",
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => onSelect(report.id) }}
                >
                  <Tooltip>
                    {report.disasterType} · {report.status}
                    <br />
                    Priority: {report.priority ?? "—"}
                  </Tooltip>
                </CircleMarker>
              ),
          )}
    </MapContainer>
  );
}
