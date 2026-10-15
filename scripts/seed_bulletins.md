# Seed typhoon bulletins

Loads fake bulletins into Firestore so the mobile alert card has data to test
with. Data lives in [`docs/typhoon-bulletins.sample.json`](../docs/typhoon-bulletins.sample.json).

The sample has one **active** bulletin (`Typhoon Kiko`) with levels 1–3 spread
across different provinces, plus one inactive older bulletin.

## Primary: Admin SDK script

1. Get a service account key: Firebase Console → **Project settings → Service
   accounts → Generate new private key**. Save the JSON somewhere **outside**
   the repo (it is gitignored if it lands inside).
2. Install the script's dependency:
   ```
   cd scripts
   npm install
   ```
3. Point the script at the key and run it:
   ```
   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
   node seed_bulletins.js
   ```
   (PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\key.json"; node seed_bulletins.js`)

The Admin SDK bypasses security rules, so this works even though clients cannot
write to `bulletins`.

### Flipping provinces between levels

Edit `signals[].areas` in the sample JSON and re-run. For example, move
`"Bulacan"` from level 1 to level 3 to test the badge color change.

## Fallback: Firestore console

The console cannot import JSON, so enter fields by hand:

1. Firestore Database → **Start collection** → id `bulletins`.
2. Document id: `pagasa-tc-kiko-2026-10-15-05`.
3. Fields:
   - `typhoonName` (string) `Kiko`
   - `category` (string) `Typhoon`
   - `source` (string) `PAGASA`
   - `sourceUrl` (string) the bulletin URL
   - `postedAt` (timestamp) any recent date
   - `active` (boolean) `true`
   - `signals` (array) of maps, each `{ level: number, areas: array of strings }`
4. To check the query, also add a second doc with `active` = `false`.

## Schema

```
bulletins/{bulletinId}
  typhoonName : string
  category    : string
  source      : string
  sourceUrl   : string?
  postedAt    : Timestamp
  active      : boolean
  signals     : [ { level: number, areas: [string] } ]
  updatedAt   : Timestamp
```
