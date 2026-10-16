# Data fetchers

Two scripts write live-ish data to Firestore for the mobile map overlays.
Both use the Admin SDK (bypasses rules) and run locally or from GitHub Actions
(`.github/workflows/fetch-data.yml`, cron every 6h + manual `workflow_dispatch`).

| Script | Source | Writes |
|---|---|---|
| `fetch_typhoon.js` | **JMA** (RSMC Tokyo) | `bulletins/active` — track, forecast points, danger radius, name |
| `fetch_rain.js` | **Open-Meteo** | `forecasts/rain` — 7-day rainfall per region |

**TCWS (PAGASA per-province wind signals) are NOT fetched** — no public API.
An admin sets `signals` on `bulletins/active` (console or the seed script). The
typhoon fetcher only merges track fields, so admin-set `signals` are preserved.

## Run locally

```
cd scripts
npm install
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json   # PowerShell: $env:...
node fetch_typhoon.js
node fetch_rain.js
```

The service account needs a Firestore data role (e.g. **Cloud Datastore User**).

## CI setup

1. Add the service-account JSON as the repo secret **`FIREBASE_SERVICE_ACCOUNT`**.
2. The workflow writes it to a temp file and sets `GOOGLE_APPLICATION_CREDENTIALS`.
   The key is never committed.

## Staff accounts

`create_staff.js` creates an Auth user and sets `users/{uid}.role` to a staff
role (needs the Admin SDK key + IAM permissions):

```
node create_staff.js dispatcher@drrm.app "Password123" dispatcher "DRRM Dispatcher"
# roles: dispatcher | rescueTeam | dmo
```

If the service account lacks IAM roles (error: *insufficient permission*), create
the user in Firebase Console → Authentication, then set `users/{uid}.role` in
Firestore to `dispatcher` / `rescueTeam` / `dmo` (`active: true`).

## Attribution

- JMA: https://www.jma.go.jp/bosai/typhoon/
- Open-Meteo: https://open-meteo.com/ (Weather data by Open-Meteo.com, CC BY 4.0; non-commercial)
