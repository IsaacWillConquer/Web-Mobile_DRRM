import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLE_URL, hideNonPlaceLabels, recolorWater } from "../dispatch/mapStyle";
import { PRIORITY_COLORS } from "../dispatch/constants";

const DEFAULT_CENTER = [120.8114, 14.8433]; // Malolos, Bulacan
const EMPTY_LINE = { type: "FeatureCollection", features: [] };

function hasPoint(p) {
  return p && p.lat != null && p.lng != null;
}

// Shows where the rescue team is going (red pin) and, once the team starts
// tracking on mobile, where they are right now (blue dot) with a dashed link.
export default function ResponderMap({ destination, responderLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const destMarkerRef = useRef(null);
  const meMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);

  // 1. Create the map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("style.load", () => {
      hideNonPlaceLabels(map);
      recolorWater(map);
      map.addSource("link", { type: "geojson", data: EMPTY_LINE });
      map.addLayer({
        id: "link-line",
        type: "line",
        source: "link",
        paint: { "line-color": "#2563EB", "line-width": 4, "line-dasharray": [2, 2] },
      });
      setReady(true);
    });

    return () => {
      destMarkerRef.current?.remove();
      meMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Destination pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!hasPoint(destination)) return;

    const el = document.createElement("div");
    el.style.cssText =
      "width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);";
    el.style.background = PRIORITY_COLORS[destination.priority] ?? "#DC2626";

    destMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([destination.lng, destination.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 14 }).setText(
          `${destination.disasterType || "Incident"} - rescue destination`,
        ),
      )
      .addTo(map);
  }, [destination, ready]);

  // 3. Live responder dot (+ dashed link to the destination)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    meMarkerRef.current?.remove();
    meMarkerRef.current = null;

    const source = map.getSource("link");
    if (!hasPoint(responderLocation)) {
      source?.setData(EMPTY_LINE);
      return;
    }

    const el = document.createElement("div");
    el.style.cssText =
      "width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25);";
    meMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([responderLocation.lng, responderLocation.lat])
      .setPopup(new maplibregl.Popup({ offset: 12 }).setText("Rescue team (live)"))
      .addTo(map);

    if (hasPoint(destination)) {
      source?.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [responderLocation.lng, responderLocation.lat],
            [destination.lng, destination.lat],
          ],
        },
      });
    }
  }, [responderLocation, destination, ready]);

  // 4. Camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (hasPoint(destination) && hasPoint(responderLocation)) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([destination.lng, destination.lat]);
      bounds.extend([responderLocation.lng, responderLocation.lat]);
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 600 });
    } else if (hasPoint(destination)) {
      map.flyTo({ center: [destination.lng, destination.lat], zoom: 14, essential: true });
    }
  }, [destination, responderLocation, ready]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-full w-full" />
      {!hasPoint(destination) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10">
          <div className="rounded-xl bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow">
            Select an assignment to see where the team is going
          </div>
        </div>
      ) : null}
    </div>
  );
}
