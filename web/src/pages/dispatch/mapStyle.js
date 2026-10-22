// Web basemap: OpenFreeMap Positron (calm grey). We pass the style URL directly
// and hide non-place labels after `style.load` in ReportMap (see there).
export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Symbol source-layers hidden so only place/boundary names remain.
export const DROPPED_LABEL_LAYERS = new Set([
  "transportation_name",
  "housenumber",
  "poi",
  "poi_label",
  "aerodrome_label",
  "transit",
  "transit_stop_label",
  "water_name",
  "waterway",
  "waterway_label",
  "mountain_peak_label",
  "highway_shield",
]);

export function hideNonPlaceLabels(map, droppedLayers = DROPPED_LABEL_LAYERS) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    if (droppedLayers.has(layer["source-layer"])) {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      } catch {
        // layer not present — ignore
      }
    }
  }
}
