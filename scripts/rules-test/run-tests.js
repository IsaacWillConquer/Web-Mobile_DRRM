#!/usr/bin/env node
//
// Firestore rules conformance tests (run inside the emulator via firebase CLI):
//   firebase emulators:exec --only firestore --project rules-test-drrm "node rules-test/run-tests.js"
// or: npm run test:rules   (from scripts/)
//
// Covers: role matrix, disabled accounts, staff CRUD, PII scope
// (reportContacts = staff + assigned team only), and the fixed-shape
// resident "new_report" ping.

const fs = require("fs");
const path = require("path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = "rules-test-drrm";
const RULES_PATH = path.join(__dirname, "..", "..", "firestore", "firestore.rules");

let env;

function dbFor(uid) {
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
}

const BASE_REPORT = {
  onBehalfOf: "self",
  disasterType: "Flood",
  description: "waist-deep flood",
  lat: 14.85,
  lng: 120.87,
  imageUrls: [],
  status: "Submitted",
  priority: "medium",
  peopleAffected: 2,
  clusterId: null,
  verifiedBy: null,
  history: [],
};

async function seed(admin) {
  const users = {
    res1: { role: "resident", active: true },
    res2: { role: "resident", active: true },
    disp1: { role: "dispatcher", active: true },
    dmo1: { role: "dmo", active: true },
    rt1: { role: "rescueTeam", active: true, teamId: "teamA" },
    rt2: { role: "rescueTeam", active: true, teamId: "teamB" },
    admin1: { role: "admin", active: true },
    off1: { role: "dispatcher", active: false },
  };
  for (const [uid, data] of Object.entries(users)) {
    await admin.collection("users").doc(uid).set(data);
  }
  await admin.collection("reports").doc("r1").set({ ...BASE_REPORT, reporterId: "res1" });
  await admin.collection("reports").doc("r2").set({ ...BASE_REPORT, reporterId: "res2" });
  await admin.collection("reports").doc("rAssigned").set({
    ...BASE_REPORT,
    reporterId: "res2",
    teamId: "teamA",
    status: "Team Assigned",
  });
  await admin.collection("reportContacts").doc("r1").set({
    subject: "self",
    victimName: "Juan",
    victimContact: "+63900",
  });
  await admin.collection("reportContacts").doc("rAssigned").set({
    subject: "self",
    victimName: "Maria",
    victimContact: "+63911",
  });
  await admin.collection("assignments").doc("a1").set({
    reportId: "rAssigned",
    teamId: "teamA",
    status: "dispatched",
    dispatchedBy: "disp1",
  });
  await admin.collection("logs").doc("log1").set({
    uid: "disp1",
    action: "seed",
    details: {},
  });
  await admin.collection("config").doc("dispatch").set({
    dispatcherUids: ["disp1", "admin1"],
  });
}

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, promise) {
  try {
    await promise;
    passed += 1;
  } catch (err) {
    failed += 1;
    failures.push(`  FAIL ${name}\n       ${err?.message?.split("\n")[0] ?? err}`);
  }
}

const allow = (p) => assertSucceeds(p);
const deny = (p) => assertFails(p);

async function run() {
  const resident = () => dbFor("res1");
  const resident2 = () => dbFor("res2");
  const dispatcher = () => dbFor("disp1");
  const dmo = () => dbFor("dmo1");
  const teamA = () => dbFor("rt1");
  const teamB = () => dbFor("rt2");
  const admin = () => dbFor("admin1");
  const disabled = () => dbFor("off1");

  // ---------- FR-01/08: authentication + role access ----------
  await check("resident creates own report", allow(
    resident().collection("reports").add({ ...BASE_REPORT, reporterId: "res1" }),
  ));
  await check("resident cannot spoof another reporter", deny(
    resident().collection("reports").add({ ...BASE_REPORT, reporterId: "res2" }),
  ));
  await check("resident cannot read someone else's report", deny(
    resident2().collection("reports").doc("r1").get(),
  ));
  await check("resident cannot self-escalate role", deny(
    resident().collection("users").doc("res1").update({ role: "admin" }),
  ));
  await check("resident reads own user doc", allow(
    resident().collection("users").doc("res1").get(),
  ));
  await check("resident cannot read other user docs", deny(
    resident().collection("users").doc("disp1").get(),
  ));

  // ---------- disabled accounts lose role access ----------
  await check("disabled dispatcher cannot read reports", deny(
    disabled().collection("reports").get(),
  ));
  await check("disabled account can still read own profile", allow(
    disabled().collection("users").doc("off1").get(),
  ));

  // ---------- FR-05/06/15: staff manage reports ----------
  await check("dispatcher verifies report", allow(
    dispatcher().collection("reports").doc("r1").update({
      status: "Verified",
      verifiedBy: "disp1",
      priority: "high",
      history: [{ status: "Verified", by: "disp1", at: Date.now() }],
    }),
  ));
  await check("dispatcher rejects with reason", allow(
    dispatcher().collection("reports").doc("r1").update({
      status: "Rejected",
      rejectionReason: "test",
      history: [{ status: "Rejected", by: "disp1", at: Date.now() }],
    }),
  ));
  await check("resident cannot change status", deny(
    resident().collection("reports").doc("r1").update({ status: "Verified" }),
  ));
  await check("rescue team cannot change priority", deny(
    teamA().collection("reports").doc("r1").update({ priority: "low" }),
  ));
  await check("assigned rescue team sets report status", allow(
    teamA().collection("reports").doc("rAssigned").update({
      status: "Rescue in Progress",
      history: [{ status: "Rescue in Progress", by: "rt1", at: Date.now() }],
    }),
  ));

  // ---------- FR-07: assignments + clusters ----------
  await check("dispatcher creates assignment", allow(
    dispatcher().collection("assignments").add({
      reportId: "r1",
      teamId: "teamA",
      status: "dispatched",
      dispatchedBy: "disp1",
    }),
  ));
  await check("rescue team updates own assignment status", allow(
    teamA().collection("assignments").doc("a1").update({ status: "accepted", updatedBy: "rt1" }),
  ));
  await check("resident cannot update assignment", deny(
    resident().collection("assignments").doc("a1").update({ status: "accepted" }),
  ));
  await check("dispatcher creates cluster", allow(
    dispatcher().collection("clusters").add({
      center: { lat: 14.85, lng: 120.87 },
      reportIds: ["r1"],
      reportCount: 1,
      peopleAffected: 2,
      priority: "medium",
      status: "open",
    }),
  ));
  await check("resident cannot create cluster", deny(
    resident().collection("clusters").add({ reportIds: [] }),
  ));

  // ---------- FR-11: rescue records ----------
  await check("rescue team records outcome", allow(
    teamA().collection("rescueRecords").add({
      assignmentId: "a1",
      reportId: "rAssigned",
      teamId: "teamA",
      peopleRescued: 3,
      notes: "ok",
      recordedBy: "rt1",
    }),
  ));
  await check("resident cannot create rescue record", deny(
    resident().collection("rescueRecords").add({ peopleRescued: 1 }),
  ));

  // ---------- §8 PII: reportContacts ----------
  await check("dispatcher reads contact PII", allow(
    dispatcher().collection("reportContacts").doc("r1").get(),
  ));
  await check("dmo reads contact PII", allow(
    dmo().collection("reportContacts").doc("r1").get(),
  ));
  await check("reporter reads own contact PII", allow(
    resident().collection("reportContacts").doc("r1").get(),
  ));
  await check("reporter writes own contact PII", allow(
    resident2().collection("reportContacts").doc("r2").set({
      subject: "self",
      victimName: "Test",
    }),
  ));
  await check("unassigned rescue team cannot read PII", deny(
    teamB().collection("reportContacts").doc("rAssigned").get(),
  ));
  await check("rescue team cannot read PII of unassigned report", deny(
    teamA().collection("reportContacts").doc("r1").get(),
  ));
  await check("assigned rescue team reads PII", allow(
    teamA().collection("reportContacts").doc("rAssigned").get(),
  ));
  await check("resident cannot read someone else's PII", deny(
    resident2().collection("reportContacts").doc("r1").get(),
  ));
  await check("unassigned rescue team cannot update PII", deny(
    teamB().collection("reportContacts").doc("rAssigned").update({ notes: "x" }),
  ));

  // ---------- §8: only staff manage accounts ----------
  await check("admin updates staff role", allow(
    admin().collection("users").doc("rt2").update({ role: "dispatcher" }),
  ));
  await check("admin cannot change own role", deny(
    admin().collection("users").doc("admin1").update({ role: "resident" }),
  ));
  await check("admin cannot delete own profile", deny(
    admin().collection("users").doc("admin1").delete(),
  ));
  await check("dispatcher cannot manage users anymore", deny(
    dispatcher().collection("users").doc("rt2").update({ role: "resident" }),
  ));

  // ---------- FR-13: audit log ----------
  await check("signed-in user writes own audit entry", allow(
    dispatcher().collection("logs").add({ uid: "disp1", action: "report_verify", details: {} }),
  ));
  await check("user cannot spoof audit uid", deny(
    dispatcher().collection("logs").add({ uid: "admin1", action: "spoof", details: {} }),
  ));
  await check("dispatcher reads logs", allow(
    dispatcher().collection("logs").get(),
  ));
  await check("resident cannot read logs", deny(
    resident().collection("logs").get(),
  ));
  await check("nobody edits the audit log", deny(
    admin().collection("logs").doc("log1").update({ action: "tamper" }),
  ));

  // ---------- FR-09: notifications ----------
  await check("dispatcher creates notification for reporter", allow(
    dispatcher().collection("notifications").add({
      userId: "res1",
      title: "Verified",
      body: "ok",
      read: false,
    }),
  ));
  await check("resident creates fixed-shape new_report ping to dispatcher", allow(
    resident().collection("notifications").add({
      type: "new_report",
      reportId: "r1",
      userId: "disp1",
      read: false,
      title: "New report needs verification",
      body: "A Flood report was just submitted.",
    }),
  ));
  await check("resident cannot ping a resident", deny(
    resident().collection("notifications").add({
      type: "new_report",
      reportId: "r1",
      userId: "res2",
      read: false,
      title: "t",
      body: "b",
    }),
  ));
  await check("resident cannot ping about someone else's report", deny(
    resident2().collection("notifications").add({
      type: "new_report",
      reportId: "r1",
      userId: "disp1",
      read: false,
      title: "t",
      body: "b",
    }),
  ));
  await check("ping rejects arbitrary fields", deny(
    resident().collection("notifications").add({
      type: "new_report",
      reportId: "r1",
      userId: "disp1",
      read: false,
      title: "t",
      body: "b",
      hacker: true,
    }),
  ));
  await check("ping rejects wrong type", deny(
    resident().collection("notifications").add({
      type: "spam",
      reportId: "r1",
      userId: "disp1",
      read: false,
    }),
  ));
  await check("resident reads own notifications", allow(
    resident().collection("notifications").where("userId", "==", "res1").get(),
  ));
  await check("resident cannot read others' notifications", deny(
    resident2().collection("notifications").get(),
  ));

  // ---------- config: dispatcher list ----------
  await check("resident reads config/dispatch", allow(
    resident().collection("config").doc("dispatch").get(),
  ));
  await check("resident cannot write config", deny(
    resident().collection("config").doc("dispatch").set({ dispatcherUids: [] }),
  ));
  await check("admin writes config", allow(
    admin().collection("config").doc("dispatch").set({ dispatcherUids: ["disp1"] }),
  ));

  // ---------- catch-all ----------
  await check("unknown collection is denied", deny(
    resident().collection("anything").add({ a: 1 }),
  ));

  // ---------- summary ----------
  const total = passed + failed;
  console.log(`\nFirestore rules: ${passed}/${total} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(f));
  }
  process.exitCode = failed ? 1 : 0;
}

(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await seed(ctx.firestore());
  });
  await run();
  await env.cleanup();
})().catch((err) => {
  console.error("TEST RUNNER ERROR:", err);
  process.exit(1);
});
