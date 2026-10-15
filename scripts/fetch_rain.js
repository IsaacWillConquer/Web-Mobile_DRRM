#!/usr/bin/env node
//
// Fetches a 7-day rainfall forecast per PH region from Open-Meteo and writes
// `forecasts/rain`. Source is Open-Meteo (NOT PAGASA).
//
// Weather data by Open-Meteo.com (CC BY 4.0). Free for non-commercial use.
//
// Local:
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json
//   node fetch_rain.js
//
// CI: run by .github/workflows/fetch-data.yml with the key from a secret.

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});
const db = admin.firestore();

// Names must match mobile/assets/geo/ph_regions.geojson.
const REGIONS = [
  { name: "NCR", lat: 14.6, lng: 121.0 },
  { name: "CAR", lat: 17.0, lng: 121.0 },
  { name: "Ilocos Region", lat: 16.6, lng: 120.5 },
  { name: "Cagayan Valley", lat: 17.0, lng: 121.9 },
  { name: "Central Luzon", lat: 15.3, lng: 120.7 },
  { name: "Calabarzon", lat: 14.1, lng: 121.3 },
  { name: "Mimaropa", lat: 10.5, lng: 119.5 },
  { name: "Bicol Region", lat: 13.4, lng: 123.4 },
  { name: "Western Visayas", lat: 11.0, lng: 122.5 },
  { name: "Central Visayas", lat: 10.2, lng: 123.7 },
  { name: "Eastern Visayas", lat: 11.2, lng: 125.0 },
  { name: "Zamboanga Peninsula", lat: 7.8, lng: 123.0 },
  { name: "Northern Mindanao", lat: 8.4, lng: 124.6 },
  { name: "Davao Region", lat: 7.1, lng: 125.6 },
  { name: "Soccsksargen", lat: 6.5, lng: 124.8 },
  { name: "Caraga", lat: 8.9, lng: 125.6 },
  { name: "ARMM", lat: 6.8, lng: 122.6 },
];

function levelFor(mm) {
  if (mm >= 150) return 3; // heavy
  if (mm >= 50) return 2; // moderate
  return 1; // light
}

async function main() {
  const lats = REGIONS.map((r) => r.lat).join(",");
  const lngs = REGIONS.map((r) => r.lng).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&daily=precipitation_sum&forecast_days=7&timezone=Asia%2FManila`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo -> ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];

  const regions = REGIONS.map((region, i) => {
    const daily = (list[i] && list[i].daily && list[i].daily.precipitation_sum) || [];
    const mm = daily.reduce((sum, v) => sum + (v || 0), 0);
    return { name: region.name, mm: Math.round(mm * 10) / 10, level: levelFor(mm) };
  });

  await db.collection("forecasts").doc("rain").set({
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    postedAt: admin.firestore.FieldValue.serverTimestamp(),
    windowDays: 7,
    regions,
  });

  console.log(`Wrote forecasts/rain for ${regions.length} regions (Open-Meteo).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
