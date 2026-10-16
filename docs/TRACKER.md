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
- **Maps:** **MapTiler** vector styles (default `streets-v4`) on **MapLibre** (mobile), with
  OpenFreeMap (Positron/Bright) as keyless fallbacks. Web: Leaflet. Key kept in gitignored `map_config.dart`.
- **Hazard overlays:** Typhoons (JMA, Firestore), Storm Signals (PAGASA TCWS, admin-entered),
  Rain Forecast (Open-Meteo). Hazards (flood/landslide) = UI-only stub (real data 486 MB–2.7 GB).
- **Notifications:** FCM
- **Contact/victim details:** user **profile** (`users`) **+** per-report staff-only `reportContacts/{reportId}`
  (resident can report for self or someone else)
- **Mobile auth:** **phone + password** (`+63`), synthetic `63…@drrm.local` Auth identifier; full profile
  captured at signup. **Web auth:** email + password (admin/staff).
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
| `dispatcher` | verifies, prioritizes, assigns teams |
| `rescueTeam` | receives/accepts assignments, updates status, records outcome |
| `dmo` | monitors trends, generates reports/stats |
| `admin` | superuser on the same database — full staff access + staff CRUD (only role that manages accounts) |

Stored in `users/{uid}.role`; enforced by Firestore rules. Only `admin` may
create/update/delete staff accounts.

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
- [x] 5 roles in `users/{uid}.role` + rules (`resident`, `dispatcher`, `rescueTeam`, `dmo`, `admin`)
- [x] `logs` audit collection + logging helper
- [x] Admin-only **Staff** page: create/edit/enable-disable/delete staff (in-web, no backend)
- [x] `active:false` enforced at login + in rules (disabled accounts lose access)

### P2 — Web admin/dispatch (Oct 18–23) — B
- [x] Live map of reports (Leaflet + OpenStreetMap markers by priority)
- [x] Verify + prioritize reports (detail panel, status/priority actions)
- [x] Create teams + assign to a report (creates an assignment, sets status)
- [ ] Cluster-level assign + live progress tracking (follow-up)

### P3 — Web responder + DMO (Oct 18–23) — C
- [x] Responder: assigned incidents, accept/decline, update status, record outcome (`rescueRecords`)
- [x] DMO: incident charts + CSV export (PDF pending)

### P4 — Flutter mobile: core (Oct 18–24) — D
- [ ] Auth
- [ ] Profile onboarding (personal + address + household)
- [ ] Report: type + GPS + manual pin + up to 3 photos + description
- [ ] Contact/victim block ("for myself" / "for someone else") → `reportContacts`
- [ ] Track my requests + notifications (FCM)

### P4b — Offline-first + SMS fallback (Oct 22–26) — D, E
- [ ] Enable Firestore persistence; offline report queue + "pending sync" badge
- [ ] Local photo staging → queued upload on reconnect
- [ ] Offline map tiles (MapLibre offline regions, mobile)
- [ ] Offline duplicate detection (cached), reconcile on reconnect
- [ ] Manual address entry when offline
- [ ] "Send via SMS" fallback → native composer (hotline + coords + short desc)

### P4c — Typhoon alert card (mobile)
- [x] Swappable `TyphoonService` (Firestore `bulletins`) + models + cache
- [x] Province GeoJSON (geoBoundaries ADM2, simplified) + point-in-polygon + aliases + tests
- [x] Alert card UI (signal ramp, pulsing ring, collapse) + minimal map/home screen
- [x] Session-only dismiss (returns on restart or new bulletin id)
- [ ] Deploy `bulletins` rules + seed via `scripts/seed_bulletins.js`

### P5 — Clustering + notifications + security (Oct 24–27) — E
- [x] Nearby/duplicate clustering (geohash field on submit + grid-based flags/suggested clusters)
- [ ] FCM notifications on status changes *(in-app notifications shipped; FCM push deferred #14)*
- [x] Upload validation (type/size, mobile), PII protection (reportContacts rules), disclaimer, hotline copy

### P6 — Docs + deploy (Oct 28–Nov 1) — all
- [x] ERD, user manual, defense notes
- [ ] Build Flutter APK *(deploy web: done — Firebase Hosting)*
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
| 2026-10-15 | P4 | Mobile map migrated `flutter_map` → **MapLibre** (`maplibre_gl`, OpenFreeMap `liberty`); Kotlin/JDK 21 confirmed; Android + iOS location perms; APK builds |
| 2026-10-15 | P4c | Typhoon alert card: `TyphoonService`/`TyphoonSource` (Firestore `bulletins`), province GeoJSON lookup + aliases + signal resolver (12 tests), card UI + map/home screen + session dismiss; `bulletins` rules added (read-only) |
| 2026-10-15 | P1 | Mobile auth → **phone + password** (`+63` normalization, synthetic Auth email), redesigned login + 3-step register wizard (profile: name/suffix/birthdate/disability/address/household); web stays email; phone/logic tests |
| 2026-10-15 | P4 | Map-first home shell (Map/Profile tabs via IndexedStack, custom bottom bar + raised Report button), flat `positron` map (tilt/rotate disabled), working recenter (`resolvePosition` w/ timeLimit + last-known fallback), My Reports index bug fixed (Dart sort), card restyled to spec |
| 2026-10-15 | P4c | Map Layers sheet (Hazards stub + Map-layers toggles), Storm Signals / Typhoons / Rain overlays (GeoJSON builders + MapLibre layers), active-layer pill, layers+recenter buttons; MapTiler styles (key gitignored); JMA + Open-Meteo fetchers + GitHub Actions cron; regions GeoJSON asset |
| 2026-10-15 | P4c | Layer toggles fixed: live map update, sheet stays open, per-layer empty-state; `forecasts` read rule added |
| 2026-10-15 | P2 | **Web dispatch built**: Leaflet live map (markers by priority), report list + filters, detail panel (verify/reject/priority, PII contact), teams create + assign → assignment + `Team Assigned` |
| 2026-10-16 | P1 | **Admin role** (`admin` superuser) + admin-only Staff CRUD page (in-web Auth creation via Identity Toolkit REST + admin Firestore write); `create_staff.js` supports `admin`; login role fix |
| 2026-10-16 | P1 | `active:false` enforced at login/guard + Firestore rules (`isActive()`); responders may update report status (status-only) |
| 2026-10-16 | P3 | **Web responder built** (accept/decline, start, complete → `rescueRecords` + notification + report `Resolved`); **DMO analytics** (KPIs, type/priority bars, status breakdown, CSV export)
| 2026-10-16 | UI | Shared UI kit (`components/ui.jsx`), refreshed shell (icons, avatar, sticky header), role-aware dashboard, polished login (show/hide password) |
| 2026-10-16 | UI | **Analytics overhaul**: dependency-free SVG charts (donut/bars/area), KPIs incl. reporters & resolve rate, date-range + type filters, **reports-by-area** (barangay/city from reporter profile), CSV export |
| 2026-10-16 | P2/P3 | Dispatch refreshed (UI kit, map pins/**density** mode, priority legend, type filter); **notification center** (bell, unread badge, mark read/all) + notifications emitted on verify/reject/priority/assign; **suggested clusters** (client-side) → assign team + **live cluster progress**; Analytics: avg time-to-verify/resolve + **PDF** export |
| 2026-10-17 | R1 | **Web R1 complete** (9 steps): report timeline, admin Activity page, safety copy, new-report pings (web badge + mobile dispatcher fan-out + rule-locked shape), reject-with-reason, close incident, duplicate flags, rescue-start notify, rescue outcomes in analytics. Lint + build green |
| 2026-10-17 | R2 | **PII rules hardened + test suite** (`scripts/rules-test`, emulator, 50/50 passing); **deployed** `firestore,hosting` to `drrm-app` |
| 2026-10-17 | R4 | Docs: `docs/ERD.md` (full collection/field map), `docs/USER_MANUAL.md` (per-role), `docs/DEFENSE_NOTES.md` (FCM as future work, backup/DR, known gaps) |
| 2026-10-17 | R3-lite | Mobile: `geohash` written on submit (+3 tests), `history.at` standardized to epoch ms (web parity), notifications screen + bell/unread badge wired into home shell, photo upload type/size validation (client pre-filter + service-level throw). `flutter analyze` clean, 35/35 tests; hosting redeployed |
