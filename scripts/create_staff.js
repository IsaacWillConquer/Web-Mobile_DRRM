#!/usr/bin/env node
//
// Creates (or updates) a staff account and sets users/{uid}.role.
//
// Usage:
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\key.json
//   node create_staff.js <email> <password> <role> [name]
//
// role: admin | dispatcher | rescueTeam | dmo

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const [email, password, role, name] = process.argv.slice(2);
const STAFF_ROLES = ["admin", "dispatcher", "rescueTeam", "dmo"];

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON.");
  process.exit(1);
}
if (!email || !password || !STAFF_ROLES.includes(role)) {
  console.error("Usage: node create_staff.js <email> <password> <admin|dispatcher|rescueTeam|dmo> [name]");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId,
});

async function main() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    if (password) await admin.auth().updateUser(user.uid, { password });
    console.log(`Auth user exists: ${email} (${user.uid})`);
  } catch {
    user = await admin.auth().createUser({
      email,
      password,
      displayName: name || email,
    });
    console.log(`Created Auth user: ${email} (${user.uid})`);
  }

  await admin.firestore().collection("users").doc(user.uid).set(
    {
      name: name || email,
      email,
      role,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`users/${user.uid}.role = ${role}`);
  console.log(`Done. Sign in on the web with ${email} / ${password}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
