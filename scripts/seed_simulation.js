#!/usr/bin/env node
//
// Full-activity SIMULATION seed for FinalProject_DRRM.
//
// Populates every dashboard so it "has that feel":
//   residents + dispatcher + DMO (Auth users + users docs)
//   reports + reportContacts + clusters + assignments + rescueRecords
//   notifications + audit logs
//
// Writes go through the Firestore REST API using the Firebase CLI login (the
// Admin SDK key is IAM-denied); Auth users are created with the web API key.
// Deterministic IDs -> idempotent.  `--clear` removes everything it created.
//
// Usage:
//   node seed_simulation.js
//   node seed_simulation.js --clear
//
// Depends on scripts/seed_rescue_teams.js having created the teams
// (team-malolos, team-calumpit, ...).

const fs = require("fs");
const path = require("path");
const {
  getAccessToken,
  setDoc,
  deleteDoc,
  listDocs,
  postJson,
  nowTs,
} = require("./lib/firebase_rest");

const PROJECT = process.env.FIREBASE_PROJECT_ID || "drrm-app";
const clear = process.argv.includes("--clear");
const RESIDENT_PW = "resident123";
const STAFF_PW = "bulacan123";

function apiKey() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", "web", ".env"), "utf8");
  const m = env.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (!m) throw new Error("VITE_FIREBASE_API_KEY not found in web/.env");
  return m[1].trim();
}

// ---------------------------------------------------------------- accounts ---

const TOWNS = [
  { town: "Malolos", brgy: "San Agustin", lat: 14.8433, lng: 120.8114 },
  { town: "Calumpit", brgy: "Poblacion", lat: 14.9167, lng: 120.7667 },
  { town: "Hagonoy", brgy: "Sto. Rosario", lat: 14.8333, lng: 120.7333 },
  { town: "Paombong", brgy: "San Isidro", lat: 14.8333, lng: 120.7833 },
  { town: "Guiguinto", brgy: "Poblacion", lat: 14.8333, lng: 120.8833 },
  { town: "Plaridel", brgy: "Banga", lat: 14.8833, lng: 120.8667 },
  { town: "Pulilan", brgy: "Poblacion", lat: 14.9, lng: 120.85 },
  { town: "Baliwag", brgy: "Bagong Nayon", lat: 14.95, lng: 120.9 },
];

const RESIDENTS = [
  { name: "Juan Dela Cruz", phone: "09171230001", gender: "Male", age: 42, household: 5 },
  { name: "Maria Santos", phone: "09171230002", gender: "Female", age: 35, household: 4 },
  { name: "Pedro Reyes", phone: "09171230003", gender: "Male", age: 51, household: 6 },
  { name: "Ana Bautista", phone: "09171230004", gender: "Female", age: 29, household: 3 },
  { name: "Jose Ramos", phone: "09171230005", gender: "Male", age: 47, household: 5 },
  { name: "Rosa Mendoza", phone: "09171230006", gender: "Female", age: 38, household: 4 },
  { name: "Mark Villanueva", phone: "09171230007", gender: "Male", age: 33, household: 2 },
  { name: "Liza Garcia", phone: "09171230008", gender: "Female", age: 44, household: 5 },
];

const DISPATCHER = { email: "dispatcher.bulacan@drrm.test", name: "Bulacan PDRRMO Dispatch" };
const DMO = { email: "dmo.bulacan@drrm.test", name: "Bulacan DMO Office" };

function residentEmail(phone) {
  return `63${phone.replace(/^0/, "")}@drrm.local`;
}
function townSlug(town) {
  return town.toLowerCase().replace(/[^a-z]/g, "");
}

// ------------------------------------------------------------- report specs ---
// status -> pipeline offsets (minutes after submit)
const OFFSET = {
  Submitted: 0,
  "Under Verification": 10,
  Verified: 30,
  "Awaiting Assignment": 40,
  "Team Assigned": 90,
  "Rescue in Progress": 180,
  Resolved: 320,
  Closed: 420,
  Rejected: 25,
  Duplicate: 45,
  Cancelled: 60,
};
const CHAIN = {
  Submitted: ["Submitted"],
  "Under Verification": ["Submitted", "Under Verification"],
  Verified: ["Submitted", "Verified"],
  "Awaiting Assignment": ["Submitted", "Verified", "Awaiting Assignment"],
  "Team Assigned": ["Submitted", "Verified", "Team Assigned"],
  "Rescue in Progress": ["Submitted", "Verified", "Team Assigned", "Rescue in Progress"],
  Resolved: ["Submitted", "Verified", "Team Assigned", "Rescue in Progress", "Resolved"],
  Closed: ["Submitted", "Verified", "Team Assigned", "Rescue in Progress", "Resolved", "Closed"],
  Rejected: ["Submitted", "Rejected"],
  Duplicate: ["Submitted", "Duplicate"],
  Cancelled: ["Submitted", "Cancelled"],
};

// id, town, type, status, prio, people, daysAgo (+hour), reporter, onBehalf, teamSlug, rescued, desc, extra
const SPECS = [
  { town: 0, type: "Flood", status: "Submitted", prio: "high", people: 6, ago: 0.1, rep: 0, desc: "Knee-deep flood along MacArthur Highway; water still rising.", j: 0 },
  { town: 0, type: "Flood", status: "Duplicate", prio: "high", people: 5, ago: 0.05, rep: 1, desc: "Flood near Malolos crossing, several cars stalled.", j: 0 },
  { town: 0, type: "Fire", status: "Verified", prio: "medium", people: 2, ago: 1.2, rep: 2, desc: "House fire contained but smoke still heavy." },
  { town: 0, type: "Flood", status: "Resolved", prio: "high", people: 8, ago: 4.1, rep: 0, team: "malolos", rescued: 8, cluster: "malolos", j: 1, desc: "Residential area flooded; families evacuated." },
  { town: 0, type: "Flood", status: "Resolved", prio: "high", people: 4, ago: 4.2, rep: 3, team: "malolos", rescued: 4, cluster: "malolos", j: 1, desc: "Flooding near the bridge; elderly residents trapped." },

  { town: 1, type: "Flood", status: "Rescue in Progress", prio: "high", people: 10, ago: 0.3, rep: 1, team: "calumpit", cluster: "calumpit", j: 0, desc: "River overflowed; about 10 residents on rooftops." },
  { town: 1, type: "Flood", status: "Team Assigned", prio: "high", people: 7, ago: 0.4, rep: 6, team: "calumpit", cluster: "calumpit", j: 0, desc: "Deep flood near barangay hall, families stranded." },
  { town: 1, type: "Typhoon", status: "Verified", prio: "high", people: 12, ago: 2.2, rep: 5, desc: "Roofs damaged by strong winds; assistance needed." },
  { town: 1, type: "Flood", status: "Duplicate", prio: "medium", people: 3, ago: 1.1, rep: 7, j: 0, desc: "Same flooded street reported earlier." },

  { town: 2, type: "Storm Surge", status: "Submitted", prio: "high", people: 15, ago: 0.2, rep: 2, desc: "Coastal surge threatening houses near the seawall." },
  { town: 2, type: "Flood", status: "Closed", prio: "medium", people: 5, ago: 6.3, rep: 4, team: "hagonoy", rescued: 5, desc: "Flood waters receded; residents returned home." },
  { town: 2, type: "Typhoon", status: "Rejected", prio: "low", people: 1, ago: 3.2, rep: 5, reject: "Reported location could not be verified.", desc: "Possible damage somewhere in the area." },

  { town: 3, type: "Flood", status: "Verified", prio: "medium", people: 4, ago: 1.4, rep: 3, desc: "Paddy fields and a few homes flooded." },
  { town: 3, type: "Earthquake", status: "Submitted", prio: "medium", people: 2, ago: 0.3, rep: 7, desc: "Felt a tremor; cracks appeared on a wall." },
  { town: 3, type: "Landslide", status: "Resolved", prio: "high", people: 6, ago: 5.2, rep: 0, onBehalf: "other", team: "paombong", rescued: 6, contact: { victimName: "R. Aquino", victimContact: "+63 917 555 9001", relationship: "Neighbor", specialNeeds: ["elderly"], notes: "Two elderly residents with limited mobility." }, desc: "Soil collapse behind houses after heavy rain." },

  { town: 4, type: "Fire", status: "Team Assigned", prio: "high", people: 3, ago: 0.4, rep: 4, team: "guiguinto", desc: "Small residential fire; spread to neighboring unit." },
  { town: 4, type: "Flood", status: "Awaiting Assignment", prio: "medium", people: 5, ago: 2.1, rep: 6, desc: "Street flooding, passable to light vehicles only." },
  { town: 4, type: "Other", status: "Cancelled", prio: "low", people: 1, ago: 4.4, rep: 2, desc: "Fallen tree reported then cleared by barangay." },

  { town: 5, type: "Flood", status: "Resolved", prio: "medium", people: 7, ago: 7.1, rep: 5, team: "plaridel", rescued: 7, desc: "Flooded subdivision, families moved to evacuation center." },
  { town: 5, type: "Typhoon", status: "Verified", prio: "high", people: 9, ago: 1.3, rep: 1, desc: "Downed power lines and damaged houses." },
  { town: 5, type: "Fire", status: "Rescue in Progress", prio: "high", people: 2, ago: 0.35, rep: 3, team: "plaridel", desc: "Ongoing fire in a commercial building." },

  { town: 6, type: "Flood", status: "Submitted", prio: "medium", people: 3, ago: 0.08, rep: 0, desc: "Minor flooding in low-lying streets." },
  { town: 6, type: "Landslide", status: "Awaiting Assignment", prio: "medium", people: 4, ago: 2.3, rep: 4, onBehalf: "other", contact: { victimName: "M. Cruz", victimContact: "+63 917 555 9002", relationship: "Relative", specialNeeds: [], notes: "Family of four affected." }, desc: "Earth slipped onto a farm-to-market road." },

  { town: 7, type: "Flood", status: "Resolved", prio: "high", people: 11, ago: 5.3, rep: 7, team: "baliwag", rescued: 11, desc: "Widespread flooding; multiple households rescued." },
  { town: 7, type: "Typhoon", status: "Team Assigned", prio: "high", people: 8, ago: 0.5, rep: 2, team: "baliwag", desc: "Strong winds toppled trees and damaged roofs." },
  { town: 7, type: "Earthquake", status: "Rejected", prio: "low", people: 2, ago: 2.4, rep: 6, reject: "No ground shaking confirmed in the area.", desc: "Aftershock concern." },
];

function reportId(i) {
  return `sim-rep-${String(i + 1).padStart(2, "0")}`;
}

function coord(town, j = 0) {
  return [TOWNS[town].lat + j * 0.0016, TOWNS[town].lng + j * 0.0013];
}

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ------------------------------------------------------------------- auth ----

async function ensureAuth(key, email, password, name) {
  const up = await postJson(
    "identitytoolkit.googleapis.com",
    `/v1/accounts:signUp?key=${key}`,
    { email, password, displayName: name, returnSecureToken: false }
  );
  const j = JSON.parse(up.body);
  if (j.localId) return j.localId;
  const msg = j.error && j.error.message ? j.error.message : up.body;
  if (String(msg).includes("EMAIL_EXISTS")) {
    const si = await postJson(
      "identitytoolkit.googleapis.com",
      `/v1/accounts:signInWithPassword?key=${key}`,
      { email, password, returnSecureToken: false }
    );
    const j2 = JSON.parse(si.body);
    if (j2.localId) return j2.localId;
    throw new Error(`sign-in failed for ${email}: ${si.body.slice(0, 160)}`);
  }
  throw new Error(`signUp failed for ${email}: ${up.body.slice(0, 160)}`);
}

// ------------------------------------------------------------------ build ----

function buildDocs({ residentUids, dispatcherUid, dmoUid, teamBySlug }) {
  const docs = [];
  const add = (coll, id, obj) => docs.push({ coll, id, obj });

  const now = Date.now();

  // reports + contacts + clusters map
  const clusterMembers = {};
  const assignments = [];

  SPECS.forEach((s, i) => {
    const id = reportId(i);
    const town = TOWNS[s.town];
    const [lat, lng] = coord(s.town, s.j ?? i % 3);
    const createdMs = new Date(isoDaysAgo(s.ago)).getTime();
    const chain = CHAIN[s.status];
    const history = chain.map((st, k) => ({
      status: st,
      by: st === "Submitted" ? residentUids[s.rep] : dispatcherUid,
      at: createdMs + OFFSET[st] * 60000 + (k === 0 ? 0 : 0),
    }));

    const teamId = s.team ? `team-${s.team}` : null;
    const clusterId = s.cluster ? `sim-cl-${s.cluster}` : null;

    const report = {
      reporterId: residentUids[s.rep],
      onBehalfOf: s.onBehalf ?? "self",
      lat,
      lng,
      disasterType: s.type,
      description: s.desc,
      imageUrls: [],
      status: s.status,
      priority: s.prio,
      peopleAffected: s.people,
      clusterId,
      verifiedBy: chain.includes("Verified") ? dispatcherUid : null,
      teamId,
      rejectionReason: s.reject ?? null,
      history,
      demo: true,
      createdAt: { __ts: new Date(createdMs).toISOString() },
      updatedAt: { __ts: new Date(createdMs + OFFSET[s.status] * 60000).toISOString() },
    };
    add("reports", id, report);

    if (s.contact) {
      add("reportContacts", id, {
        subject: s.onBehalf ?? "self",
        victimName: s.contact.victimName,
        victimContact: s.contact.victimContact,
        relationship: s.contact.relationship,
        peopleCount: s.people,
        specialNeeds: s.contact.specialNeeds ?? [],
        notes: s.contact.notes ?? "",
        updatedAt: nowTs(),
      });
    }

    if (clusterId) {
      (clusterMembers[clusterId] ??= []).push(id);
    }

    // assignment + rescue record
    if (teamId) {
      const asgId = `sim-as-${String(i + 1).padStart(2, "0")}`;
      const asgStatus =
        s.status === "Resolved" || s.status === "Closed"
          ? "completed"
          : s.status === "Rescue in Progress"
            ? "in_progress"
            : "dispatched";
      add("assignments", asgId, {
        reportId: id,
        clusterId,
        teamId,
        status: asgStatus,
        dispatchedBy: dispatcherUid,
        notes: "",
        demo: true,
        createdAt: { __ts: new Date(createdMs + OFFSET["Team Assigned"] * 60000).toISOString() },
        updatedAt: { __ts: new Date(createdMs + OFFSET[s.status] * 60000).toISOString() },
      });
      assignments.push({ asgId, reportId: id, teamId, status: asgStatus, createdMs });

      if (asgStatus === "completed") {
        const member = teamBySlug[s.team]?.memberUid ?? dispatcherUid;
        add("rescueRecords", `sim-rr-${String(i + 1).padStart(2, "0")}`, {
          assignmentId: asgId,
          reportId: id,
          teamId,
          peopleRescued: s.rescued ?? 0,
          notes:
            s.rescued > 0
              ? `${s.rescued} resident(s) evacuated to the barangay hall; no casualties.`
              : "Area cleared; no rescue needed.",
          recordedBy: member,
          demo: true,
          createdAt: { __ts: new Date(createdMs + OFFSET["Resolved"] * 60000).toISOString() },
        });
      }
    }
  });

  // clusters
  Object.entries(clusterMembers).forEach(([clusterId, reportIds]) => {
    const idxs = reportIds.map((rid) => Number(rid.slice(-2)) - 1);
    const members = idxs.map((k) => SPECS[k]);
    const coords = members.map((m, k) => coord(m.town, m.j ?? idxs[k] % 3));
    const avgLat = coords.reduce((a, c) => a + c[0], 0) / coords.length;
    const avgLng = coords.reduce((a, c) => a + c[1], 0) / coords.length;
    const people = members.reduce((a, m) => a + m.people, 0);
    const prio = members.some((m) => m.prio === "high")
      ? "high"
      : members.some((m) => m.prio === "medium")
        ? "medium"
        : "low";
    const teamSlug = members.find((m) => m.team)?.team;
    add("clusters", clusterId, {
      center: { lat: Number(avgLat.toFixed(5)), lng: Number(avgLng.toFixed(5)) },
      cell: `${TOWNS[members[0].town].town} grid`,
      reportIds,
      reportCount: reportIds.length,
      peopleAffected: people,
      priority: prio,
      status: teamSlug ? "assigned" : "open",
      demo: true,
      createdAt: { __ts: isoDaysAgo(members[0].ago) },
      updatedAt: nowTs(),
    });
  });

  // notifications: reporter updates + dispatcher pings
  let n = 0;
  SPECS.forEach((s, i) => {
    const id = reportId(i);
    const town = TOWNS[s.town].town;
    const base = new Date(isoDaysAgo(s.ago)).getTime();
    if (CHAIN[s.status].includes("Verified")) {
      add("notifications", `sim-notif-${++n}`, {
        userId: residentUids[s.rep],
        title: "Report verified",
        body: `Your ${s.type} report in ${town} has been verified.`,
        read: n % 2 === 0,
        reportId: id,
        demo: true,
        createdAt: { __ts: new Date(base + OFFSET.Verified * 60000).toISOString() },
      });
    }
    if (s.team) {
      add("notifications", `sim-notif-${++n}`, {
        userId: residentUids[s.rep],
        title: "Rescue team assigned",
        body: `A rescue team is responding to your ${s.type} report in ${town}.`,
        read: false,
        reportId: id,
        demo: true,
        createdAt: { __ts: new Date(base + OFFSET["Team Assigned"] * 60000).toISOString() },
      });
    }
    if (s.status === "Submitted") {
      add("notifications", `sim-notif-${++n}`, {
        type: "new_report",
        userId: dispatcherUid,
        title: "New report needs verification",
        body: `A ${s.type} report was just submitted in ${town}.`,
        read: false,
        reportId: id,
        demo: true,
        createdAt: { __ts: new Date(base + 1 * 60000).toISOString() },
      });
    }
  });

  // audit logs
  let l = 0;
  const log = (uid, action, details, tsIso) =>
    add("logs", `sim-log-${String(++l).padStart(3, "0")}`, {
      uid,
      action,
      details,
      demo: true,
      createdAt: { __ts: tsIso },
    });

  log(dispatcherUid, "auth_login", { source: "web" }, isoDaysAgo(0.6));
  log(dmoUid, "auth_login", { source: "web" }, isoDaysAgo(0.5));
  log(dispatcherUid, "team_create", { name: "Bulacan rescue teams (10)" }, isoDaysAgo(9));
  log(dispatcherUid, "staff_created", { role: "dmo", email: DMO.email }, isoDaysAgo(9));

  SPECS.forEach((s, i) => {
    const id = reportId(i);
    const base = new Date(isoDaysAgo(s.ago)).getTime();
    const iso = (min) => new Date(base + min * 60000).toISOString();
    if (CHAIN[s.status].includes("Verified")) {
      log(dispatcherUid, "report_verify", { reportId: id }, iso(OFFSET.Verified));
    }
    if (s.status === "Rejected") {
      log(dispatcherUid, "report_reject", { reportId: id, reason: s.reject }, iso(OFFSET.Rejected));
    }
    if (s.team) {
      log(dispatcherUid, "report_assign", { reportId: id, teamId: `team-${s.team}` }, iso(OFFSET["Team Assigned"]));
      const asg = assignments.find((a) => a.reportId === id);
      if (asg && asg.status !== "dispatched") {
        log(dispatcherUid, "assignment_accept", { assignmentId: asg.asgId }, iso(OFFSET["Team Assigned"] + 20));
      }
      if (asg && (asg.status === "in_progress" || asg.status === "completed")) {
        log(dispatcherUid, "assignment_start", { assignmentId: asg.asgId }, iso(OFFSET["Rescue in Progress"]));
      }
      if (asg && asg.status === "completed") {
        log(dispatcherUid, "assignment_complete", { assignmentId: asg.asgId, peopleRescued: s.rescued ?? 0 }, iso(OFFSET.Resolved));
      }
    }
  });

  return docs;
}

// --------------------------------------------------------------- run ---------

async function main() {
  const key = apiKey();
  const token = await getAccessToken();

  // accounts
  const residentUids = [];
  for (let i = 0; i < RESIDENTS.length; i++) {
    const r = RESIDENTS[i];
    residentUids.push(await ensureAuth(key, residentEmail(r.phone), RESIDENT_PW, r.name));
  }
  const dispatcherUid = await ensureAuth(key, DISPATCHER.email, STAFF_PW, DISPATCHER.name);
  const dmoUid = await ensureAuth(key, DMO.email, STAFF_PW, DMO.name);

  // teams (created by seed_rescue_teams.js)
  const teams = await listDocs(token, PROJECT, "teams");
  const teamBySlug = {};
  teams.forEach((t) => {
    const slug = String(t.id).replace(/^team-/, "");
    teamBySlug[slug] = { id: t.id, name: t.name, memberUid: (t.memberUids || [])[0] };
  });

  const docs = buildDocs({ residentUids, dispatcherUid, dmoUid, teamBySlug });

  if (clear) {
    let removed = 0;
    for (const d of docs) {
      await deleteDoc(token, PROJECT, d.coll, d.id);
      removed++;
    }
    // users
    for (const uid of [...residentUids, dispatcherUid, dmoUid]) {
      await deleteDoc(token, PROJECT, "users", uid);
      removed++;
    }
    console.log(`Cleared ${removed} simulation documents (Auth accounts remain).`);
    return;
  }

  // users
  for (let i = 0; i < RESIDENTS.length; i++) {
    const r = RESIDENTS[i];
    const t = TOWNS[i];
    await setDoc(token, PROJECT, "users", residentUids[i], {
      email: residentEmail(r.phone),
      name: r.name,
      phone: `+63${r.phone.replace(/^0/, "")}`,
      role: "resident",
      active: true,
      profile: {
        gender: r.gender,
        age: r.age,
        household: r.household,
        address: { barangay: `Brgy. ${t.brgy}`, city: t.town, province: "Bulacan" },
      },
      demo: true,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    });
  }
  await setDoc(token, PROJECT, "users", dispatcherUid, {
    email: DISPATCHER.email,
    name: DISPATCHER.name,
    role: "dispatcher",
    active: true,
    demo: true,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  });
  await setDoc(token, PROJECT, "users", dmoUid, {
    email: DMO.email,
    name: DMO.name,
    role: "dmo",
    active: true,
    demo: true,
    createdAt: nowTs(),
    updatedAt: nowTs(),
  });

  // activity docs
  for (const d of docs) {
    await setDoc(token, PROJECT, d.coll, d.id, d.obj);
  }

  const count = (c) => docs.filter((d) => d.coll === c).length;
  console.log("Simulation seeded:");
  console.log(`  residents: ${RESIDENTS.length}   (login <phone>@drrm.local / ${RESIDENT_PW})`);
  console.log(`  dispatcher: ${DISPATCHER.email} / ${STAFF_PW}`);
  console.log(`  dmo: ${DMO.email} / ${STAFF_PW}`);
  console.log(`  reports: ${count("reports")}   contacts: ${count("reportContacts")}`);
  console.log(`  clusters: ${count("clusters")}   assignments: ${count("assignments")}   rescueRecords: ${count("rescueRecords")}`);
  console.log(`  notifications: ${count("notifications")}   logs: ${count("logs")}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
