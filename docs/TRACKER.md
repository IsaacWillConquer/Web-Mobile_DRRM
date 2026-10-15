# FinalProject_DRRM — Tracker

Web + Mobile Disaster Rescue Reporting & Monitoring System
IT 305 · Bulacan State University · **Submit: Nov 2, 2026**

> Single source of truth for progress. Update checklists and the **Status log** at the end of every session.

---

## 1. Decisions (locked)

- **Approach:** recreate the **flow** of `agap.ai` ourselves — our own code, no reuse of their backend.
- **Stack:** Firebase (Auth + Firestore + FCM). **No server. No Postgres.**
- **Web:** React + Vite + Tailwind → admin/dispatch + responder + DMO
- **Mobile:** Flutter → resident/reporter
- **Images:** Cloudinary (free, unsigned upload) — **up to 3 photos** per report
- **Maps:** OpenStreetMap (Leaflet web / flutter_map mobile)
- **Notifications:** FCM
- **Contact/victim details:** user **profile** (`users`) **+** per-report staff-only `reportContacts/{reportId}`
  (resident can report for self or someone else)
- **Offline:** **offline-first** mobile — queued reports + photos, offline **map tiles**, offline duplicate
  detection, manual address entry, offline banner + pending-sync badge
- **SMS:** **outbound fallback only** — native composer prefilled to the LDRRMO hotline with
  coordinates + short description (free, serverless, works with zero data)
- **AI:** none (not a spec requirement) → rule-based prioritization
- **Reference only (not modified, not imported):** `FinalProject_AWA/`, `agap.ai/`
- **Dropped as unnecessary:** 2FA, face, biometrics, QR, wallet, check-in, ID card, i18n, PWA, voice/TTS

---

## 2. Roles

| Role | Notes |
|---|---|
| `resident` | submits reports, tracks status |
| `dispatcher` | verifies, prioritizes, assigns teams, manages accounts |
| `rescueTeam` | receives/accepts assignments, updates status, records outcome |
| `dmo` | monitors trends, generates reports/stats |

Stored in `users/{uid}.role`; enforced by Firestore rules.

## 3. Report statuses

`Submitted → Under Verification → Verified → Awaiting Assignment → Team Assigned → Rescue in Progress → Resolved → Closed`
(+ `Rejected` / `Duplicate` / `Cancelled`)

---

## 4. Target layout

```
FinalProject_DRRM/
├── web/        React dashboard (admin/dispatch + responder + DMO)
├── mobile/     Flutter app (resident)
├── firestore/  security rules + indexes
└── docs/       TRACKER, ERD, manual, defense notes
```

## 5. Data model (Firestore)

| Collection | Key fields |
|---|---|
| `users/{uid}` | email, name, phone, role, active, teamId?, profile{gender, age, disabilities, address, household}, createdAt |
| `reports/{id}` | reporterId, onBehalfOf('self'\|'other'), lat, lng, geohash, disasterType, description, imageUrls[], status, priority, peopleAffected, clusterId, verifiedBy, history[], createdAt |
| `reportContacts/{reportId}` | subject('self'\|'other'), victimName, victimContact, relationship, peopleCount, specialNeeds[], notes — **staff-only PII** |
| `clusters/{id}` | center, cell/geohash, reportIds[], priority, status, reportCount, peopleAffected |
| `teams/{id}` | name, contact, base{lat,lng}, status, memberUids[] |
| `assignments/{id}` | reportId/clusterId, teamId, status, dispatchedBy, notes, timestamps |
| `rescueRecords/{id}` | assignmentId, peopleRescued, outcome, notes |
| `notifications/{id}` | userId, title, body, read, createdAt |
| `logs/{id}` | uid, action, details, createdAt |

Geo/nearby + duplicate detection via geohash (`geofire-common` / `geoflutterfire2`).

---

## 6. Team split (5 → scales to 4)

| Member | Role | Owns |
|---|---|---|
| **A** | Firebase/Data Lead | Firebase project, Firestore schema, rules, auth + 4 roles, audit |
| **B** | Web Lead | Admin/Dispatcher dashboard: verify, prioritize, assign, live map, track |
| **C** | Web #2 | Responder (web) interface + DMO analytics (charts, CSV/PDF) |
| **D** | Mobile Lead (Flutter) | Resident app: auth, report (type/GPS/pin/photo/desc), tracking, notifications |
| **E** | Integration / Offline / Notifications | FCM, offline-first + SMS fallback, QA, docs, deploy, video |

**4-person scale:** merge C→B and E→A.

---

## 7. Phases

### P0 — Firebase project + scaffold (Oct 15–16) — A
- [ ] Create Firebase project (Auth + Firestore + FCM) — **needs you** (see `docs/SETUP.md`)
- [x] Scaffold `web/` (Vite + React + Tailwind + Firebase)
- [x] Scaffold `mobile/` (Flutter + Firebase)
- [x] `firestore/firestore.rules` + indexes; data model set (+ `firebase.json`, `.firebaserc`)

### P0.5 — Contracts + team onboarding (Oct 15–16) — A/E
- [x] `docs/CONTRIBUTING.md` — branching, commits, PRs, config steps, ownership, shared files
- [x] `web/src/core/services/*` — data-access stubs for every collection (reports, reportContacts, clusters, teams, assignments, rescueRecords, notifications)
- [x] `web/src/components/AppShell.jsx` (shared layout + role nav) + `pages/dispatch|responder|dmo/` skeletons; routes wired
- [ ] Create Firebase project + share config with team (see P0 / `docs/SETUP.md`)

### P1 — Auth + roles + audit (Oct 16–18) — A
- [x] Firebase Auth (register/login) — web + mobile (code ready; needs project config)
- [x] 4 roles in `users/{uid}.role` + rules
- [x] `logs` audit collection + logging helper

### P2 — Web admin/dispatch (Oct 18–23) — B
- [ ] Live map of reports/clusters
- [ ] Verify + prioritize reports
- [ ] Create teams, assign to cluster, track progress

### P3 — Web responder + DMO (Oct 18–23) — C
- [ ] Responder: assigned incidents, accept, update status, record outcome
- [ ] DMO: charts + CSV/PDF reports

### P4 — Flutter mobile: core (Oct 18–24) — D
- [ ] Auth
- [ ] Profile onboarding (personal + address + household)
- [ ] Report: type + GPS + manual pin + up to 3 photos + description
- [ ] Contact/victim block ("for myself" / "for someone else") → `reportContacts`
- [ ] Track my requests + notifications (FCM)

### P4b — Offline-first + SMS fallback (Oct 22–26) — D, E
- [ ] Enable Firestore persistence; offline report queue + "pending sync" badge
- [ ] Local photo staging → queued upload on reconnect
- [ ] Offline map tiles (`flutter_map_tile_caching`)
- [ ] Offline duplicate detection (cached), reconcile on reconnect
- [ ] Manual address entry when offline
- [ ] "Send via SMS" fallback → native composer (hotline + coords + short desc)

### P5 — Clustering + notifications + security (Oct 24–27) — E
- [ ] Nearby/duplicate clustering (geohash)
- [ ] FCM notifications on status changes
- [ ] Upload validation, PII protection (reportContacts rules), disclaimer, hotline copy

### P6 — Docs + deploy (Oct 28–Nov 1) — all
- [ ] ERD, user manual, defense notes
- [ ] Deploy web (Firebase Hosting), build Flutter APK
- [ ] Test pass + video prep

### Nov 2 — SUBMIT

---

## 8. Services to create

- [ ] Firebase project (Auth + Firestore + FCM)
- [ ] Cloudinary account (unsigned upload preset)

## 9. Risks

- ~19 days, 4–5 members
- Net-new: admin + responder + DMO web
- Offline-first adds complexity (sync conflicts, queued photo uploads, tile caching)
- Geospatial is approximate (geohash, no PostGIS) — fine for a class demo
- PII (victim names, precise locations) must be locked down in rules (Data Privacy Act)
- SMS fallback is outbound only (delivery not recorded back into the system — documented)
- Free-tier limits (Firestore reads/writes, Cloudinary)

---

## 10. Status log

| Date | Who | Summary |
|---|---|---|
| 2026-10-14 | init | Rebuilt plan around Firebase/Firestore; removed abandoned backend + PII-tainted schema |
| 2026-10-14 | plan | Locked offline-first (incl. map tiles) + outbound SMS fallback; added `reportContacts` model |
| 2026-10-14 | P0 | Scaffolded `web/` (Vite+React+Tailwind+Firebase) and `mobile/` (Flutter+Firebase); root `firebase.json`, `.firebaserc`, `web/.env.example` |
| 2026-10-14 | P1 | Web: firebase init, AuthProvider, authService, role guards, login/register/dashboard, audit `logAction`. Mobile: authService, login/register/home, AuthGate. Web lint 0, build OK; `flutter analyze` clean |
| 2026-10-14 | docs | Added `docs/SETUP.md` (Firebase + Cloudinary one-time setup) |
| 2026-10-15 | P0.5 | Pre-split contracts: `docs/CONTRIBUTING.md`, `core/services/*` data layer, `AppShell` + role page skeletons, routes split per role |
| 2026-10-15 | P0 | Firebase project `drrm-app` created (Auth + Firestore); web `.env` filled; mobile Android app registered as `com.drrm.mobile` (renamed from `com.drrm.drrm_mobile`), `firebase_options.dart` + `google-services.json` in place; Kotlin bumped to 2.3.0 (`compilerOptions` jvmTarget DSL); app runs on emulator |
| 2026-10-15 | P0 | Web is **staff-only** (dispatcher/rescueTeam/dmo) — residents use mobile only |
| 2026-10-15 | P5 | Hardened `firestore.rules` (uid-spoof guard on `logs`, responder-gated notifications/clusters/teams, reports field validation, resident-only self-create) + composite indexes added; rules validated via Firestore emulator |
