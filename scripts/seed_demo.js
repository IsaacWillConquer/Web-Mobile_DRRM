#!/usr/bin/env node
//
// Seeds a DEMO snapshot of the hazard feeds the mobile app renders:
//   - bulletins/active   (a real historical storm: TS Ondoy / Ketsana, 2009)
//   - forecasts/rain     (weekly rain per region)
//
// Writes via the Firestore REST API using the Firebase CLI login (the Admin SDK
// key on this project is IAM-denied). See scripts/lib/firebase_rest.js.
//
// Usage:
//   node seed_demo.js            # write the demo data
//   node seed_demo.js --clear    # revert (deactivate bulletin, drop rain)
//
// NOTE: Firestore forbids nested arrays, so `cone` (GeoJSON geometry) is stored
// as a JSON string; the app parses both string and map forms.

const { getAccessToken, setDoc, deleteDoc, nowTs } = require("./lib/firebase_rest");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const clear = process.argv.includes("--clear");

const TRACK = [
  { lat: 14.1, lng: 128.0 },
  { lat: 14.4, lng: 125.8 },
  { lat: 14.9, lng: 123.6 },
  { lat: 15.3, lng: 121.6 },
  { lat: 15.5, lng: 119.8 },
  { lat: 15.6, lng: 116.5 },
  { lat: 15.8, lng: 112.5 },
  { lat: 15.9, lng: 108.5 },
];

const FORECAST = [
  { lat: 15.2, lng: 122.0, hours: 12, label: "12H" },
  { lat: 15.4, lng: 120.4, hours: 24, label: "24H" },
  { lat: 15.6, lng: 119.0, hours: 36, label: "36H" },
];

const CONE = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [123.6, 15.3],
      [122.0, 15.9],
      [120.4, 16.4],
      [119.0, 16.9],
      [119.0, 14.3],
      [120.4, 14.4],
      [122.0, 14.5],
      [123.6, 14.5],
      [123.6, 15.3],
    ],
  ],
});

const SIGNALS = [
  {
    level: 2,
    areas: [
      "Pangasinan",
      "Nueva Vizcaya",
      "Quirino",
      "Aurora",
      "Nueva Ecija",
      "Zambales",
      "Tarlac",
      "Pampanga",
      "Bulacan",
      "Quezon",
    ],
  },
  {
    level: 1,
    areas: [
      "Metro Manila",
      "Bataan",
      "Rizal",
      "Cavite",
      "Laguna",
      "Batangas",
      "Camarines Norte",
      "Marinduque",
      "Occidental Mindoro",
      "Oriental Mindoro",
      "Ilocos Sur",
      "La Union",
      "Benguet",
      "Isabela",
      "Mountain Province",
      "Ifugao",
    ],
  },
];

const RAIN = [
  { name: "NCR", level: 3, mm: 455 },
  { name: "Calabarzon", level: 3, mm: 332 },
  { name: "Central Luzon", level: 2, mm: 120 },
  { name: "Bicol Region", level: 2, mm: 95 },
  { name: "Ilocos Region", level: 1, mm: 40 },
  { name: "Cagayan Valley", level: 1, mm: 45 },
  { name: "CAR", level: 1, mm: 60 },
  { name: "Mimaropa", level: 1, mm: 55 },
  { name: "Western Visayas", level: 1, mm: 35 },
  { name: "Central Visayas", level: 1, mm: 30 },
  { name: "Eastern Visayas", level: 1, mm: 38 },
  { name: "Zamboanga Peninsula", level: 1, mm: 25 },
  { name: "Northern Mindanao", level: 1, mm: 28 },
  { name: "Davao Region", level: 1, mm: 22 },
  { name: "Soccsksargen", level: 1, mm: 20 },
  { name: "Caraga", level: 1, mm: 32 },
  { name: "ARMM", level: 1, mm: 18 },
];

async function writeDemo(token) {
  await setDoc(token, PROJECT, "bulletins", "active", {
    typhoonName: "Ondoy",
    internationalName: "Ketsana",
    category: "Tropical Storm",
    source: "PAGASA",
    sourceUrl:
      "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
    postedAt: nowTs(),
    active: true,
    maxWindsKph: 95,
    track: TRACK,
    forecast: FORECAST,
    cone: CONE,
    dangerRadiusKm: 250,
    signals: SIGNALS,
    demo: true,
    updatedAt: nowTs(),
  });
  console.log("Wrote bulletins/active — Ondoy (Ketsana 2009) demo snapshot.");

  await setDoc(token, PROJECT, "forecasts", "rain", {
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    postedAt: nowTs(),
    windowDays: 7,
    regions: RAIN,
    demo: true,
  });
  console.log(`Wrote forecasts/rain for ${RAIN.length} regions.`);
}

async function clearDemo(token) {
  await setDoc(token, PROJECT, "bulletins", "active", {
    active: false,
    demo: false,
    updatedAt: nowTs(),
  });
  await deleteDoc(token, PROJECT, "forecasts", "rain");
  console.log("Cleared demo: bulletins/active deactivated, forecasts/rain deleted.");
}

(async () => {
  const token = await getAccessToken();
  await (clear ? clearDemo(token) : writeDemo(token));
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
