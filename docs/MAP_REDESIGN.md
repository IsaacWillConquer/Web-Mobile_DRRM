# Map Redesign — Decisions & Plan

Mobile map redesign + fixes for FinalProject_DRRM (IT 305 · BulSU · submit **Nov 2, 2026**).
Written 2026-10-22 after a requirements interview. Keep this file updated as steps ship;
`docs/TRACKER.md` stays the project-wide source of truth.

---

## 1. Goals

1. **Camera:** when a map layer is toggled, the map zooms/pans so that layer's data is fully visible.
2. **Typhoon track:** replace the single blue line with a proper track display (past, forecast, cone, wind radius, labeled points).
3. **Signals / Rain:** readable numbers, legends, per-province rain, honest empty/stale states.
4. **Web dispatch map:** show the same hazard overlays, read-only.

Reference: the agap.ai screenshots. We copy the **information design**, not the exact look (see §4).

---

## 2. Scope

### In
- Mobile map: camera fit, typhoon track, storm signals, rain forecast
- Alert card + layer sheet polish, legends, status text
- Bottom nav **visual refresh only** (Map + Profile tabs)
- Web dispatch map: read-only hazard overlays
- Fetcher scripts + GitHub Actions workflow fixes
- Unit tests for pure logic

### Out (decided — do not build)
- **Assistant tab** (AI chat) — removed
- **Family tab** — removed
- Any real LLM/AI feature (tracker: AI = none, rule-based only)
- Admin form for entering storm signals (stay with Firestore console + seed script)
- Live family location sharing
- Auto-flagging reports inside signal provinces (stretch only, after everything else)

### Order vs other work
Map redesign first, **then** P4b (offline queue, offline tiles, SMS fallback).

---

## 3. Behavior decisions

### Camera
| Situation | Behavior |
|---|---|
| App launch, no layer | Center on the user |
| Layer turned **on** | Always refit to that layer's data (padding clears alert card + bottom controls) |
| Layer on but no data | Fit the whole Philippines |
| Layer turned **off** | Return to the user |
| GPS outside the Philippines (e.g. emulator in California) | Fit the whole Philippines |
| Layer sheet closes after a change | Replay the fit (sheet hides the map while open) |
| Zoom cap | Never tighter than 3° span (~330 km) |

### Data
- **Live JMA** typhoon data when a storm exists.
- **Simulation storm is demo-only**: never a silent fallback for real data.
  - Switched on/off by a **separate Firestore doc** (`bulletins/simulation`), no rebuild needed.
  - Always shows a **"SIMULATION" badge** on the card and chip.
  - Real data is the default; the app prefers a real active storm.
  - Simulation data is exempt from the stale warning.
- **Storm signals:** entered by hand (PAGASA has no API) via Firestore console / seed script.
- **Rain:** per **province** (~80 Open-Meteo calls per fetch), not per region.

### Typhoon display (own styling, same information)
- Past track: solid line
- Forecast track: dashed line, labeled points (12H / 24H / 36H)
- Cone of uncertainty: built in `fetch_typhoon.js` from JMA probability circles, stored in Firestore (JSON string, since Firestore forbids nested arrays), drawn by mobile and web
- Wind radius: circle with dashed border
- Category markers: **PAGASA scale from wind speed** (km/h): TD ≤ 61 · TS 62–88 · STS 89–117 · TY 118–184 · STY ≥ 185; marker color ramps by category
- Top chip shows name + wind; alert card has **View Details** (inline expand) and **Safety Tips** (static, rule-based sheet by signal level; no AI claims)

### Every layer
- Legend (signals 1–4; rain light / moderate / heavy)
- "Source · updated X ago"
- Stale warning: **24 h** typhoon + signals, **48 h** rain
- Empty state when there is no data

### Basemap
Keep the stripped **Positron** style, but stop stripping the place labels that help orientation (cities, provinces).

---

## 4. Process conventions

- Small steps, one change per round, **git commit between rounds**.
- Changed files only, same paths as the project, short explanation per file.
- Non-trivial logic gets an explanation before it is accepted.
- Pure logic gets unit tests (cone builder, bounds, categories, camera).
- Not copying agap.ai look 1:1 (README: "our own way").
- After each round: add a line to the `docs/TRACKER.md` status log.
- Dev environment: Flutter 3.35.5 / Dart 3.9.2 (matches `sdk: ^3.9.2`). Don't `flutter upgrade` mid-project.

---

## 5. Build order & status

| # | Step | Status |
|---|---|---|
| 1 | Camera fit (`camera_fit.dart`, `map_tab.dart`, tests) | Delivered — **awaiting `flutter analyze` + device test** |
| 2 | Typhoon track + fetcher (cone, categories, trimmed simulation seed, `bulletins/simulation`, workflow fix) | Not started |
| 3 | Storm signals labels + legend | Not started |
| 4 | Rain per province (+ find why it currently renders nothing) | Not started |
| 5 | Alert card, layer sheet, status / stale / empty states | Not started |
| 6 | Bottom nav visual refresh | Not started |
| 7 | Web dispatch overlays (top-right controls, avoid the bottom-left priority legend) | Not started |

---

## 6. Findings from reviewing the project (2026-10-22)

| Finding | Detail | Fixed in |
|---|---|---|
| Camera never re-framed | `_moveToUser()` at z14 on load/style-load; `_applyOverlay()` never touched the camera. The "brown screen" was the orange province fill covering a z14 view | Step 1 |
| Demo track is the whole 2009 Ondoy path | `bulletins/active` track runs from lng 128 to 108.5 (Vietnam); app treats `track.last` as "now", so the danger circle sits over Vietnam while the cone/forecast sit over Luzon | Step 2 (re-cut seed so "now" ≈ 14.9, 123.6) |
| Cone never written by the live fetcher | Only the bundled demo has a `cone` | Step 2 |
| Demo and live share one doc | `seed_demo.js` writes `bulletins/active`, the same doc the fetcher merges into; stale `signals`/`cone` leak into real storms, and "no storm" wipes the demo | Step 2 (`bulletins/simulation`, clear stale fields) |
| Demo wind/category mismatch | `maxWindsKph: 95` but category "Tropical Storm"; on PAGASA scale 95 km/h = STS. Use ~85 km/h (verify Ondoy's PAGASA peak) | Step 2 |
| Cron workflow invalid | `fetch-data.yml` line 31 uses `secrets` in a job-level `if` → "Unrecognized named-value: 'secrets'", every run fails instantly | Step 2 |
| No GitHub secret | Repo has no `FIREBASE_SERVICE_ACCOUNT`. Owner (IsaacWillConquer) must add it (Firebase → Service accounts → new key → repo secret). Never commit or paste the key | Manual |
| Rain layer renders nothing | All 17 region names match the GeoJSON, so not a naming issue. Errors are swallowed (`_safe`, `clear()`) | Step 4 |
| Signals labels may not show | No `textFont` set; default font may be missing from the Positron glyph set (verify on device) | Step 3 |
| Secrets in the zip | `web/.env`, `map_config.dart` (MapTiler key), `google-services.json` are gitignored but were zipped. Restrict the MapTiler key to the app package | Manual |
| Web map layout | Leaflet map, Pins/Density toggle top-right, priority legend bottom-left | Step 7 |

---

## 7. Open items (decide inside the relevant step)

- Exact rain thresholds in mm (current: ≥150 heavy, ≥50 moderate, else light)
- Safety Tips wording per signal level
- Whether the camera should re-fit when the alert card is expanded after a fit (not implemented)
- Confirm JMA gives a wind value per forecast point (needed for category markers); run the fetcher once against a live storm to verify the cone/wind code
- Confirm `maplibre_gl` 0.27.1 API: `animateCamera(duration:)` and padding units