# FinalProject_DRRM

  Web + Mobile **Disaster Rescue Reporting & Monitoring System**
IT 305 – Advance Web Development · Bulacan State University · Submit **Nov 2, 2026**

## What it is

Residents report emergencies/disasters (flood, fire, earthquake, landslide, etc.) from a
**Flutter mobile app**. Dispatchers verify, prioritize, and assign rescue teams from a **React
web dashboard**; responders update response status and record outcomes; DMOs monitor incidents
and generate reports.

The goal is to recreate the **flow** of the open-source `agap.ai` project, but built entirely
**our own way**. We do not use their backend or code.

## Architecture

```
Flutter mobile (resident) ─┐
React web (admin/responder/DMO) ─┴─→ Firebase: Auth · Firestore · FCM
                                      (Firestore security rules = the "backend")
```

No server. No Postgres. Images via Cloudinary (free). Maps via OpenStreetMap.

## Layout

| Path | What |
|---|---|
| `web/` | React + Vite + Tailwind dashboard (admin/dispatch + responder + DMO) |
| `mobile/` | Flutter app (resident/reporter) |
| `firestore/` | Security rules + indexes |
| `docs/` | `TRACKER.md` (single source of truth), ERD, manual, defense notes |

## Documentation

- **Start here:** [`docs/TRACKER.md`](docs/TRACKER.md) — decisions, team split, phases, progress.
- **Contributing:** [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — branching, PRs, ownership, shared files.
- **Setup:** [`docs/SETUP.md`](docs/SETUP.md) — Firebase + Cloudinary one-time config.

## Core flow (copied from agap.ai)

1. Resident registers / logs in.
2. Resident submits a report — disaster type, GPS location (+ manual pin), **up to 3 photos**, description.
3. Resident marks the report **for myself** or **for someone else** (captures victim details).
4. Nearby reports group into a **cluster** (duplicate/nearby detection).
5. Dispatcher sees reports/clusters on a **live map**, verifies + sets **priority**.
6. Dispatcher creates **rescue teams** and **assigns** one to a cluster.
7. Rescue team accepts, updates status, records people rescued + outcome.
8. Status changes flow back; the reporter gets **notifications**.
9. DMO views incident **stats/reports**.

## Resilience (offline + SMS)

- **Offline-first (mobile):** reports and photos are queued locally and sync when the connection
  returns; cached map tiles keep the map usable; an offline banner + "pending sync" badge make the
  state clear. Reports are never lost in a dead zone.
- **SMS fallback:** with no data at all, the resident can tap **Send via SMS** — the native
  composer opens pre-filled to the LDRRMO hotline with coordinates + a short description. Free,
  serverless, and works over the cellular network.

## Reference (read-only)

`FinalProject_AWA/` (our earlier Firebase scaffold) and `agap.ai/` (the open-source app whose
flow we copy) are kept as reference only — not modified, not imported.

## Attribution

- **Province boundaries:** [geoBoundaries](https://www.geoboundaries.org/) Philippines ADM2
  (Provinces), licensed **CC BY 3.0 IGO**, sourced from NAMRIA / PSA / OCHA Philippines via HDX.
  Bundled at `mobile/assets/geo/ph_provinces.geojson` and simplified for size.
- **Basemap:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, vector
  tiles/styles served by [OpenFreeMap](https://openfreemap.org/) (OpenMapTiles schema).
