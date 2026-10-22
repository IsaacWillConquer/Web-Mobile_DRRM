# FinalProject_DRRM — ERD (Firestore Data Model)

Backend: **Firebase Firestore** (NoSQL, document store). There is **no server, no SQL database** —
this ERD documents the document/collection structure instead of tables. All access is governed by
`firestore/firestore.rules` (see §3).

Notation: `collection/{id}` — `{id}` is an auto-id unless stated otherwise. Types: `string`,
`number`, `bool`, `timestamp` (Firestore serverTimestamp), `array<T>`, `map`.

---

## 1. Entity overview

```
users/{uid} ──────────┐ (reporterId)
                      ▼
                 reports/{id} ──────── reportContacts/{reportId}   (1:1, PII)
                      │    │
                      │    └── assignments/{id} ── rescueRecords/{id}
                      │              │
                      │              └── teams/{id}
                      │
             clusters/{id}  (groups reports)      notifications/{id} (fan-out, per user)
                                                  logs/{id}          (append-only audit)
                                                  config/dispatch    (single doc)
                                                  bulletins/*        (read-only feed)
                                                  forecasts/rain     (read-only feed)
```

There are **no subcollections** — every collection is top-level. `reportContacts` is keyed by
report id (1 report ↔ 1 contact doc). Report status history lives in an **array field**
(`reports.history`), not a subcollection.

## 2. Collections

### 2.1 `users/{uid}` — doc id = Auth uid
| Field | Type | Notes |
|---|---|---|
| `email` | string | web: real email; mobile: synthetic `63…@drrm.local` (phone auth) |
| `name` | string | display name |
| `firstName` / `middleName` / `lastName` / `suffix` | string | mobile signup wizard |
| `phone` | string | E.164 (`+63…`) on mobile |
| `role` | string | `resident` \| `dispatcher` \| `rescueTeam` \| `dmo` \| `admin` |
| `active` | bool | `false` = disabled (login blocked, loses all rules access) |
| `profile` | map | residents only: `{birthdate: timestamp, disability: array<string>, address: {city, barangay, street, line}, household: {houseFloor, pets}}` |
| `teamId` | string? | rescue-team PII gate (rules §3). Set via console/admin — not written by app code |
| `createdAt` / `updatedAt` | timestamp | |

Relationships: 1 user → N reports (`reports.reporterId`); 1 user → N notifications
(`notifications.userId`); team membership: `users.teamId` ↔ `teams/{id}`.

### 2.2 `reports/{id}` — the central entity
| Field | Type | Notes |
|---|---|---|
| `reporterId` | string (uid) | immutable after create |
| `onBehalfOf` | string | `'self'` \| `'other'` |
| `disasterType` | string | Flood, Fire, Earthquake, Landslide, Typhoon, Storm Surge, Other |
| `description` | string | |
| `lat`, `lng` | number | GPS or map pin |
| `imageUrls` | array<string> | Cloudinary URLs, **max 3** (rule-enforced) |
| `status` | string | lifecycle below |
| `priority` | string | `low` \| `medium` \| `high` |
| `peopleAffected` | number | |
| `teamId` | string? | assigned team (drives PII gate) |
| `clusterId` | string? | set when assigned as a cluster |
| `verifiedBy` | string? (uid) | set on `Verified` |
| `rejectionReason` | string? | set on `Rejected` |
| `history` | array<map> | `{status, by: uid, at}` — see type note below |
| `createdAt` / `updatedAt` | timestamp | |

**Status lifecycle** (`Submitted → Under Verification → Verified → Awaiting Assignment →
Team Assigned → Rescue in Progress → Resolved → Closed`, plus `Rejected` / `Duplicate` /
`Cancelled`):

| Transition | Who |
|---|---|
| create → `Submitted` | resident (mobile only) |
| → `Verified` (+`verifiedBy`) | dispatcher/admin |
| → `Rejected` (+`rejectionReason`) | dispatcher/admin |
| → `Duplicate` (duplicate flag review) | dispatcher/admin |
| → `Team Assigned` | dispatcher/admin on assignment |
| → `Rescue in Progress` | rescue team (start) |
| → `Resolved` | rescue team (complete → creates `rescueRecords` row) |
| → `Closed` | dispatcher/admin (from `Resolved` only) |

> **Known type inconsistency:** `history[].at` is written as an **epoch-ms number** by the web
> (`arrayUnion` with `Date.now()`) and as an **ISO-8601 string** by the mobile submit path.
> Web readers use a tolerant dual parser. R3-lite standardizes mobile to epoch ms; old mobile
> rows keep ISO strings and the dual parser stays.

### 2.3 `reportContacts/{reportId}` — doc id = report id (**PII**, §8 DPA)
| Field | Type |
|---|---|
| `subject` | string `'self'` \| `'other'` |
| `victimName` | string |
| `victimContact` | string (phone) |
| `relationship` | string |
| `peopleCount` | number |
| `specialNeeds` | array<string> (e.g. elderly, PWD, infant) |
| `notes` | string |
| `updatedAt` | timestamp |

Read access is the tightest in the system: staff (dispatcher/dmo/admin) always; the **assigned
rescue team only while `users/{uid}.teamId == reports/{reportId}.teamId`**; the reporter may
read their own submission's doc.

### 2.4 `teams/{id}`
`name` (string), `contact` (string phone), `status` (`available` \| `assigned`), `memberUids`
array<uid>, `createdAt` / `updatedAt`.

### 2.5 `assignments/{id}`
`reportId`? (single-report dispatch) or `clusterId`? (cluster dispatch — one of the two),
`teamId`, `status` (`dispatched → accepted → in_progress → completed`, terminal `declined`),
`dispatchedBy` (uid), `updatedBy` (uid), `notes`, `createdAt` / `updatedAt`.

### 2.6 `rescueRecords/{id}` — outcome records (1 per completed assignment)
`assignmentId`, `reportId`?, `teamId`?, `peopleRescued` (number), `notes` (outcome narrative),
`recordedBy` (uid), `createdAt` / `updatedAt`.

### 2.7 `clusters/{id}`
`center` map `{lat, lng}`, `cell` string (grid key `"lat.toFixed(2),lng.toFixed(2)"` ≈1 km),
`reportIds` array<string>, `reportCount`, `peopleAffected` (number), `priority`, `status`
(`open`), `createdAt` / `updatedAt`. Suggested clusters are computed client-side (2-decimal
grid); persisted clusters are created by dispatch on cluster assignment.

### 2.8 `notifications/{id}` — per-user fan-out
`userId`, `title`, `body`, `read` (bool), `readAt` (timestamp), `reportId`?, `type`? (only
`'new_report'`), `createdAt`.
Two producer shapes:
- **Staff → reporter** (web): verify / reject / priority / assign / rescue-in-progress / completed.
- **Resident → dispatchers** (mobile, on report submit): fixed-shape `type:'new_report'` ping to
  every uid in `config/dispatch.dispatcherUids`. Rules lock this shape exactly (keys, `read:false`,
  target must be dispatcher/admin, reporter must own the report).

### 2.9 `logs/{id}` — append-only audit (FR-13)
`uid` (== auth uid, rule-enforced), `action` (string enum: `auth_login`, `auth_logout`,
`web_login_blocked`, `staff_created`, `staff_role_changed`, `staff_active_changed`,
`staff_deleted`, `report_verify`, `report_reject`, `report_priority`, `report_assign`,
`cluster_assign`, `report_duplicate`, `report_close`, `team_create`, `assignment_accept`,
`assignment_decline`, `assignment_start`, `assignment_complete`), `details` (map, free-form),
`createdAt`. Update/delete forbidden by rules. Surfaced on the admin **Activity** page.

### 2.10 `config/dispatch` — single doc
`dispatcherUids` array<uid> (kept in sync from Staff page), `updatedAt`. Readable by any
signed-in user (mobile needs it to route pings); admin-only writes.

### 2.11 Feeds (read-only from clients; written by Admin SDK scripts)
- `bulletins/{id}` — PAGASA/JMA typhoon: `typhoonName`, `internationalName`, `category`,
  `source`, `sourceUrl`, `postedAt`, `active` (bool), `signals[]` `{level:int, areas:string[]}`,
  `track[]` `{lat,lng}`, `forecast[]` `{lat,lng,hours,label}`, `dangerRadiusKm`. Writers:
  `scripts/fetch_typhoon.js` (JMA, GitHub Actions cron), `scripts/seed_demo.js` (demo sample, REST).
- `forecasts/rain` — Open-Meteo rain: `source`, `sourceUrl`, `postedAt`, `windowDays`,
  `regions[]` `{name, level (1–3), mm}`. Writer: `scripts/fetch_rain.js`.

## 3. Relationships & access (rules summary)

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `users` | own; staff read all | self (forced `resident`+`active`); admin | self (not role/active); admin (not self) | admin (not self) |
| `reports` | own; all responders | own, `Submitted`, ≤3 images, valid priority | staff (valid status/priority); owner (not status/priority); responders (status only) | dispatcher/admin |
| `reportContacts` (PII) | staff; assigned team (`teamId` match); own | staff; own | staff; assigned team | dispatcher/admin |
| `clusters` / `teams` | responders | dispatcher/admin | dispatcher/admin | dispatcher/admin |
| `assignments` | responders | dispatcher/admin | dispatcher/admin; rescue team | dispatcher/admin |
| `rescueRecords` | responders | rescue team / dispatcher | dispatcher/admin | dispatcher/admin |
| `notifications` | own | responders; resident fixed ping (own report → dispatcher/admin) | own (`read`) | staff |
| `config` | any signed-in | admin | admin | admin |
| `logs` | staff | any signed-in (uid == self) | — | — |
| `bulletins` / `forecasts` | any signed-in | — (Admin SDK only) | — | — |
| anything else | deny all | deny all | deny all | deny all |

Role hierarchy: `resident < dispatcher < rescueTeam < dmo`, with `admin` as superuser;
`active:false` disables everything.

## 4. Indexes (`firestore/firestore.indexes.json`)
- `reports`: `status+createdAt desc`, `reporterId+createdAt desc`
- `assignments`: `teamId+createdAt desc`, `teamId+status+createdAt desc`
- `rescueRecords`: `assignmentId+createdAt desc`
- `notifications`: `userId+createdAt desc`

## 5. Design notes
- **Geo:** coordinates are plain numbers (`lat`/`lng`); no GeoPoint, no PostGIS. Proximity and
  duplicate detection are **geohash/cell-grid approximations** (client-side): duplicates key on
  `disasterType + round3(lat), round3(lng)` ≈110 m cells within 24 h (FR-14); clusters/density
  key on 2-decimal ≈1 km cells. R3-lite adds a `geohash` string on submit for future geoqueries.
- **Timestamps:** `serverTimestamp()` everywhere except the `history[].at` dual-type noted above.
- **Images:** Cloudinary unsigned upload (mobile), only the `secure_url` strings persist in
  `reports.imageUrls`.
- **No push tokens:** there is no FCM token collection — notifications are in-app (bell badge
  on web, notifications screen on mobile). See DEFENSE_NOTES.md for FCM as future work.
