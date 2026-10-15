#!/usr/bin/env node
//
// Seeds the Firestore `bulletins` collection from
// docs/typhoon-bulletins.sample.json.
//
// Usage:
//   cd scripts
//   npm install
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
//   node seed_bulletins.js
//
// Optional:
//   set FIREBASE_PROJECT_ID=drrm-app
//
// Writes are done with the Admin SDK, which bypasses Firestore rules (the
// client-side `bulletins` rule is read-only for signed-in users).

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!keyPath) {
  console.error(
    "Set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account key JSON (Project settings > Service accounts > Generate new private key)."
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(keyPath)),
  projectId,
});

const samplePath = path.resolve(
  __dirname,
  "..",
  "docs",
  "typhoon-bulletins.sample.json"
);

async function main() {
  const { bulletins = [] } = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  const db = admin.firestore();
  const batch = db.batch();

  for (const bulletin of bulletins) {
    if (!bulletin.id) {
      console.warn("Skipping bulletin without an id:", bulletin.typhoonName);
      continue;
    }
    const { id, ...doc } = bulletin;
    doc.postedAt = admin.firestore.Timestamp.fromDate(new Date(doc.postedAt));
    doc.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    batch.set(db.collection("bulletins").doc(id), doc, { merge: true });
    console.log(`Queued bulletin ${id} (${doc.typhoonName})`);
  }

  await batch.commit();
  console.log(`Seeded ${bulletins.length} bulletin(s) into 'bulletins'.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
