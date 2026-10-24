# FinalProject_DRRM — Defense Notes

Prep sheet for the panel defense: what we built, why it's built this way, known gaps, and
honest answers to likely questions.

---

## 1. One-paragraph pitch

A serverless disaster reporting & monitoring system: **residents** (Flutter) report floods,
fires, etc. with GPS/pin location and up to 3 photos; **dispatchers** (React web) verify,
prioritize, spot duplicates, and assign rescue teams on a live map; **rescue teams** accept,
execute and record outcomes; the **DMO** gets analytics with CSV/PDF export. Firebase
(Auth + Firestore + Hosting + Cloud Functions-free) is the whole backend; security is
enforced in Firestore rules, not app code.

## 2. Architecture decisions (and the "why")

| Decision | Rationale (defense-ready) |
|---|---|
| **Firebase serverless, no API server** | Zero-ops, free tier fits a class project; realtime listeners replace polling; auth + rules + hosting in one platform. Matches the "no backend" constraint we locked. |
| **Security in Firestore rules, not the client** | The client is untrusted: rules re-validate status enums, `imageUrls ≤ 3`, PII gating, and audit immutability server-side. We even **test the rules** with the emulator (`scripts/rules-test`, 50/50 passing). |
| **Roles as a field + rules hierarchy** | `resident < dispatcher < rescueTeam < dmo < admin`; `active:false` is a global kill switch checked in rules and at login. Admin cannot demote/delete self (no lockout). |
| **PII separation (`reportContacts/{reportId}`)** | Victim name/phone/needs are isolated from `reports` so we can gate them tightly (Data Privacy Act of 2012, §8 of requirements): staff always; **assigned rescue team only** (via `users.teamId == reports.teamId`); reporters see their own. |
| **Audit log as append-only collection** | `logs` writes are rule-bound to `uid == auth.uid`, updates/deletes are denied (`allow update, delete: if false`). 18 action types incl. staff changes, verifications, assignments, closures — surfaced on the admin Activity page (FR-13). |
| **Geohash/grid approximation over PostGIS** | No server means no PostGIS; duplicates (≈110 m cells, same type, 24 h) and density clusters (≈1 km cells) are client-side grid computations — documented as approximate, good enough for triage. |
| **Resident → dispatcher pings with a rule-locked shape** | Mobile writes a fixed-shape `new_report` notification (exact keys, `read:false`, target must be dispatcher/admin, reporter must own the report). This lets residents trigger notifications without opening a write hole. |
| **Staff accounts created in-web via Identity Toolkit REST** | The Admin SDK path is blocked in our environment (IAM), and using the client SDK would sign the admin out; the REST call creates the Auth user without touching the admin session. |
| **SwiftUI-style separation: services layer** | All Firestore access goes through `web/src/core/services/*` and `mobile/lib/core/*_service.dart` — pages never call Firestore directly, so swapping the backend touches one layer. |

## 3. Security posture

- Deny-all catch-all rule; every collection enumerated explicitly.
- Report creation is resident-only, `status` forced to `Submitted`, priority enum-checked.
- Responders can update **status only** (cannot touch `priority`, `verifiedBy`, `reporterId`).
- `reportContacts` (PII) is the tightest surface — assignment-gated for rescue teams.
- PAGASA/JMA feeds (`bulletins`, `forecasts`) are read-only from clients; writes only via
  Admin SDK scripts (GitHub Actions cron).
- Uploaded photos go to Cloudinary (unsigned preset, mobile-only path) — only URL strings
  persist in Firestore.
- **Known hardening gap:** image *content* validation (type/size) is enforced on the mobile
  client (R3-lite) but a signed-upload server-side policy is future work.

## 4. Known limitations — say these before the panel finds them

1. **`history.at` type inconsistency (documented, being fixed in R3-lite).** The web writes
   `reports.history[].at` as epoch-ms (`Date.now()`), mobile originally wrote ISO-8601
   strings. Web readers already use a tolerant dual parser; R3-lite standardizes mobile to
   epoch ms. Old mobile rows keep ISO strings — hence the parser stays.
2. **No push notifications (FCM) yet.** Notifications are **in-app** (web bell with unread
   badge; mobile pings). We deliberately scoped FCM out (token management, foreground vs
   background handlers,APNs setup) and used the free in-app pattern instead. **Future work:**
   add an FCM token collection + a Cloud Function on `notifications` create to fan out push;
   the data shape is already notification-ready.
3. **Offline-first + SMS fallback are roadmap (P4b), not shipped.** Requirements §8 asks for
   alternative reporting when connectivity fails; our plan is queued reports/photos + an
   outbound SMS composer prefilled to the LDRRMO hotline with coordinates. Documented as
   future work, not claimed as done.
4. **Geospatial is approximate.** Duplicate detection and clustering are grid-based; two
   reports in the same cell aren't necessarily duplicates — that's why dispatch confirms
   before marking `Duplicate`.
5. **`teamId` is assignable from the web now.** Rescue-team PII access depends on
   `users/{uid}.teamId`; dispatch staff assign responders to teams in the **Teams** tab
   (which writes both `teams.memberUids` and the responder's `teamId`), so the manual console
   step is gone. A rescue team without `teamId` still cannot see contact PII even when assigned.
6. **No file-type validation server-side for images** (Cloudinary unsigned upload); size/type
   checks are client-side (R3-lite).
7. **Duplicate detection ignores description text** — it keys on type + location + time only.
8. **Priority is time-only (deliberate FR-06 deviation).** FR-06 asks for prioritization "based on
   urgency and risk". We deliberately rank by **submission time** — the oldest active report is
   rescued first — which is transparent, severity-free and impossible to game. There is **no
   manual `low/medium/high` input** in the UI; the stored `priority` field is legacy (mobile still
   writes `medium`) and unused for ordering.

## 5. Backup & disaster recovery (requirement §8)

- **Data:** Firestore lives in Google Cloud with multi-zone replication by default; the
  project is on the free Spark plan, so **PITR/scheduled exports are not enabled** — recovery
  today = manual `firebase firestore:export` / Admin SDK export to a GCS bucket (documented
  runbook, not automated).
- **Code:** git (GitHub) is the source of truth; deploys are reproducible from a checkout
  (`firebase deploy --only firestore,hosting`), rules/indexes are in-repo.
- **Credentials:** no secrets in git — web config is client-safe identifiers; map keys are
  gitignored (`map_config.dart`, `.env`).
- **If Firebase is down:** the system degrades to the documented SMS/hotline fallback
  (future work); staff keep paper dispatch. This is an accepted, documented risk for a
  class-project deployment tier.

## 6. Requirements traceability (FR map)

| FR | Where |
|---|---|
| FR-01 Auth | Firebase Auth; phone+password (mobile), email (web); `active` kill switch |
| FR-02 Reporting | Mobile report flow (7 disaster types) |
| FR-03 Location | GPS + manual pin (lat/lng stored) |
| FR-04 Images | ≤3 Cloudinary photos per report (rules-enforced cap) |
| FR-05 Management | Dispatch verify / reject-with-reason / close |
| FR-06 Prioritization | Time-based rescue queue (oldest active report = #1); map + queue ordering. *(Deviation: no urgency/severity input — see §4.8)* |
| FR-07 Assignment | Single-report, **backup team**, and cluster assignment; team status flips |
| FR-08 Status monitoring | `history[]` timeline (mobile) + status board (web) |
| FR-09 Notifications | In-app fan-out both directions (rule-locked pings) |
| FR-10 Mapping | Leaflet live map (web), MapLibre overlays (mobile) |
| FR-11 Rescue records | `rescueRecords` on completion (people rescued + notes) |
| FR-12 Reports/stats | DMO analytics + CSV/PDF export |
| FR-13 Audit trail | Append-only `logs` + admin Activity page |
| FR-14 Duplicate detection | Grid flags + "mark as duplicate" workflow |
| FR-15 Verification | `verifiedBy` recorded; verified vs submitted filters |

## 7. Test evidence

- `scripts/rules-test/` — Firestore emulator security suite, **53/53 passing** (roles, PII
  gates, teamId scoping, ping shape, report field validation, log immutability).
- Web: `npm run lint` + `npm run build` green at last check.
- Mobile: `flutter analyze` clean at last check; 12 province/signal resolver tests.
- Deployed: rules + hosting live on project `drrm-app` (drrm-app.web.app).

## 8. If asked "what would you do next?"

1. FCM push via a Cloud Function triggered on `notifications` create.
2. Offline-first queueing + outbound SMS fallback (P4b).
3. Signed Cloudinary uploads / server-side media policy.
4. Automated Firestore export schedule (backup runbook).

*(Team management UI for `teamId` — the manual console step — is now done in the web Teams tab.)*
