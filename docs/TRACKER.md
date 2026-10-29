# FinalProject_DRRM — Tracker

Web + Mobile Disaster Rescue Reporting & Monitoring System
IT 305 · Bulacan State University · **Submit: Nov 2, 2026**

> Single source of truth for progress. Update checklists and the **Status log** at the end of every session.

---

## 1. Decisions (locked)

- **Stack:** Firebase (Auth + Firestore + FCM).
- **Web:** React + Vite + Tailwind → admin/dispatch + responder + DMO
- **Mobile:** Flutter → resident/reporter **+ rescue-team field app** (`rescueTeam` users are routed to the responder screens)
- **Images:** Cloudinary (free, unsigned upload) — **up to 3 photos** per report
- **Maps:** **MapLibre GL** everywhere (mobile **and** web). Default basemap is keyless
  **OpenFreeMap Positron** — calm grey, place/boundary labels only, **water tinted blue**
  (`#B9D4EA`, set in `mobile/lib/config/map_styles.dart` and `web/src/pages/dispatch/mapStyle.js`).
  The same style is used on the resident map, report screen, rescue job map, and the web
  dispatch / responder / DMO maps. **MapTiler** vector styles (key in gitignored `map_config.dart`)
  and OpenFreeMap **Bright** remain selectable fallbacks.
- **Hazard overlays:** Typhoons (JMA, Firestore), Storm Signals (PAGASA TCWS, admin-entered),
  Rain Forecast (Open-Meteo). Hazards (flood/landslide) = UI-only stub (real data 486 MB–2.7 GB).
- **Notifications:** in-app Firestore fan-out (web bell + toast/sound, mobile bell); **FCM push = future work**.
  Rescue assignment popup on mobile is also in-app (Firestore listener, works while the app is open).
- **Rescue flow (Oct 26):** web responder **clicks a card → map pin → Confirm rescue** → every `teams.memberUids` phone gets a
  `rescue_assigned` notification → mobile popup **Start Tracking** → live GPS + **OpenRouteService** road route (key in gitignored
  `map_config.dart`; straight-line fallback without it) → **hold-to-confirm** finish form (people saved, description, up to 5 Cloudinary photos).
- **Contact/victim details:** user **profile** (`users`) **+** per-report staff-only `reportContacts/{reportId}`
  (resident can report for self or someone else)
- **Mobile auth:** **phone + password** (`+63`), synthetic `63…@drrm.local` Auth identifier; full profile
  captured at signup. **Web auth:** email + password (admin/staff).
- **Offline:** **offline-first** mobile — queued reports + photos, offline **map tiles**, offline duplicate
  detection, manual address entry, offline banner + pending-sync badge
- **SMS:** **outbound fallback only** — native composer prefilled to the LDRRMO hotline with
  coordinates + short description (free, serverless, works with zero data)
- **AI:** none — rule-based; **rescue priority = submission time (oldest active report first)**
- **Reference only (not modified, not imported):** `FinalProject_AWA/`, `agap.ai/`
- **Dropped as unnecessary:** 2FA, face, biometrics, QR, wallet, check-in, ID card, i18n, PWA, voice/TTS

---

## 2. Roles

| Role | Notes |
|---|---|
| `resident` | submits reports, tracks status |
| `dispatcher` | verifies, prioritizes, assigns teams |
| `rescueTeam` | web: sees **only its own team's** assignments — confirms rescue + follows live (scoped, Oct 28) · mobile: gets popup, tracks route, records outcome |
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
├── mobile/     Flutter app (resident + rescue team)
├── firestore/  security rules + indexes
└── docs/       TRACKER, ERD, manual, defense notes
```

## 5. Data model (Firestore)

| Collection | Key fields |
|---|---|
| `users/{uid}` | email, name, phone, role, active, teamId?, profile{birthdate, disability[], address, household}, createdAt |
| `reports/{id}` | reporterId, onBehalfOf('self'\|'other'), lat, lng, geohash, disasterType, description, imageUrls[], status, priority(legacy), teamId, backupTeamIds[], peopleAffected, clusterId, verifiedBy, history[], createdAt |
| `reportContacts/{reportId}` | subject('self'\|'other'), victimName, victimContact, relationship, peopleCount, specialNeeds[], notes — **staff-only PII** |
| `clusters/{id}` | center, cell/geohash, reportIds[], priority, status, reportCount, peopleAffected |
| `teams/{id}` | name, contact, status, memberUids[] |
| `assignments/{id}` | reportId/clusterId, teamId, status(dispatched→accepted→in_progress→completed \| declined \| cancelled), backup, dispatchedBy, notes, **responderLocation{lat,lng,updatedAt}**, **startedAt/completedAt**, timestamps |
| `rescueRecords/{id}` | assignmentId, reportId, teamId, peopleRescued, notes (description), **imageUrls[]**, recordedBy |
| `notifications/{id}` | userId, title, body, read, **type?** (`new_report` \| `rescue_assigned`), **assignmentId?**, reportId?, createdAt |
| `logs/{id}` | uid, action, details, createdAt |

Geo/nearby + duplicate detection via a **custom geohash encoder + client-side grid** (no PostGIS, no external geo library). Rescue priority is **time-based** (oldest active report first); the stored `priority` field is legacy.

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
- [x] Create Firebase project (Auth + Firestore + FCM) — `drrm-app` created (see `docs/SETUP.md`)
- [x] Scaffold `web/` (Vite + React + Tailwind + Firebase)
- [x] Scaffold `mobile/` (Flutter + Firebase)
- [x] `firestore/firestore.rules` + indexes; data model set (+ `firebase.json`, `.firebaserc`)

### P0.5 — Contracts + team onboarding (Oct 15–16) — A/E
- [x] `docs/CONTRIBUTING.md` — branching, commits, PRs, config steps, ownership, shared files
- [x] `web/src/core/services/*` — data-access stubs for every collection (reports, reportContacts, clusters, teams, assignments, rescueRecords, notifications)
- [x] `web/src/components/AppShell.jsx` (shared layout + role nav) + `pages/dispatch|responder|dmo/` skeletons; routes wired
- [x] Create Firebase project + share config with team (see P0 / `docs/SETUP.md`)

### P1 — Auth + roles + audit (Oct 16–18) — A
- [x] Firebase Auth (register/login) — web + mobile (code ready; needs project config)
- [x] 5 roles in `users/{uid}.role` + rules (`resident`, `dispatcher`, `rescueTeam`, `dmo`, `admin`)
- [x] `logs` audit collection + logging helper
- [x] Admin-only **Staff** page: create/edit/enable-disable/delete staff (in-web, no backend)
- [x] `active:false` enforced at login + in rules (disabled accounts lose access)

### P2 — Web admin/dispatch (Oct 18–23) — B
- [x] Live map of reports (MapLibre GL v5 + OpenFreeMap Positron; pins colored by waiting time + density mode)
- [x] Verify + prioritize reports (detail panel, status/priority actions)
- [x] Create teams + assign to a report (creates an assignment, sets status)
- [x] Cluster-level assign + live progress tracking (suggested clusters + cluster dispatch)

### P3 — Web responder + DMO (Oct 18–23) — C
- [x] Responder: assigned incidents, accept/decline, update status, record outcome (`rescueRecords`)
- [x] DMO: incident charts + CSV/PDF export (later restructured — see **P7**)

### P3b — Rescue flow v2: web confirm + mobile field app (Oct 26) — B/C/D
- [x] Web responder page: assignment cards + **MapLibre map with destination pin** (`ResponderMap.jsx`), click card → map before confirming
- [x] **Confirm rescue** (replaces Accept) → assignment `accepted` + `rescue_assigned` notification to every `teams.memberUids`; "Notify team again"
- [x] Web shows the team's **live position** (blue dot + dashed link) from `assignments.responderLocation` while `in_progress`
- [x] Mobile: `rescueTeam` role routing (`main.dart`), `teamId` + live profile stream + email sign-in (`auth_service.dart`, `login_screen.dart`)
- [x] Mobile: rescue home (Active/Completed job list per `teamId`) + **"Rescue assigned" popup with Start Tracking** (`rescue_team_shell.dart`)
- [x] Mobile: **Start Tracking** → `in_progress`, report → `Rescue in Progress`, reporter notified, live GPS written every ~10 s
- [x] Mobile: **road route + distance/ETA** via OpenRouteService (`routing_service.dart`), refreshed ~every 45 s; straight-line fallback
- [x] Mobile: **hold-to-confirm** (1.5 s) → finish form: people saved, description, up to 5 photos (Cloudinary) → `rescueRecords` + `completed` + report `Resolved` (when no other team still active)
- [x] `flutter analyze` on the new mobile files — clean (added the missing `RescueRecord` model + `RescueService.watchRescueRecord`, `models/rescue_record.dart`)
- [ ] Live E2E pass of the new flow (`docs/E2E_TEST_PLAN.md` §3)
- [ ] Add `orsKey` to local `mobile/lib/config/map_config.dart` (free HeiGIT token)

### P4 — Flutter mobile: core (Oct 18–24) — D
- [x] Auth (phone + password, signup wizard)
- [x] Profile onboarding (personal + address + household)
- [x] Report: type + GPS + manual pin + up to 3 photos + description
- [x] Contact/victim block ("for myself" / "for someone else") → `reportContacts`
- [x] Track my requests + notifications (in-app notifications screen; FCM push deferred #14)

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
- [x] Deploy `bulletins` rules + seed via `scripts/seed_demo.js` *(rules deployed 2026-10-17; seeding via Firestore REST with the Firebase CLI login — see `scripts/lib/firebase_rest.js`)*

### P5 — Clustering + notifications + security (Oct 24–27) — E
- [x] Nearby/duplicate clustering (geohash field on submit + grid-based flags/suggested clusters)
- [ ] FCM notifications on status changes *(in-app notifications shipped; FCM push deferred #14)*
- [x] Upload validation (type/size, mobile), PII protection (reportContacts rules), disclaimer, hotline copy

### P6 — Docs + deploy (Oct 28–Nov 1) — all
- [x] ERD, user manual, defense notes
- [x] Build Flutter APK *(release, debug-signed — `mobile/build/app/outputs/flutter-apk/app-release.apk`, 82.1 MB; web: live on Firebase Hosting)*
- [x] Video prep (`docs/DEMO_SCRIPT.md`) + E2E runbook (`docs/E2E_TEST_PLAN.md`) — **live test pass still to run**

### P7 — Analytics v2 + final polish (Oct 26) — B/C
- [x] DMO Analytics restructured into a hierarchy: **At a glance** hero stats → metric groups
  (load / speed / outcomes) with a **priority split** → **Patterns** (trend + one breakdown at a
  time: Status / Priority / Type / Area) → **Hotspots** → **Records** (Recent reports / Rescue
  operations tabs, expand-to-10)
- [x] **Hotspot map** (`web/src/pages/dmo/IncidentMap.jsx`): heatmap / pins, its own Week / Month /
  Year / All-time range + Rescues-only / All-reports scope, top-5 hotspot ranking with click-to-zoom
- [x] **Positron water tint** (blue ocean) across web + mobile maps (`recolorWater` /
  `MapStyles.resolveDefaultStyle`)
- [x] Login polish: project description, a **Terms of Use & Privacy** page (`/terms`,
  `pages/Terms.jsx`; mobile `terms_screen.dart`) linked from both logins, and developer credits
- [x] Fix `IncidentMap.jsx` render-purity lint warning (range threshold derived outside render)

### P8 — Rescue-team isolation ("Slice 1") (Oct 28) — A/B/C/D
- [x] **Rules** (`firestore/firestore.rules`): a rescue team can only read/update the **reports + assignments its own team is on** (`myTeamId()` / `onMyTeamReport()` / `onMyTeamAssignment()`); clusters become **staff-only**; teams stay readable by responders
- [x] **Rules tests** extended with a responder-visibility suite → **67/67 passing** (was 53)
- [x] **Web** `ResponderPage.jsx`: a rescue team watches **only its assignments**, then loads those reports one-by-one via the new `reportsService.watchReport`; dispatcher/DMO get a **view-only** Responder page; "not on a rescue team yet" empty state
- [x] **Web nav / routing** (`AppShell.jsx`, `AppRoutes.jsx`): Overview drops `rescueTeam`; `/dashboard` redirects rescue teams to `/responder`; the awaiting-verification badge only loads for dispatcher/admin
- [x] **Mobile** `rescue_service.dart`: the cross-team "others still working?" check falls back to `reports.backupTeamIds` when rules deny the assignment query

### P9 — Drawer error placement (Oct 29) — B
- [x] **Drawer errors**: add / edit / enable-disable / delete failures on **Staff** and **Mobile
  users** now render **inside the drawer** (`drawerError` → `<Alert>` at the top) instead of behind
  the overlay (which showed them blurred under the drawer). Row-level actions on Staff with no
  drawer open still use the page alert (`StaffPage.jsx`, `UsersPage.jsx`)

> **Dropped:** an admin "set another account's password" feature (with a Netlify function +
> Firebase Admin SDK) was prototyped and then **removed** — the web SDK can only change the
> signed-in user's own password, and Firebase's own backend (Cloud Functions) needs the Blaze plan.
> Only the drawer-error placement from that work was kept.

### Nov 2 — SUBMIT

---

## 8. Services to create

- [x] Firebase project (Auth + Firestore + FCM) — `drrm-app`
- [x] Cloudinary account (unsigned upload preset `drrm-cloudinary`)

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
| 2026-10-17 | finish-line | Tracker checkbox cleanup; **APK built** (`app-release.apk`, 82.1 MB, debug-signed); `.github/workflows/fetch-data.yml` cron added (skips until the `FIREBASE_SERVICE_ACCOUNT` secret exists — console seed is the no-key fallback); `docs/E2E_TEST_PLAN.md` + `docs/DEMO_SCRIPT.md` written. **Next: run the E2E plan on the live deployment** |
| 2026-10-22 | web+rules | Web fixes: contact-number input limit/validation on team create; **team member management** in the Teams tab (assign/remove responders, writes `users.teamId`) closing the manual-console gap; duplicate "Verified" history fixed (transactional history dedupe + `canVerify` guard + timeline collapse); button colors fixed (clean disabled state, `dangerOutline` Reject). Rules: dispatch staff may set a rescue responder's `teamId` **only** (`changedKeys().hasOnly(['teamId','updatedAt'])`) +3 tests → **53/53 passing**. Web lint/build green; `flutter analyze` clean; `app-debug.apk` (181.6 MB) built. |
| 2026-10-22 | demo | Mobile hazard-overlay **demo data**: real **Ondoy (Ketsana 2009)** snapshot — track + forecast cone + 250 km danger ring + 12/24/36H points, PAGASA PSWS 1/2 across Luzon, per-region rain. Basemap switched to keyless **OpenFreeMap Positron slimmed to place/boundary labels only** (grey, minimal text). Fixed the null-check crash when toggling the Typhoons overlay with no data. `scripts/seed_demo.js` (`--clear`) added. `flutter analyze` clean; `app-debug.apk` rebuilt. |
| 2026-10-22 | seed | **Firestore seeding unblocked**: the Admin SDK key is IAM-denied, so `scripts/lib/firebase_rest.js` seeds via the **Firestore REST API using the Firebase CLI login** (`firebase login`) — no IAM change needed. Seeded `bulletins/active` (Ondoy) + `forecasts/rain`. Firestore **forbids nested arrays**, so the forecast `cone` is stored as a JSON string and `Typhoon.fromMap` parses both forms. `AppConfig.demoMode=false` (app now reads the live seeded feed). Also seeded **10 Bulacan rescue teams** + their `rescueTeam` accounts (`scripts/seed_rescue_teams.js`, Auth users via web API key, `teamId` set): Malolos, Calumpit, Hagonoy, Paombong, Guiguinto, Plaridel, Pulilan, Bustos, Baliwag, San Ildefonso. `flutter analyze` clean; APK rebuilt. |
| 2026-10-22 | sim | **Full-activity simulation** (`scripts/seed_simulation.js`, `--clear`): 8 resident accounts (`<phone>@drrm.local` / `resident123`) with Bulacan addresses, a dispatcher + DMO staff account (`bulacan123`), and **26 reports** across the whole status funnel (Submitted/Verified/Awaiting/Team Assigned/Rescue in Progress/Resolved/Closed/Rejected/Duplicate/Cancelled) with `history[]`, 2 report contacts (PII), **2 clusters**, **11 assignments** (all statuses), **6 rescueRecords**, **32 notifications**, **56 audit logs** — so Dispatch, Responder, DMO, Activity and the bell all have live data. Verified back: 26 sim reports, 11 assignments, 24 users. |
| 2026-10-22 | web-ui | **Web dashboard polish**: left **sidebar nav** + hamburger drawer (replaces top tabs); **web map migrated Leaflet → MapLibre GL v5 + OpenFreeMap Positron** (place-only labels, pins + density, click-select, flyTo) — pinned `maplibre-gl@^5` after a v6 load-event issue; **pagination** on Activity (15/page) and Staff (10/page); **cluster dropdown color fix** (`index.css` `color-scheme: light` + explicit select colors); **Teams search** + **nearest-team suggestion** in report & cluster assign (`geo.js` haversine — shows "Suggested: <team> · X km" and autoselects). Lint clean, build green. |
| 2026-10-25 | web | **Time-based rescue queue** (oldest active report = #1; age-colored map/list, `Next rescue` badge, no manual priority) + **backup teams** (`reports.backupTeamIds` + backup assignments + rules PII gate) + **terminal handling** (reject/duplicate release teams, cancel open assignments, clear `teamId`/`backupTeamIds`, detail panel closes; `Active` list + map exclude terminal); DMO "open reports by waiting time" donut + `waitingMinutes` CSV; docs realigned, `docs/SYSTEM_FLOW.md` added. Lint + build green. |
| 2026-10-23 | web-ui | **Notifications + admin users**: notification dropdown now **viewport-clamped** (`position: fixed`, clamped left, flips above when short on space — no more off-screen overflow from the sidebar/narrow drawer); **admin Users page** (admin-only `/admin/users`) with full CRUD for **mobile-only resident accounts** (create login via Identity Toolkit using the phone→`<digits>@drrm.local` identifier, edit name/email/address, enable/disable, delete; phone is the login identity and read-only after creation) + resident audit log actions; **new-report pop-up + sound** for dispatchers/admin (`ReportAlerts`: toast + Web Audio beep on a fresh `new_report` ping, click → Dispatch). Web lint/build green. |
| 2026-10-26 | rescue-flow | **Rescue flow v2**: web responder = click card → map pin → **Confirm rescue** → `rescue_assigned` notification to all team members; mobile `rescueTeam` app (job list, in-app **Start Tracking** popup, live GPS, **OpenRouteService** road route + ETA, **hold-to-confirm** finish form with people saved / description / up to 5 photos). New: `ResponderMap.jsx`, `rescue_team_shell.dart`, `rescue_service.dart`, `routing_service.dart`, `assignment.dart`; updated `ResponderPage.jsx`, `auth_service.dart`, `main.dart`, `login_screen.dart`. Web build green; **Flutter files not yet analyzed/run** — next: `flutter analyze` + E2E §3. |
| 2026-10-26 | fix | Mobile rescue files now `flutter analyze`-clean — added the missing `RescueRecord` model (`models/rescue_record.dart`) + `RescueService.watchRescueRecord`, imported into `rescue_team_shell.dart`. |
| 2026-10-26 | maps | **Blue water on every map**: Positron `water`/`waterway` layers tinted `#B9D4EA` / `#9CC0DC` — web (`recolorWater` in `dispatch/mapStyle.js`; called by `ReportMap`, `ResponderMap`, `IncidentMap`) and mobile (`MapStyles.resolveDefaultStyle`, now also used by the report screen). Verified: `flutter analyze`/`oxlint` clean. |
| 2026-10-26 | analytics | **DMO Analytics v2** (`DmoPage.jsx`): "At a glance" hero stats (Open now / Resolve rate / Rescued of affected), metric groups (Incident load + **priority split** · Response speed · Rescue outcomes), one-breakdown-at-a-time donut/bar (Status / Priority / Type / Area), Records tabs (Recent reports / Rescue operations, expand-to-10). New **hotspot map** `IncidentMap.jsx` — heatmap/pins, own Week/Month/Year/All range + Rescues-only/All-reports scope, top-5 hotspot areas with click-to-zoom. CSV now exports `priority` (was `waitingMinutes`). Lint/build green. |
| 2026-10-26 | about | **Login + terms**: project description, developer credits (**Group 5 · 3J-G1** · IT 305 · Bulacan State University) and a **Terms of Use & Privacy** page linked from both logins — web `pages/Terms.jsx` (`/terms`) + constants in `web/src/config/appConfig.js`; mobile `terms_screen.dart` + `AppConfig.termsOfUse`. |
| 2026-10-29 | P9 | **Drawer error placement**: add / edit / enable-disable / delete failures on **Staff** and **Mobile users** now show **inside the drawer** (`drawerError` → `<Alert>` at the top) instead of behind the overlay (the "email already registered" text no longer renders blurred under the drawer); Staff row-level actions with no drawer open keep the page alert. Files: `StaffPage.jsx`, `UsersPage.jsx`. A password-reset feature (Netlify function + Firebase Admin SDK) was prototyped during this work and **removed** — see the note in **§P9**. Lint 0 errors (2 pre-existing warnings). |
| 2026-10-28 | Slice 1 | **Rescue-team isolation**: a rescue team now sees **only its own assignments + the reports on them** (rules `myTeamId()` / `onMyTeamReport()` / `onMyTeamAssignment()`; clusters staff-only). Web `ResponderPage` scoped per role (dispatcher/DMO **view-only**) + new `reportsService.watchReport`; `AppShell` Overview drops `rescueTeam`; `/dashboard` redirects rescue teams to `/responder`. Mobile finish-rescue cross-team check falls back to `reports.backupTeamIds` when rules deny. Files: `firestore.rules`, `scripts/rules-test/run-tests.js`, `AppShell.jsx`, `reportsService.js`, `ResponderPage.jsx`, `AppRoutes.jsx`, `rescue_service.dart`. **Rules tests 67/67**; `flutter analyze` clean + 110 tests; web build green (lint 0 errors, 1 warning). Deployed `firestore:rules` + hosting. |

---

## 11. Pending work

- **Mobile map layers (visual polish)** — improve the typhoon overlay rendering: tapered
  forecast cone with a dashed outline + subtle fill, a **dashed danger-radius circle** (outline,
  not a filled disk), track vertex dots, and forecast points styled (T/TY discs + 12/24/36H
  labels). Revisit the basemap look (open: restore MapTiler Streets vs keep the grey Positron).
- **Mobile profile redesign** — rebuild `mobile/lib/screens/profile_tab.dart` to the reference:
  light-grey background, white rounded section cards with a red accent — **PERSONAL INFORMATION**
  (phone, full name, gender | age, disabilities pill), **HOME ADDRESS** (city, barangay, street,
  address), **HOUSEHOLD** (house floors, pets pill); keep My Reports + sign-out. Show **N/A** for
  gender when absent (the register doesn't capture it yet).

### Rescue flow follow-ups
- **Show rescue photos on the web** — `rescueRecords.imageUrls` is saved by mobile and the DMO
  **Records → Rescue operations** tab now lists `peopleRescued` + `notes`, but the **photos** still
  aren't displayed on any web screen (completed assignment card / DMO outcome view).
- **Background GPS** — tracking is foreground-only; add Android `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`
  and a foreground notification so tracking survives a locked screen.
- **FCM push for `rescue_assigned`** — popup only appears while the app is open; real push needs an FCM token collection +
  Cloud Function (same future work as DEFENSE_NOTES §8).
- **Decline reason on web** — web decline still writes no reason (mobile no longer declines; confirm happens on web).
- **ORS dependency** — free-tier key + third-party service; OSRM is a keyless drop-in if OpenRouteService is down.
