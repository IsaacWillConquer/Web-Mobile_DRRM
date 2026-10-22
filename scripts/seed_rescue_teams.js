#!/usr/bin/env node
//
// Seeds rescue teams + their responder (rescueTeam) accounts for the Bulacan
// area — one team per neighbouring municipality around Malolos.
//
// For each place it:
//   1. creates the Firebase Auth user (Identity Toolkit REST, web API key),
//   2. writes teams/{team-<slug>}   (name, contact, base, memberUids),
//   3. writes users/{uid}           (rescueTeam, active, teamId == team id).
//
// Firestore writes use the Firebase CLI login (Admin SDK key is IAM-denied);
// Auth users are created with the public web API key. Idempotent: re-running
// reuses existing Auth users and overwrites the docs.
//
// Usage: node seed_rescue_teams.js

const fs = require("fs");
const path = require("path");
const { getAccessToken, setDoc, postJson, nowTs } = require("./lib/firebase_rest");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const PASSWORD = "rescue123";

function apiKey() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", "web", ".env"), "utf8");
  const match = env.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (!match) throw new Error("VITE_FIREBASE_API_KEY not found in web/.env");
  return match[1].trim();
}

// Bulacan municipalities around Malolos (approx. town-centre coordinates).
const PLACES = [
  { town: "Malolos", lat: 14.8433, lng: 120.8114 },
  { town: "Calumpit", lat: 14.9167, lng: 120.7667 },
  { town: "Hagonoy", lat: 14.8333, lng: 120.7333 },
  { town: "Paombong", lat: 14.8333, lng: 120.7833 },
  { town: "Guiguinto", lat: 14.8333, lng: 120.8833 },
  { town: "Plaridel", lat: 14.8833, lng: 120.8667 },
  { town: "Pulilan", lat: 14.9000, lng: 120.8500 },
  { town: "Bustos", lat: 14.9500, lng: 120.9167 },
  { town: "Baliwag", lat: 14.9500, lng: 120.9000 },
  { town: "San Ildefonso", lat: 15.0000, lng: 120.9500 },
];

function slug(town) {
  return town.toLowerCase().replace(/[^a-z]/g, "");
}

function contactFor(i) {
  const n = String(1000000 + i * 111111).slice(0, 7);
  return `+63 917 ${n.slice(0, 3)} ${n.slice(3)}`;
}

async function createAuth(key, email, name) {
  const signUp = await postJson(
    "identitytoolkit.googleapis.com",
    `/v1/accounts:signUp?key=${key}`,
    { email, password: PASSWORD, displayName: name, returnSecureToken: false }
  );
  const j = JSON.parse(signUp.body);
  if (j.localId) return j.localId;

  const msg = j.error && j.error.message ? j.error.message : signUp.body;
  if (String(msg).includes("EMAIL_EXISTS")) {
    const signIn = await postJson(
      "identitytoolkit.googleapis.com",
      `/v1/accounts:signInWithPassword?key=${key}`,
      { email, password: PASSWORD, returnSecureToken: false }
    );
    const j2 = JSON.parse(signIn.body);
    if (j2.localId) return j2.localId;
    throw new Error(`sign-in failed for ${email}: ${signIn.body.slice(0, 200)}`);
  }
  throw new Error(`signUp failed for ${email}: ${signUp.body.slice(0, 200)}`);
}

(async () => {
  const key = apiKey();
  const token = await getAccessToken();
  console.log(`Seeding ${PLACES.length} rescue teams...\n`);

  for (let i = 0; i < PLACES.length; i++) {
    const { town, lat, lng } = PLACES[i];
    const teamId = `team-${slug(town)}`;
    const name = `${town} Rescue Team`;
    const email = `${slug(town)}.rescue@drrm.test`;
    const contact = contactFor(i);

    const uid = await createAuth(key, email, name);

    await setDoc(token, PROJECT, "teams", teamId, {
      name: `${town} Rescue`,
      contact,
      base: { lat, lng },
      status: "available",
      memberUids: [uid],
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });

    await setDoc(token, PROJECT, "users", uid, {
      email,
      name,
      phone: contact,
      role: "rescueTeam",
      active: true,
      teamId,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });

    console.log(`  ${`${town} Rescue`.padEnd(22)} -> ${teamId}  ${email}`);
  }

  console.log(`\nDone. ${PLACES.length} teams + responder accounts seeded.`);
  console.log(`All responder logins use password: ${PASSWORD}`);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
