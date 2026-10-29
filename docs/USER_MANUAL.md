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

### Mobile — rescue team (email + password)
1. On the login screen tap **"Rescue Team? Sign in with email"**.
2. Use the email + password issued by the admin. Your account must have role `rescueTeam` and be **added to a team** by dispatch (Teams tab → Add responder) — otherwise the app shows "No rescue team is linked to your account yet".

### Web — staff only (email + password)
1. Open the portal (Firebase Hosting URL).
2. Log in with the email + password issued by the **admin**.
3. Only `dispatcher`, `rescueTeam`, `dmo`, `admin` accounts can use the web portal; residents
   use the mobile app. Disabled accounts (`active:false`) are blocked at login.
4. Change of role? Log out and back in — roles are loaded at sign-in.
5. The login page shows a short **project description** and links to the **Terms of Use &
   Privacy** page (also reachable at `/terms`) — signing in means you accept it. Developer
   credits appear at the bottom of the page.

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

## 4. Rescue team

The rescue flow uses **two screens**: the responder on the **web** confirms the rescue, and the
team in the field uses the **mobile app**.

> Rescue-team accounts only ever see **their own team's** assignments (and the reports on those
> assignments) — never another team's. Dispatchers and DMOs can open **Responder** too, but in a
> **view-only** mode (they follow the teams live; only the assigned rescue team or an admin can
> confirm and update progress). A rescue account with no team yet sees *"You're not on a rescue team
> yet"* until an admin assigns one.

### 4.1 Responder — web
1. Open **Responder**. Assignments dispatched to your team are listed on the left as cards.
2. **Click a card** — the map shows the **pin** where the team will go, plus the description,
   dispatcher notes and (once assigned) the victim/contact details.
3. Press **Confirm rescue** (or **Decline**). Confirming marks the assignment `accepted` and sends a
   **"Rescue assigned" notification to every member of the team's phones**. If the team has no
   members you'll see a notice — add responders in Dispatch → Teams first.
4. While waiting you can press **Notify team again**. **Start without app** exists only as a manual
   fallback when the team can't use the mobile app.
5. When the team starts tracking, the map shows their **live position** (blue dot) and the time of the
   last GPS update.
6. After the team finishes, the assignment turns **Resolved** and the report becomes `Resolved`.
   ("Complete & record outcome" on the web is a fallback if the app can't be used.)

### 4.2 Rescue team — mobile app
1. Sign in with your email (see §1). The home screen lists your team's **Active** and **Completed** jobs.
2. When the web responder confirms, a **popup "Rescue assigned"** appears (the app must be open).
   Tap **Start Tracking** (or **Later** and open the job from the list).
3. **Start Tracking** turns on your GPS, marks the rescue **in progress** (the reporter is notified)
   and draws the **road route** to the incident with distance and travel time at the top. Allow
   location permission when asked, and keep the app open on screen.
4. When you arrive, the banner shows **"You've arrived"**. Do the rescue.
5. **Press and hold "Hold to Confirm Rescue"** for about 1.5 seconds until the bar fills.
6. Fill in the finish form: **people saved**, **description / notes**, and up to **5 photos**. Tap
   **Save & Finish**. The rescue record is saved and the report is resolved once every team on that
   incident is done.

> If the route shows as a straight line, the road-route service (OpenRouteService) is unavailable or
> its key isn't configured — tracking and finishing still work.

## 5. DMO — web (analytics)

The **Operations Analytics** page is organised top-down, from the headline to the raw records.
Filters (time range + disaster type) sit at the top; **Reset filters** appears once you change them.

1. **At a glance** — three headline numbers: **Open now** (of total reports), **Resolve rate**,
   and **Rescued of affected** (people rescued vs people affected).
2. **What is behind the numbers** — three groups:
   - **Incident load** — reports, reporters, people affected, plus a **priority split** bar
     (high / medium / low).
   - **Response speed** — avg time-to-verify, avg time-to-resolve, resolved count.
   - **Rescue outcomes** — rescue operations, people rescued, avg rescued per operation.
3. **Patterns** — reports over time, plus a **Break down by** toggle that switches the chart
   between **Status / Priority / Type / Area** (area = barangay/city from reporter profiles).
4. **Hotspots** — a map of past incidents with its **own** time range (Week / Month / Year /
   All-time) and scope (Rescues only / All reports). Switch between **Heatmap** (hot zones) and
   **Pins** (colored by disaster type); the **top-5 hotspot areas** list zooms the map when clicked.
5. **Records** — tab between **Recent reports** (type, area, status, priority, people, submitted)
   and **Rescue operations** (when, people rescued, notes). "Show most recent" expands to 10 rows.
6. **Export** — **CSV** and **PDF** for the current filtered view (CSV includes `priority`).

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
- **Mobile:** reports screen shows status updates; dispatchers receive "new report" pings; rescue team members get the **"Rescue assigned" popup** with a **Start Tracking** button.
- Push (FCM) is planned future work — today notifications are in-app, so the popup appears only while the app is open.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Web login blocked | Account `active:false` or role is `resident` — contact admin |
| Rescue team gets no popup on the phone | Team must have members (Dispatch → Teams → Add responder), the member's account must be role `rescueTeam`, and the app must be open when the web responder confirms |
| Route is a straight line | OpenRouteService key missing/expired or service down — check `orsKey` in `mobile/lib/config/map_config.dart` |
| Tracking stops when the phone locks | GPS is foreground-only — keep the app open on screen |
| Rescue team can't see contact PII | Team must be **assigned** to the report **and** your user doc needs `teamId` set by the admin |
| Photos fail to upload | Check connectivity; max 3 images; retry — the report text still submits |
| Map tiles missing | Styles load from MapTiler/OpenFreeMap — check network; report pin still works offline |
| Notifications not appearing | Notifications are in-app; keep the app/portal open, pull to refresh |

## 9. Data privacy

Victim/contact details (`reportContacts`) are protected per the Data Privacy Act of 2012:
reporters own their submissions; staff have operational access; rescue teams get access only
while assigned; everything is enforced by Firestore security rules and recorded in the audit
log. Precise locations are never shown publicly.
