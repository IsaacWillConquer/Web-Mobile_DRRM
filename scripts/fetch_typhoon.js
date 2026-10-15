#!/usr/bin/env node
//
// Fetches the active tropical cyclone track from JMA (RSMC Tokyo) and writes it
// to Firestore `bulletins/active`. Track data only — PAGASA per-province TCWS
// signals are entered separately (admin/console); this script never sets
// `signals`, so an admin's values survive (merge write).
//
// Local:
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json
//   node fetch_typhoon.js
//
// CI: run by .github/workflows/fetch-data.yml with the key from a secret.

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const JMA = "https://www.jma.go.jp/bosai/typhoon/data";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});
const db = admin.firestore();

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function main() {
  const targets = await getJson(`${JMA}/targetTc.json`);
  const ref = db.collection("bulletins").doc("active");

  if (!Array.isArray(targets) || targets.length === 0) {
    await ref.set(
      { active: false, source: "JMA", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log("No active tropical cyclone. Marked bulletins/active inactive.");
    return;
  }

  const tc = targets[0];
  const parts = await getJson(`${JMA}/${tc.tropicalCyclone}/forecast.json`);

  const title = parts.find((p) => p.part === "title");
  const analysis = parts.find((p) => p.advancedHours === 0);
  const forecasts = parts.filter(
    (p) => typeof p.advancedHours === "number" && p.advancedHours > 0
  );

  const trackRaw = [
    ...((analysis && analysis.track && analysis.track.preTyphoon) || []),
    ...((analysis && analysis.track && analysis.track.typhoon) || []),
  ];
  const track = trackRaw.map(([lat, lng]) => ({ lat, lng }));

  const forecast = forecasts.map((f) => ({
    lat: f.center[0],
    lng: f.center[1],
    hours: f.advancedHours,
    label: `${f.advancedHours}H`,
  }));

  const name = (title && title.name && title.name.en) || tc.tropicalCyclone;
  const postedAt = (title && title.issue && title.issue.UTC) || new Date().toISOString();
  const gale = analysis && analysis.galeWarningArea;

  await ref.set(
    {
      typhoonName: name,
      internationalName: name,
      category: "Tropical Cyclone",
      source: "JMA",
      sourceUrl: "https://www.jma.go.jp/bosai/typhoon/",
      postedAt: admin.firestore.Timestamp.fromDate(new Date(postedAt)),
      active: true,
      track,
      forecast,
      dangerRadiusKm: gale ? gale.radius / 1000 : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(
    `Wrote bulletins/active: ${name} (${tc.tropicalCyclone}), ${track.length} track points, ${forecast.length} forecast points.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
