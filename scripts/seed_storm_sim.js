#!/usr/bin/env node
//
// Switches the demo-only SIMULATION storm on or off.
// Writes Firestore `bulletins/simulation` (separate from the live feed in
// `bulletins/active`, so a real storm can never inherit demo data).
//
// Same auth as the other seeders: Firestore REST + your Firebase CLI login.
//
// Usage:
//   node seed_storm_sim.js              # simulation ON  (storm appears, badged SIMULATION)
//   node seed_storm_sim.js --off        # simulation OFF
//   node seed_storm_sim.js --migrate    # also deactivate the legacy demo doc in
//                                       # bulletins/active (do this once the app
//                                       # version that reads bulletins/simulation is installed)
//
// Also: `node seed_storm_sim.js --print` shows the document without writing.

const { getAccessToken, setDoc, listDocs, nowTs } = require("./lib/firebase_rest");
const { buildSimulationBulletin } = require("./lib/storm_sim_data");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const args = process.argv.slice(2);
const off = args.includes("--off");
const migrate = args.includes("--migrate");
const printOnly = args.includes("--print");

async function migrateLegacy(token) {
  const docs = await listDocs(token, PROJECT, "bulletins");
  const legacy = docs.find((d) => d.id === "active");
  if (legacy && legacy.demo === true) {
    // PATCH without a mask replaces the doc, which wipes the old demo fields.
    await setDoc(token, PROJECT, "bulletins", "active", {
      active: false,
      demo: false,
      updatedAt: nowTs(),
    });
    console.log("Reset legacy demo in bulletins/active (now inactive).");
  } else {
    console.log("bulletins/active is not a demo doc — left untouched.");
  }
}

(async () => {
  if (printOnly) {
    console.log(JSON.stringify(buildSimulationBulletin(), null, 2));
    return;
  }

  const token = await getAccessToken();

  if (off) {
    await setDoc(token, PROJECT, "bulletins", "simulation", {
      active: false,
      simulation: true,
      demo: true,
      updatedAt: nowTs(),
    });
    console.log("Simulation OFF (bulletins/simulation inactive).");
  } else {
    await setDoc(token, PROJECT, "bulletins", "simulation", {
      ...buildSimulationBulletin(),
      postedAt: nowTs(),
      updatedAt: nowTs(),
    });
    console.log("Simulation ON — bulletins/simulation written (Ondoy, badged SIMULATION).");
  }

  if (migrate) await migrateLegacy(token);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
