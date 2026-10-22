# Setup — Firebase + Cloudinary

Everything below is one-time project setup. Once done, the web and mobile apps talk to
your own Firebase project.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** (e.g. `drrm-app`).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (start in **production mode**).

## 2. Web app config
1. Project settings → **Your apps → Add app → Web** (`</>`), register the app.
2. Copy the config values into `web/.env` (copy from `web/.env.example`):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
3. Set the project id in `.firebaserc` (`projects.default`).

## 3. Mobile app config
Requires the Firebase CLI + FlutterFire CLI:
```
npm install -g firebase-tools
firebase login
dart pub global activate flutterfire_cli
flutterfire configure   # run inside mobile/, select the project (Android)
```
This regenerates `mobile/lib/firebase_options.dart` with your real values.

For push notifications, add the Android app in the console and drop `google-services.json`
into `mobile/android/app/`.

## 4. Publish security rules + indexes
From the repo root:
```
firebase deploy --only firestore
```
(or paste `firestore/firestore.rules` into Firestore → Rules in the console).

## 5. Create the first staff account
1. Register normally (web or mobile) → a `users/{uid}` doc is created with `role: resident`.
2. In Firestore → `users` → your doc → change `role` to `admin` (console bypasses rules).
3. Other roles: `dispatcher`, `rescueTeam`, `dmo`.

Once an `admin` exists, they sign in to the web portal and open the **Staff** tab to create,
edit, enable/disable, and delete staff accounts. That creates the Firebase Auth user and the
`users/{uid}` profile in one step (no backend needed). Only `admin` can manage accounts.

Optional CLI alternative (creates the Auth user + profile; needs a service account with the
**Firebase Admin SDK Administrator Service Agent** role):
```
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\service-account.json
node scripts/create_staff.js <email> <password> <admin|dispatcher|rescueTeam|dmo> [name]
```

## 6. Cloudinary (report photos)
1. Create a free account at https://cloudinary.com.
2. Settings → **Upload → Add upload preset** → set **Signing mode: Unsigned**.
3. Put the cloud name + preset into `web/.env`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=...
   VITE_CLOUDINARY_UPLOAD_PRESET=...
   ```

## 7. Run
```
# web
cd web
npm install
npm run dev        # http://localhost:5173

# mobile
cd mobile
flutter run
```

## 8. Demo data & live feeds

The mobile map overlays read two read-only feeds:

| Script | Source | Writes |
|---|---|---|
| `fetch_typhoon.js` | JMA (RSMC Tokyo) | `bulletins/active` — track, forecast, danger radius, name |
| `fetch_rain.js` | Open-Meteo | `forecasts/rain` — 7-day rainfall per region |

- **TCWS (PAGASA per-province signals) are not fetched** — no public API. An admin sets
  `signals` on `bulletins/active`; the typhoon fetcher merges track fields only, so admin-set
  `signals` survive.
- Both use the Admin SDK and run locally or via `.github/workflows/fetch-data.yml`
  (cron every 3h + manual `workflow_dispatch`). Set the repo secret
  **`FIREBASE_SERVICE_ACCOUNT`** to the service-account JSON.

```
cd scripts
npm install
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
node fetch_typhoon.js
node fetch_rain.js
```

The service account needs a Firestore data role (e.g. **Cloud Datastore User**).

### Demo seeding (recommended — no Admin-SDK IAM needed)

The Admin SDK key on this project is IAM-denied, so demo data is seeded through the
**Firestore REST API using the Firebase CLI login** (`firebase login`) via
`scripts/lib/firebase_rest.js`:

- `node seed_demo.js` — `bulletins/active` (historical sample) + `forecasts/rain` (`--clear` to revert).
- `node seed_rescue_teams.js` — 10 Bulacan rescue teams + their `rescueTeam` accounts.
- `node seed_simulation.js` — residents + dispatcher + DMO, 26 reports, clusters, assignments,
  rescueRecords, notifications, logs (`--clear`).

`bulletins/{id}` schema:

```
typhoonName : string    category : string    source : string    sourceUrl : string?
postedAt    : Timestamp active   : boolean   signals : [ { level:int, areas:[string] } ]
track : [ {lat,lng} ]   forecast : [ {lat,lng,hours,label} ]     dangerRadiusKm : number
```

### Staff accounts

`create_staff.js` creates an Auth user + `users/{uid}.role` (needs the Admin SDK + IAM). If IAM
is missing, create the user in the Firebase Console → Authentication, then set
`users/{uid}.role` to `dispatcher` / `rescueTeam` / `dmo` (`active: true`).

### Attribution

- JMA: https://www.jma.go.jp/bosai/typhoon/
- Open-Meteo: https://open-meteo.com/ (Weather data by Open-Meteo.com, CC BY 4.0; non-commercial)
