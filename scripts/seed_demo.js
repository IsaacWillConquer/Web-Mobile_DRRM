#!/usr/bin/env node
//
// Seeds a DEMO snapshot of the rain forecast feed the mobile app renders:
//   - forecasts/rain   (7-day rain per province)
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

const fs = require("fs");
const path = require("path");
const { getAccessToken, setDoc, deleteDoc, nowTs } = require("./lib/firebase_rest");
const { provincePoints, demoProvinceRain } = require("./lib/rain_geo");
const { buildSimulationBulletin } = require("./lib/storm_sim_data");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const clear = process.argv.includes("--clear");

// Demo rain per province, heaviest along the simulation storm's path (same
// path as `node seed_storm_sim.js`), so the two demo layers tell one story.
function buildDemoRain() {
  const geo = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "mobile", "assets", "geo", "ph_provinces.geojson"),
      "utf8"
    )
  );
  const bulletin = buildSimulationBulletin();
  const stormPath = [bulletin.track[bulletin.track.length - 1], ...bulletin.forecast];
  return demoProvinceRain(provincePoints(geo), stormPath);
}

async function writeDemo(token) {
  const provinces = buildDemoRain();
  await setDoc(token, PROJECT, "forecasts", "rain", {
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
    postedAt: nowTs(),
    windowDays: 7,
    provinces,
    demo: true,
  });
  console.log(`Wrote forecasts/rain for ${provinces.length} provinces (demo).`);
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
