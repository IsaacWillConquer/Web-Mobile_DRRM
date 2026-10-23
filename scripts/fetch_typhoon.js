#!/usr/bin/env node
//
// Fetches the active tropical cyclone from JMA (RSMC Tokyo) and writes it to
// Firestore `bulletins/active`: past track, forecast points (with uncertainty
// radius and valid time), forecast cone, and the storm-force / gale-force wind
// areas. Wind speed, gusts, pressure and JMA class come from the separate
// specifications.json (forecast.json has none).
//
// PAGASA per-province TCWS signals are entered separately (console/seed); this
// script keeps an admin's `signals` (merge write) EXCEPT when they are clearly
// stale: left over from a demo/simulation, from a different storm, or from a
// storm that has ended.
//
// Usage:
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json
//   node fetch_typhoon.js                    # fetch + write
//   node fetch_typhoon.js --dry-run          # fetch + print, write nothing (no key needed)
//   node fetch_typhoon.js --fixture f.json [--specs s.json]
//                                            # parse saved forecast.json (+ specifications.json), print only
//
// CI: run by .github/workflows/fetch-data.yml with the key from a secret.

const fs = require("fs");
const { parseJmaForecast, parseJmaSpecifications } = require("./lib/typhoon_geo");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const JMA = "https://www.jma.go.jp/bosai/typhoon/data";

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const fixturePath = argValue("--fixture");
const specsPath = argValue("--specs");
const dryRun = args.includes("--dry-run") || Boolean(fixturePath);

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

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function markInactive() {
  if (dryRun) {
    console.log("[dry-run] No active tropical cyclone. Would mark bulletins/active inactive.");
    return;
  }
  const F = admin.firestore.FieldValue;
  await db.collection("bulletins").doc("active").set(
    {
      active: false,
      source: "JMA",
      // Storm is over: drop everything that belonged to it.
      stormId: F.delete(),
      signals: F.delete(),
      cone: F.delete(),
      demo: F.delete(),
      simulation: F.delete(),
      updatedAt: F.serverTimestamp(),
    },
    { merge: true }
  );
  console.log("No active tropical cyclone. Marked bulletins/active inactive.");
}

async function writeActive(stormId, parsed) {
  const name = parsed.name || stormId;
  let issued = new Date(parsed.issuedAtIso);
  if (Number.isNaN(issued.getTime())) issued = new Date();

  if (dryRun) {
    console.log(
      JSON.stringify({ stormId, name, ...parsed, issuedAtIso: issued.toISOString() }, null, 2)
    );
    return;
  }

  const F = admin.firestore.FieldValue;
  const ref = db.collection("bulletins").doc("active");
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : {};

  const staleSignals =
    existing.demo === true ||
    existing.simulation === true ||
    Boolean(existing.stormId && existing.stormId !== stormId);

  const doc = {
    typhoonName: name,
    internationalName: name,
    stormId,
    category: parsed.category || "Tropical Cyclone",
    source: "JMA",
    sourceUrl: "https://www.jma.go.jp/bosai/typhoon/",
    postedAt: admin.firestore.Timestamp.fromDate(issued),
    active: true,
    track: parsed.track,
    forecast: parsed.forecast,
    maxWindsKph: parsed.maxWindsKph !== null ? parsed.maxWindsKph : F.delete(),
    gustKph: parsed.gustKph !== null ? parsed.gustKph : F.delete(),
    pressureHpa: parsed.pressureHpa !== null ? parsed.pressureHpa : F.delete(),
    jmaClass: parsed.jmaClass || F.delete(),
    dangerRadiusKm: parsed.dangerRadiusKm,
    galeArea: parsed.galeArea || F.delete(),
    stormArea: parsed.stormArea || F.delete(),
    analysisAt: parsed.analysisAt || F.delete(),
    cone: parsed.cone ? JSON.stringify(parsed.cone) : F.delete(), // Firestore forbids nested arrays
    demo: F.delete(),
    simulation: F.delete(),
    updatedAt: F.serverTimestamp(),
  };
  if (staleSignals) doc.signals = F.delete();

  await ref.set(doc, { merge: true });
  console.log(
    `Wrote bulletins/active: ${name} (${stormId}), ${parsed.track.length} track points, ` +
      `${parsed.forecast.length} forecast points, cone ${parsed.cone ? "yes" : "no"}` +
      `${staleSignals ? ", cleared stale signals" : ""}.`
  );
}

async function main() {
  let stormId;
  let parts;
  let specParts = null;

  if (fixturePath) {
    parts = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    if (specsPath) specParts = JSON.parse(fs.readFileSync(specsPath, "utf8"));
    stormId = "FIXTURE";
  } else {
    const targets = await getJson(`${JMA}/targetTc.json`);
    if (!Array.isArray(targets) || targets.length === 0) {
      await markInactive();
      return;
    }
    stormId = targets[0].tropicalCyclone;
    parts = await getJson(`${JMA}/${stormId}/forecast.json`);
    try {
      // Wind speed / intensity live in a separate JMA file.
      specParts = await getJson(`${JMA}/${stormId}/specifications.json`);
    } catch (err) {
      console.warn(`WARN: could not fetch specifications.json (${err.message}); winds stay blank.`);
    }
  }

  const specs = specParts ? parseJmaSpecifications(specParts) : null;
  const parsed = parseJmaForecast(parts, { specs });
  for (const w of parsed.warnings) console.warn(`WARN: ${w}`);

  if (parsed.track.length === 0 && parsed.forecast.length === 0) {
    throw new Error("JMA forecast.json had no usable track or forecast; refusing to write.");
  }
  await writeActive(stormId, parsed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
