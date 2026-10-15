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
2. In Firestore → `users` → your doc → change `role` to `dispatcher` (console bypasses rules).
3. Other roles: `rescueTeam`, `dmo`.

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
