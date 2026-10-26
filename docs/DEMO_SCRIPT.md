# FinalProject_DRRM — Demo Video Script

Target: **5–8 minutes**, screen-recorded, one narrator. Record web at 1920×1080, mobile on an
emulator/device with scrcpy (or a screen recorder). Map every scene to the requirement (FR-xx)
it proves — the FR table in `docs/DEFENSE_NOTES.md` §6 is the checklist.

## Shot list

| # | Scene | On screen | Say / show | FR |
|---|---|---|---|---|
| 1 | **Hook (15s)** | Web dashboard | "When a flood hits, residents need one tap to call for help — and responders need one screen to see everything." | — |
| 2 | **Resident signup (45s)** | Mobile | Phone-number registration wizard: profile, address, household. Emphasize +63 normalization. | FR-01 |
| 3 | **Submit a report (90s)** | Mobile | Report flow: pick Flood → GPS auto-pin → drag pin manually → add 2 photos (mention type/size validation on a rejected file) → "for someone else" contact block with special needs → submit. Show the confirmation. | FR-02/03/04 |
| 4 | **Dispatcher ping (30s)** | Web | Bell badge lights up — "residents ping dispatchers instantly through a rule-locked notification" — open the notification, jump to the report. | FR-09 |
| 5 | **Triage (90s)** | Web | Live map — **rescue queue, oldest first** (pins colored by waiting time, density mode). Verify a report (verifier recorded), **reject another with a reason** (show the mobile notification), flag/mark a duplicate. | FR-05/06/14/15 |
| 6 | **Assign (45s)** | Web | Assign "Rescue Alpha" to a report, then **Add backup team** "Rescue Bravo" to the same incident → both teams' status flips, rescue teams notified. (Optional: suggested cluster → one assignment covers all.) | FR-07 |
| 7 | **Rescue (90s)** | Web + mobile split | Web responder clicks the card → **map pin** → **Confirm rescue**. Phone shows the **"Rescue assigned" popup** → **Start Tracking** → **road route + ETA**, blue dot moving, mirrored live on the web map. **PII unlocks only after teamId assignment** ("Data-Privacy-Act gated"). On arrival **hold Confirm Rescue**, fill people saved + description + photos, save → report Resolved. | FR-08, FR-11, §8 |
| 8 | **Tracking (30s)** | Mobile | My Reports timeline: Submitted → … → Resolved with timestamps; rejection reason visible on the rejected one. | FR-08 |
| 9 | **Analytics + hotspots (75s)** | Web (dmo) | **At a glance** (Open now / Resolve rate / Rescued of affected) → metric groups + **priority split** → **Break down by** toggle (Status / Priority / Type / Area) → the **Hotspot map** (heatmap ↔ pins, its own time range, top-5 areas click-to-zoom) → **CSV + PDF export**. | FR-12 |
| 10 | **Governance (45s)** | Web (admin) | Staff page (create/disable a throwaway account live), **Activity page audit trail** — "every action is append-only and immutable in rules." | FR-13 |
| 11 | **Hazard overlays (30s)** | Mobile | Layers sheet: typhoon track / storm signals / rain forecast overlays on the map; typhoon alert card for the province. | value-add |
| 12 | **Close (15s)** | Web + mobile side by side | "Serverless Firebase, security enforced in rules — tested 50/50 in the emulator. DRRM: report, verify, rescue." | — |

## Recording notes
- When the sign-in screen is first shown (scene 1/4), let the **DRRM logo, project description,
  "Terms of Use & Privacy" link and the Group 5 · 3J-G1 credits** be visible for a beat — it's the
  cleanest place to show the project identity in the video.
- Seed the rejected/duplicate scenarios **before** recording scene 5 (submit the extra reports
  in advance) so the video stays in the 5–8 min budget.
- Disable OS notifications Do-Not-Disturb **except** for scenes showing in-app toasts.
- If bulletins are empty (no service-account key), either seed one sample bulletin via console
  or cut scene 11 to a static overlay screenshot.
- Follow `docs/E2E_TEST_PLAN.md` first — record only after every step passes.
- For scene 7, use two devices (or an emulator + phone), keep the **rescue app open and in front** (popup and GPS are foreground-only), and set the OpenRouteService key so the route follows roads. Fake GPS movement (emulator route playback) makes the blue dot visibly travel on the web map.
