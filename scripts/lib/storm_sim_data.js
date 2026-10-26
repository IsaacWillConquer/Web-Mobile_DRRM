// Data for the demo-only SIMULATION storm (Ondoy / Ketsana-style, 2009).
// Pure builder so it is unit-tested; scripts/seed_storm_sim.js writes it to
// Firestore `bulletins/simulation`.
//
// Geometry: "now" is ~200 km east of Luzon, forecast crosses Central Luzon
// into the West Philippine Sea. The cone is computed from the forecast
// circles (same code the live fetcher uses), not hand-drawn.
"use strict";

const { buildCone, classifyPagasa } = require("./typhoon_geo");

// Past track, oldest first. The LAST point is the storm's current position.
const TRACK = [
  { lat: 13.6, lng: 129.4, windKph: 55 },
  { lat: 13.9, lng: 128.2, windKph: 60 },
  { lat: 14.2, lng: 127.0, windKph: 65 },
  { lat: 14.5, lng: 125.8, windKph: 72 },
  { lat: 14.7, lng: 124.7, windKph: 78 },
  { lat: 14.9, lng: 123.6, windKph: 85 },
];

const FORECAST = [
  { lat: 15.2, lng: 122.0, hours: 12, label: "12H", windKph: 85, radiusKm: 90 },
  { lat: 15.4, lng: 120.4, hours: 24, label: "24H", windKph: 70, radiusKm: 140 },
  { lat: 15.6, lng: 118.9, hours: 36, label: "36H", windKph: 75, radiusKm: 190 },
];

// JMA's cone starts at a point at the current position.
const NOW_RADIUS_KM = 1;

const SIGNALS = [
  {
    level: 2,
    areas: [
      "Pangasinan", "Nueva Vizcaya", "Quirino", "Aurora", "Nueva Ecija",
      "Zambales", "Tarlac", "Pampanga", "Bulacan", "Quezon",
    ],
  },
  {
    level: 1,
    areas: [
      "Metro Manila", "Bataan", "Rizal", "Cavite", "Laguna", "Batangas",
      "Camarines Norte", "Marinduque", "Occidental Mindoro", "Oriental Mindoro",
      "Ilocos Sur", "La Union", "Benguet", "Isabela", "Mountain Province", "Ifugao",
    ],
  },
];

const HOUR_MS = 3600 * 1000;

/** Plain fields; the seeder adds postedAt/updatedAt. `cone` is a JSON string
 *  because Firestore forbids nested arrays. [now] is injectable for tests.
 *  `overrideLive` makes the app show the simulation even while a real storm is
 *  active (for demos); by default the live storm wins. */
function buildSimulationBulletin(now = new Date(), { overrideLive = false } = {}) {
  const here = TRACK[TRACK.length - 1];
  const cone = buildCone([
    { lat: here.lat, lng: here.lng, radiusKm: NOW_RADIUS_KM },
    ...FORECAST.map((p) => ({ lat: p.lat, lng: p.lng, radiusKm: p.radiusKm })),
  ]);

  // 85 km/h is a Tropical Storm (<93 km/h), so only the gale-force (30 kt)
  // area exists - there is no storm-force (50 kt) area, as for a real TS.
  const galeArea = { lat: here.lat, lng: here.lng, radiusKm: 220 };

  // Positions are valid on the hour, so map captions read "Sun 2PM", not "Sun 1:41PM".
  const base = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);

  return {
    typhoonName: "Ondoy",
    internationalName: "Ketsana",
    stormId: "SIM-ONDOY",
    category: classifyPagasa(here.windKph).name,
    source: "Simulation",
    active: true,
    maxWindsKph: here.windKph,
    gustKph: 115,
    pressureHpa: 985,
    analysisAt: base.toISOString(),
    track: TRACK,
    forecast: FORECAST.map((p) => ({
      ...p,
      validAt: new Date(base.getTime() + p.hours * HOUR_MS).toISOString(),
    })),
    cone: JSON.stringify(cone),
    galeArea,
    dangerRadiusKm: galeArea.radiusKm,
    signals: SIGNALS,
    demo: true,
    simulation: true,
    ...(overrideLive ? { overrideLive: true } : {}),
  };
}

module.exports = { buildSimulationBulletin, NOW_RADIUS_KM };
