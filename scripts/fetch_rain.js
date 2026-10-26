#!/usr/bin/env node
//
// Fetches a 7-day rainfall forecast for every Philippine province from
// Open-Meteo and writes `forecasts/rain`. Source is Open-Meteo (NOT PAGASA).
// One forecast point per province, taken from the app's own provinces GeoJSON
// (mobile/assets/geo/ph_provinces.geojson), so names always match the map.
//
// Weather data by Open-Meteo.com (CC BY 4.0). Free for non-commercial use.
//
// Local:
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json
//   node fetch_rain.js             # fetch + write
//   node fetch_rain.js --dry-run   # fetch + print a summary, write nothing (no key needed)
//
// CI: run by .github/workflows/fetch-data.yml with the key from a secret.

const fs = require("fs");
const path = require("path");
const { provincePoints, chunk, buildProvinceRain } = require("./lib/rain_geo");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const GEO = path.join(__dirname, "..", "mobile", "assets", "geo", "ph_provinces.geojson");
const BATCH = 30; // locations per Open-Meteo request
const dryRun = process.argv.includes("--dry-run");

let admin = null;
let db = null;
if (!dryRun) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON.");
    process.exit(1);
  }
  admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  db = admin.firestore();
}

async function fetchBatch(points) {
  const lats = points.map((p) => p.lat).join(",");
  const lngs = points.map((p) => p.lng).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&daily=precipitation_sum&forecast_days=7&timezone=Asia%2FManila`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo -> ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data]; // a single location is not wrapped in an array
}

async function main() {
  const points = provincePoints(JSON.parse(fs.readFileSync(GEO, "utf8")));
  if (points.length === 0) throw new Error(`No provinces read from ${GEO}`);

  const results = [];
  for (const batch of chunk(points, BATCH)) results.push(...(await fetchBatch(batch)));

  const provinces = buildProvinceRain(points, results);
  const counts = [1, 2, 3].map((l) => provinces.filter((p) => p.level === l).length);

  if (dryRun) {
    const top = [...provinces].sort((a, b) => b.mm - a.mm).slice(0, 5);
    console.log(`[dry-run] ${provinces.length} provinces. light/moderate/heavy: ${counts.join("/")}`);
    console.log("Wettest:", top.map((p) => `${p.name} ${p.mm} mm`).join(", "));
    return;
  }

  // set() without merge replaces the whole doc, dropping the old per-region data.
  await db.collection("forecasts").doc("rain").set({
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    postedAt: admin.firestore.FieldValue.serverTimestamp(),
    windowDays: 7,
    provinces,
  });
  console.log(
    `Wrote forecasts/rain for ${provinces.length} provinces (Open-Meteo). light/moderate/heavy: ${counts.join("/")}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
