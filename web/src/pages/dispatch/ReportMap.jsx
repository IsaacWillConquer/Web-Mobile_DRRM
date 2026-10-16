import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PRIORITY_COLORS } from "./constants";

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 13, { duration: 0.6 });
  }, [position, map]);
  return null;
}

export default function ReportMap({ reports, selectedId, onSelect }) {
  const selected = reports.find((r) => r.id === selectedId);
  const position =
    selected && selected.lat != null && selected.lng != null
      ? [selected.lat, selected.lng]
      : null;

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
      {reports.map(
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
