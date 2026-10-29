# FinalProject_DRRM — E2E Test Plan

End-to-end pass on the **live deployment** (web: https://drrm-app.web.app · mobile: release
APK). Walk the steps in order — each has the expected result. Anything that fails goes to the
**Results** table at the bottom (date, step, what happened) so regressions are visible.

Prereqs: web build deployed, **latest rules deployed** (includes backup-team PII access), APK
installed on an Android device or emulator, internet on. For the rescue flow (§3) you need a
**second phone/emulator** (or the same device after logging out) for the rescue team, a build that
includes the rescue files, and a free OpenRouteService token in `mobile/lib/config/map_config.dart`
(`orsKey`) — without it the route is a straight line (still pass-able, note it in Results).

---

## 0. Setup (once)

1. Log in to the **web** as `admin`.
2. **Staff page** → create (or confirm) accounts:
   - `dispatcher1@drrm.test` (role `dispatcher`)
   - `rescue1@drrm.test` (role `rescueTeam`)
   - `dmo1@drrm.test` (role `dmo`)
   - Set a known password for each; keep them `active`.
3. On mobile: **register a resident** (`+639171234567`, full profile incl. city/barangay) —
   used for all submissions.
4. **Dispatch page** → **Teams** → create teams "Rescue Alpha" and "Rescue Bravo" (any contact
   number). Then on the **Alpha** team card use **Add responder** to add `rescue1` — this writes
   `users/rescue1.teamId` **and** `teams.memberUids` (needed for the mobile popup; no Firebase-console
   step). Steps 3.5–3.7 verify the PII gate using this.
5. **Login / terms / maps (visual):** the **web** login shows the project description, a **Terms of
   Use & Privacy** link (opens `/terms`), and developer credits (**Group 5 · 3J-G1** · IT 305 ·
   BulSU). The **mobile** login shows the description, a **Terms of Use & Privacy** link, and the
   credits line. On any map the **ocean/water is tinted blue** (`#B9D4EA`), not grey.

## 1. Resident — submit (mobile)

| # | Step | Expected |
|---|---|---|
| 1.1 | Log in with the phone number | Map-first home, typhoon/hazard area (empty feeds OK — no key yet) |
| 1.2 | Tap **Report** → pick **Flood**, describe, GPS or tap-map pin, **2 photos** | Photos preview; pin renders |
| 1.3 | Try adding a `.txt` renamed photo or a >10 MB image | Rejected with a snackbar naming the file and reason (type/size) |
| 1.4 | "Who is this for" → **Someone else**: victim name + contact + special needs "elderly, PWD" | Contact block filled |
| 1.5 | **Submit** | Snack "Report submitted", screen closes |
| 1.6 | Profile → **My Reports** | Report shows `Submitted` with timestamp; history timeline present |
| 1.7 | Submit a **second** report of the same type within ~110 m (duplicate candidate) **and** a **third** report of a different type | Later same-type one gets flagged on web (2.3); the third is used to test Reject (2.5) |

Console spot-check (Firestore → reports/{newest}):
- `geohash` is a base32 string (8 chars) ✓
- `history[0].at` is a **number** (epoch ms) ✓
- `notifications` has one `new_report` doc per dispatcher/admin uid, `read: false` ✓

## 2. Dispatcher — triage (web)

| # | Step | Expected |
|---|---|---|
| 2.1 | Log in as dispatcher; check the **bell** | Unread badge ≥ 1; "New report needs verification" ping for 1.5 |
| 2.2 | Open the new report | Detail panel shows description, pin on map, **contact PII visible** |
| 2.3 | Duplicate flag: the second same-type report shows **"Possible duplicate"** with a link to the original; click **Mark as duplicate** | Status → `Duplicate`; audit entry `report_duplicate` |
| 2.4 | Note the **rescue queue**: the oldest active report is **#1 / "Next rescue"**; pins/list ordered by waiting time | Queue ordering follows submission time (no manual priority) |
| 2.5 | **Reject** a separate report (submit one extra in Step 1.7) with a reason | Status `Rejected` + reason; resident notified with the reason; detail panel closes and the report leaves the active list/map |
| 2.6 | On the **first** report: **Verify** (records verifier) → **Assign "Rescue Alpha"** | Status → `Team Assigned`; team flips to `assigned`; rescue team notified; assignment row created |
| 2.7 | On the assigned report: **Add backup team** → "Rescue Bravo" | Second assignment created; both teams listed under **Assigned rescue teams** (Primary + Backup) |
| 2.8 | Optional: select 2+ nearby reports → **suggested cluster** → cluster-assign | One assignment covers the cluster; live progress visible |

## 3. Rescue team — respond (web confirm + mobile field app)

Use **two sessions**: web as `rescue1@drrm.test` (responder), and the mobile app signed in with the
same `rescue1@drrm.test` (login screen → **Rescue Team? Sign in with email**). Allow location
permission on the phone.

> **Slice 1 — team scoping:** a rescue team now sees **only its own team's assignments** (and the
> reports on them). If `rescue1` isn't on a team the Responder page shows *"You're not on a rescue
> team yet"* instead of any cards; a dispatcher/DMO opening Responder gets a **view-only** page.
> `/dashboard` redirects a rescue team straight to `/responder`.

| # | Step | Expected |
|---|---|---|
| 3.1 | Web: open **Responder** | Assignment card listed `Dispatched` |
| 3.2 | Web: **click the card** | Map shows the destination **pin** at the report's coordinates; description + dispatcher notes shown |
| 3.3 | Web: **Confirm rescue** | Assignment → `Accepted`; notice "N of N team member(s) notified on mobile"; one `notifications` doc (`type:rescue_assigned`, `assignmentId`) per `memberUids` entry |
| 3.4 | Mobile (app open): wait a second | **"Rescue assigned" popup** with **Later** / **Start Tracking** |
| 3.5 | Mobile: **Start Tracking** | Job map opens; report → `Rescue in Progress`; resident notified; blue dot + red pin; **road route** with distance/ETA banner (straight line + snackbar if no ORS key) |
| 3.6 | Move the phone / fake GPS ≥ 10 m | Blue dot moves; Firestore `assignments.responderLocation` updates (~10 s); **web map shows the live blue dot** and "Last GPS update" |
| 3.7 | Open the report's **contact details** (web) | **PII visible** — your team is assigned (`users.teamId` matches the report, incl. backup teams) |
| 3.8 | Teams tab: **remove** `rescue1` from the team, reload the report | **PII hidden** (empty / permission denied) — the §8 gate working |
| 3.9 | Teams tab: **re-add** `rescue1`, reload | **PII visible** again |
| 3.10 | Mobile: **tap** (don't hold) "Hold to Confirm Rescue" | Nothing happens (bar resets) |
| 3.11 | Mobile: **press and hold ~1.5 s** | Bar fills, **finish form** opens |
| 3.12 | Mobile: people saved = 2, description, **2 photos** → **Save & Finish** | `rescueRecords` row has `peopleRescued:2`, `notes`, `imageUrls` (2 Cloudinary URLs); assignment `completed`; report → `Resolved`; resident notified; screen closes |
| 3.13 | Mobile: try a `.txt`-renamed photo / >10 MB image in the form | Rejected with a message naming the file |
| 3.14 | Mobile: dismiss the popup with **Later**, then open the job from the list | Job screen opens; **Start Tracking** button available (status `accepted`) |
| 3.15 | (Back as dispatcher) **Close** the report | Status `Closed`; audit `report_close` |

Optional: with **two teams** on one report (primary + backup), finish only one → report stays
`Rescue in Progress`; finish the second → report `Resolved`.

## 4. DMO — analytics (web)

Log in as `dmo1@drrm.test`.

| # | Step | Expected |
|---|---|---|
| 4.1 | Open analytics | **At a glance** hero stats: Open now / Resolve rate / Rescued of affected; range + disaster-type filters at the top (Reset appears once changed) |
| 4.2 | Metric groups | **Incident load** (reports, reporters, people affected + **priority split**), **Response speed** (avg verify/resolve, resolved), **Rescue outcomes** (ops, people rescued, avg per op) |
| 4.3 | **Patterns → Break down by** | Toggle **Status / Priority / Type / Area** — the donut/bar swaps; no more "waiting time" donut |
| 4.4 | **Hotspots** map | Heatmap ↔ Pins toggle; Week/Month/Year/All-time + Rescues-only/All-reports; legend swaps; **top-5 hotspot areas** list zooms the map on click; blue ocean |
| 4.5 | **Records** | Tabs **Recent reports** (Type/Area/Status/**Priority**/People/Submitted) and **Rescue operations** (When/People rescued/Notes); "Show most recent" expands to 10 |
| 4.6 | Apply a date-range filter | Numbers update consistently across stats, charts and the hotspot map |
| 4.7 | **Export CSV** and **PDF** | Both download with the current view; CSV columns are `…status, priority, peopleAffected, peopleRescued, area…` (no `waitingMinutes`) |

## 5. Admin — governance (web)

| # | Step | Expected |
|---|---|---|
| 5.1 | Staff page: create a throwaway `x@drrm.test` (dispatcher), then **disable** it | Login as that user is blocked ("account disabled") |
| 5.2 | Re-enable, change role to `dmo`, then **delete** | Each action reflected; audit entries `staff_*` |
| 5.3 | Open **Activity** page | Timeline shows: logins, report verify/reject/priority/duplicate/close, team create, assignments, staff actions — with uids and timestamps |
| 5.4 | Try opening a page outside your role | Route guard blocks (no nav entry, direct URL rejected) |

## 6. Negative checks (rules hold on live data)

| # | Step | Expected |
|---|---|---|
| 6.1 | Resident (mobile) tries editing a report's `status` | Denied by rules (permission denied) |
| 6.2 | Resident creates a notification with `type` ≠ `new_report` or targeting a non-dispatcher | Denied (`validNewReportPing`) |
| 6.3 | Any staff tries `update`/`delete` on `logs` | Denied (append-only) |
| 6.4 | Rescue team member of **another** team opens Responder, or reads a report/assignment not on their `teamId` | Denied — their list is empty; direct reads return permission denied (team scoping) |
| 6.5 | Rescue team member tries to list **every** report/assignment (no `teamId` filter) or read clusters | Denied by rules |

## 7. Results log

| Date | Step | Result / notes |
|---|---|---|
| | | |
