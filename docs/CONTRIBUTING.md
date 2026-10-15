# Contributing — FinalProject_DRRM

How we split work and land changes. Read this before your first commit.

## 1. Get running (one-time)

Everything shares **one Firebase project** (`drrm-app`). Ask the Data Lead (A) for the web
config values and the Android `google-services.json`.

```
# web
cd web
Copy-Item .env.example .env        # then paste the Firebase web config into .env
npm install
npm run dev                        # http://localhost:5173

# mobile
cd mobile
flutter pub get
flutterfire configure              # regenerates lib/firebase_options.dart (Android)
flutter run
```

Full setup: [`SETUP.md`](SETUP.md).

## 2. Repo layout & ownership

| Path | Owner | What |
|---|---|---|
| `firestore/`, `docs/` | A | rules, indexes, auth/roles, audit, docs |
| `web/src/pages/dispatch/`, `web/src/core/services/` | B | admin/dispatch dashboard, shared data layer |
| `web/src/pages/responder/`, `web/src/pages/dmo/` | C | responder UI, DMO analytics |
| `mobile/` | D | resident Flutter app |
| `web/src/components/`, integration/offline/FCM, deploy | E | shared UI, cross-cutting, QA |

Everyone may read anything. **Only edit files you own** unless you've coordinated in the group
chat (see §5).

## 3. Branching

- `main` is always deployable. **Never commit directly to `main`.**
- One branch per task: `feat/<area>-<short>`, `fix/<area>-<short>`, `docs/<short>`.
  - Examples: `feat/dispatch-live-map`, `feat/mobile-report-form`, `fix/auth-role-guard`.
- Keep branches short-lived; rebase on `main` often.

## 4. Commits & PRs

- Commit style: `type(scope): summary` — `feat`, `fix`, `docs`, `chore`, `refactor`.
  - `feat(dispatch): add report verification panel`
- Push your branch, open a **PR into `main`**, request **one reviewer** (usually the area owner
  or E). No self-merge.
- Keep PRs small and focused — one feature per PR. Describe what changed and how to test it.

## 5. Shared files (coordinate before editing)

These are touched by multiple people — announce it in the group chat first, and expect merge
conflicts if you don't rebase:

- `web/src/routes/AppRoutes.jsx`
- `web/src/App.jsx`
- `web/src/config/appConfig.js` (and its mobile mirror `mobile/lib/config/app_config.dart`)
- `web/src/components/AppShell.jsx`
- `firestore/firestore.rules`, `firestore/firestore.indexes.json`
- `docs/TRACKER.md`

Add your new page under your own `pages/<role>/` folder and your route as **one added line** in
`AppRoutes.jsx` — that keeps conflicts trivial.

## 6. Data access rules

- Talk to Firestore through `web/src/core/services/*` — do **not** write ad-hoc
  `collection(db, ...)` queries inside pages. If a query is missing, add it to the service
  (B owns `core/services`, ask first).
- Collection names, roles, statuses, and disaster types live in `config/appConfig.js`
  / `config/app_config.dart`. Never hardcode them.
- Keep the web and mobile constants mirrored. If you change one, update the other.

## 7. Never commit secrets

`.gitignore` already blocks `.env*` (except `.env.example`), `google-services.json`,
`GoogleService-Info.plist`, `*.key`, `*.pem`, and build output. Don't force-add any of these.
The Firebase **web** API key is a public identifier (safe), but the real `.env` stays local.

## 8. Checks before you push

```
# web
cd web; npm run lint; npm run build

# mobile
cd mobile; flutter analyze
```

`main` must stay lint-clean and buildable.
