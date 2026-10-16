# FinalProject_DRRM — E2E Test Plan

End-to-end pass on the **live deployment** (web: https://drrm-app.web.app · mobile: release
APK). Walk the steps in order — each has the expected result. Anything that fails goes to the
**Results** table at the bottom (date, step, what happened) so regressions are visible.

Prereqs: web build deployed, rules deployed (2026-10-17), APK installed on an Android device
or emulator, internet on.

---

## 0. Setup (once)

1. Log in to the **web** as `admin`.
2. **Staff page** → create (or confirm) accounts:
   - `dispatcher1@drrm.test` (role `dispatcher`)
   - `rescue1@drrm.test` (role `rescueTeam`) — **leave `teamId` unset for now** (step 3.5
     verifies the PII gate denies first)
   - `dmo1@drrm.test` (role `dmo`)
   - Set a known password for each; keep them `active`.
3. On mobile: **register a resident** (`+639171234567`, full profile incl. city/barangay) —
   used for all submissions.
4. **Dispatch page** → **Teams** → create team "Rescue Alpha" (any contact number).
   Note its name.

> `teamId` has no UI (known gap): when step 3.5 asks for it, open **Firebase console →
> Firestore → users/{rescue1 uid} → add field** `teamId` (string) = the **team document id**
> (Firestore shows the doc id under the team's name in the console's `teams` collection —
> or add the team doc id to the runbook notes when creating it).

## 1. Resident — submit (mobile)

| # | Step | Expected |
|---|---|---|
| 1.1 | Log in with the phone number | Map-first home, typhoon/hazard area (empty feeds OK — no key yet) |
| 1.2 | Tap **Report** → pick **Flood**, describe, GPS or tap-map pin, **2 photos** | Photos preview; pin renders |
| 1.3 | Try adding a `.txt` renamed photo or a >10 MB image | Rejected with a snackbar naming the file and reason (type/size) |
| 1.4 | "Who is this for" → **Someone else**: victim name + contact + special needs "elderly, PWD" | Contact block filled |
| 1.5 | **Submit** | Snack "Report submitted", screen closes |
| 1.6 | Profile → **My Reports** | Report shows `Submitted` with timestamp; history timeline present |
| 1.7 | Submit a **second** report of the same type within ~110 m | Both appear; later one gets flagged on web (step 2.3) |

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
| 2.4 | Set **priority = high** | Map pin + queues re-sort; reporter notified |
| 2.5 | **Reject** the *first* report with a reason | Status `Rejected` + reason; resident notified **with the reason text** |
| 2.6 | On the second report: **Verify** (records verifier) → **Assign "Rescue Alpha"** | Status → `Team Assigned`; team flips to `assigned`; rescue team notified; assignment row created |
| 2.7 | Optional: select 2+ nearby reports → **suggested cluster** → cluster-assign | One assignment covers the cluster; live progress visible |

## 3. Rescue team — respond (web)

Log in as `rescue1@drrm.test`.

| # | Step | Expected |
|---|---|---|
| 3.1 | Open queue | Assignment listed as `dispatched` |
| 3.2 | **Accept**, then **Start** | Status `in_progress`; report → `Rescue in Progress`; resident notified |
| 3.3 | Open the report's **contact details** — *before* `teamId` is set | **PII blocked** (permission error / empty) — this is the §8 gate working |
| 3.4 | Console: set `users/{rescue1}.teamId` = team doc id (see Setup note) | — |
| 3.5 | Reload the report → open contact details again | **PII visible** (name, contact, special needs) |
| 3.6 | **Complete** with people rescued = 2 + outcome notes | `rescueRecords` row created; report → `Resolved`; resident notified |
| 3.7 | (Back as dispatcher) **Close** the report | Status `Closed`; audit `report_close` |

## 4. DMO — analytics (web)

Log in as `dmo1@drrm.test`.

| # | Step | Expected |
|---|---|---|
| 4.1 | Open analytics | KPIs count today's reports; avg time-to-verify/resolve present |
| 4.2 | Charts | Type/priority bars include Flood; status donut includes Resolved/Closed; **reports by area** shows the resident's barangay/city |
| 4.3 | Apply a date-range filter | Numbers update consistently |
| 4.4 | **Export CSV** and **PDF** | Both download with the current view's data |

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

## 7. Results log

| Date | Step | Result / notes |
|---|---|---|
| | | |
