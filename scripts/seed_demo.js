#!/usr/bin/env node
//
// Seeds a DEMO snapshot of the rain forecast feed the mobile app renders:
//   - forecasts/rain   (weekly rain per region)
//
// The demo STORM is no longer seeded here: it lives in its own doc and is
// switched on/off with `node seed_storm_sim.js` (see that file), so it can
// never mix with the live JMA feed in bulletins/active.
//
// Writes via the Firestore REST API using the Firebase CLI login (the Admin SDK
// key on this project is IAM-denied). See scripts/lib/firebase_rest.js.
//
// Usage:
//   node seed_demo.js            # write the demo rain data
//   node seed_demo.js --clear    # delete forecasts/rain

const { getAccessToken, setDoc, deleteDoc, nowTs } = require("./lib/firebase_rest");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const clear = process.argv.includes("--clear");

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
  await setDoc(token, PROJECT, "forecasts", "rain", {
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    postedAt: nowTs(),
    windowDays: 7,
    regions: RAIN,
    demo: true,
  });
  console.log(`Wrote forecasts/rain for ${RAIN.length} regions (demo).`);
  console.log("Tip: run `node seed_storm_sim.js` to switch the simulation storm on.");
}

async function clearDemo(token) {
  await deleteDoc(token, PROJECT, "forecasts", "rain");
  console.log("Cleared demo: forecasts/rain deleted.");
}

(async () => {
  const token = await getAccessToken();
  await (clear ? clearDemo(token) : writeDemo(token));
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
