# FinalProject_DRRM — User Manual

A practical guide for every role: **residents** (mobile app) and **staff** — dispatcher,
rescue team, DMO, admin (web portal).

> ⚠️ **Safety notice:** submitting a report through this app does **not** guarantee an
> immediate rescue. For life-threatening emergencies, always call **911** or your local
> **LDRRMO hotline** first. The app complements — it does not replace — official dispatch.

---

## 1. Accounts & signing in

### Mobile — residents (phone + password)
1. Install and open the **DRRM** app.
2. **Register** (first time): enter your mobile number (`+63…`), name, birthdate, disability
   info (optional), home address (city/barangay/street) and household details. This profile
   powers "reports by area" analytics and helps responders.
3. **Log in** with your phone number and password. Passwords are 8+ characters.
4. Forgot your login / locked out? Contact your LDRRMO — staff accounts are managed on the
   admin's **Staff** page, resident (mobile) accounts on the admin's **Users** page.

### Web — staff only (email + password)
1. Open the portal (Firebase Hosting URL).
2. Log in with the email + password issued by the **admin**.
3. Only `dispatcher`, `rescueTeam`, `dmo`, `admin` accounts can use the web portal; residents
   use the mobile app. Disabled accounts (`active:false`) are blocked at login.
4. Change of role? Log out and back in — roles are loaded at sign-in.

---

## 2. Resident — mobile app

### 2.1 Home screen (map)
- The map shows **hazard overlays** you can toggle from the **Layers** button:
  **Typhoons** (JMA track/forecast), **Storm Signals** (PAGASA TCWS per province), **Rain
  Forecast** (Open-Meteo, light/moderate/heavy). A **typhoon alert card** appears on top
  when a signal covers your province (dismiss is session-only; it returns on a new bulletin).
- **Recenter** button puts the map on your GPS location.
- The ** raised red button** starts a new report.

### 2.2 Submitting a report
1. Tap **Report**.
2. Choose the **disaster type** (Flood, Fire, Earthquake, Landslide, Typhoon, Storm Surge,
   Other).
3. Set the **location**: GPS is captured automatically; drag the pin if it's off, or tap the
   map to place it manually.
4. Add up to **3 photos** (camera or gallery). Photos are compressed before upload.
5. Describe the situation and the **number of people affected**.
6. Fill the **contact block** — *"For myself"* or *"For someone else"* (name, contact number,
   relationship, special needs like elderly/PWD/infant, notes for responders). This is
   private: only staff — and the **assigned rescue team** — can see it.
7. Review and **Submit**. You'll see a confirmation; dispatchers are pinged instantly.

> Tip: if you have no internet, note your location and call the hotline. (Offline queueing is
> on the roadmap — see TRACKER.md.)

### 2.3 Tracking your requests
Open **My Reports** (profile tab) to see each report's **status history** with timestamps:
`Submitted → Under Verification → Verified → Awaiting Assignment → Team Assigned → Rescue in
Progress → Resolved → Closed`. If a report is `Rejected` you'll see the reason; `Duplicate`
means dispatch merged it into an earlier report.

---

## 3. Dispatcher — web

You triage incoming reports and run assignments.

1. **Dashboard** — KPIs and the live map of reports (pins colored by **waiting time**; **density**
   mode shows a heat grid). Filter by type/status.
2. **Verify queue** — new reports arrive as `Submitted`; the **bell** also pings you for each
   new report (mobile residents send "new report" notifications automatically).
3. Open a report to:
   - **Verify** (marks `Verified`, records you as verifier) — or **Reject with a reason**
     (the reporter is notified with your reason).
   - **Priority is automatic** — the rescue queue is ordered by **submission time** (oldest
     active report = **#1, "Next rescue"**); pins and the list are colored by waiting time. There
     is no manual severity to set.
   - **Mark as duplicate** — duplicate candidates are flagged automatically (same type within
     ~110 m in the last 24 h); confirm to merge them into the original.
   - **Close** — once a report is `Resolved`, close it to archive it.
4. **Assign a team**:
   - Single report: pick (or create) a team → **Assign**. Status becomes `Team Assigned`; the
     team's status flips to `assigned`; the team is notified.
   - **Backup team:** while a report is already `Team Assigned`/`Rescue in Progress`, use **Add
     backup team** to dispatch an additional team to the same incident.
   - Cluster: group nearby reports into a **suggested cluster**, then assign one team to the
     whole cluster with live progress tracking.
5. **Contact details (PII)** — the victim/contact panel is visible to you here; rescue teams
   only gain access once their team is assigned to that report.

## 4. Rescue team — web

1. Open your **queue** — assignments dispatched to your team appear as
   `dispatched → accepted → in_progress → completed`.
2. **Accept** or **decline** (declining notifies dispatch).
3. On **Start**: status becomes `Rescue in Progress` — and the **contact/victim PII for that
   report is unlocked** for your team (requires `teamId` set on your user account by the
   admin).
4. On **Complete**: enter **people rescued** and outcome notes. This creates a rescue record,
   sets the report to `Resolved` and notifies the reporter.

## 5. DMO — web (analytics)

- KPIs: reports, reporters, resolve rate, **avg time-to-verify / time-to-resolve**, people
  affected/rescued.
- Charts: type bars, status donut, **open reports by waiting time**, reports over time,
  **reports by area**
  (barangay/city from reporter profiles), rescue outcomes.
- Filters: date range + disaster type.
- **Export**: CSV and PDF for any view.

## 6. Admin — web

- **Staff page** (admin-only): create staff accounts (email invite-style), change roles,
  enable/disable (`active`), delete. The **dispatcher list** (`config/dispatch`) is kept in
  sync automatically so mobile pings route correctly.
- **Users page** (admin-only): manage the **mobile-only resident accounts** — create a login
  (mobile number + temporary password + profile), edit name/email/address, enable/disable,
  delete. Residents sign in on the app with their mobile number, so the number is the login
  identity and is read-only after creation; the email is contact info only.
- **Activity page** — the audit trail (FR-13): logins, staff changes, verifications,
  rejections, priority changes, assignments, duplicates, closures, rescue completions.
- Admin is a superuser: same dashboards as dispatcher/dmo, plus account management.

## 7. Notifications

- **Web:** bell icon with unread badge; click to mark read, "mark all" to clear.
- **Web (dispatchers/admin):** when a new report arrives, a **pop-up toast + sound alert**
  appears in the corner; click it (or the bell) to jump to Dispatch.
- **Mobile:** reports screen shows status updates; dispatchers receive "new report" pings.
- Push (FCM) is planned future work — today notifications are in-app.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Web login blocked | Account `active:false` or role is `resident` — contact admin |
| Rescue team can't see contact PII | Team must be **assigned** to the report **and** your user doc needs `teamId` set by the admin |
| Photos fail to upload | Check connectivity; max 3 images; retry — the report text still submits |
| Map tiles missing | Styles load from MapTiler/OpenFreeMap — check network; report pin still works offline |
| Notifications not appearing | Notifications are in-app; keep the app/portal open, pull to refresh |

## 9. Data privacy

Victim/contact details (`reportContacts`) are protected per the Data Privacy Act of 2012:
reporters own their submissions; staff have operational access; rescue teams get access only
while assigned; everything is enforced by Firestore security rules and recorded in the audit
log. Precise locations are never shown publicly.
