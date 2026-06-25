---
quick_task: 260613-lx2
title: Add vehicle location to car listings (geocoded)
subsystem: listings
tags: [listings, geocode, i18n, cross-repo]
requires: []
provides:
  - "Car.location persisted field + GET /api/geocode/city public endpoint"
  - "AuthService.geocodeCity mobile method"
  - "SellCar location input + geocode-on-submit gate; CarDetails location spec"
affects:
  - backend-services/carEx-services/server.js
  - backend-services/carEx-services/src/models/Car.js
  - src/screens/SellCarScreen.tsx
  - src/screens/CarDetailsScreen.tsx
tech-stack:
  added: []
  patterns:
    - "Node 20 global fetch + AbortController for keyless third-party calls (no axios on backend)"
    - "Mirror exteriorColor free-text field end-to-end (schema -> handlers -> form -> details)"
key-files:
  created:
    - backend-services/carEx-services/src/geocode/geocodeService.js
    - backend-services/carEx-services/__tests__/geocode.test.js
  modified:
    - backend-services/carEx-services/src/models/Car.js
    - backend-services/carEx-services/server.js
    - src/services/AuthService.ts
    - src/screens/SellCarScreen.tsx
    - src/screens/CarDetailsScreen.tsx
    - src/constants/translations.ts
decisions:
  - "Backend committed on fresh feat/vehicle-location branch off origin/main (Railway deploy branch); mobile on feat/find-a-car"
  - "location appended to multipart explicitly with the server-normalized string, special-cased in the generic forEach loop so the raw typed city never persists"
  - "Geocode gate runs after setLoading(true); single coherent loading state through gate into existing try/finally (no double setLoading)"
metrics:
  duration: ~12min
  completed: 2026-06-13
---

# Quick Task 260613-lx2: Add Vehicle Location to Car Listings Summary

Sellers can enter an optional foreign city on a listing; on submit it is geocoded + normalized server-side via OpenStreetMap Nominatim (e.g. "Incheon" -> "Инчхон, Республика Корея") and stored, with un-geocodable cities blocking submit and buyers seeing the normalized location on the car details page.

## What Was Built

### Task 1 — Backend (`feat/vehicle-location`, commit `b59eacc`)
- `src/models/Car.js`: added `location: String` to `carSchema` (adjacent to `interiorMaterial`) so Mongoose strict-mode persists it.
- `src/geocode/geocodeService.js` (NEW): `geocodeCity(q)` using Node 20 global `fetch` + `AbortController` (5s timeout), `User-Agent: CarEx/1.0 (contact: beckprograms@gmail.com)`, params `format=jsonv2&addressdetails=1&q=<encoded>&accept-language=ru&limit=1`. Normalizes to `${name}, ${address.country}`. Returns `{ ok:false }` for empty input, not-found, missing fields, non-2xx, timeout, or any throw — never throws.
- `server.js`: public `GET /api/geocode/city` route (no auth, wrapped in try/catch returning `404 { ok:false }` so it never 500s). Wired `location` into POST `/api/cars` (destructure + `new Car({...})`) and PUT `/api/cars/:id` (destructure + `location: location ?? car.location` in Object.assign). Required geocodeService at top with other requires.
- `__tests__/geocode.test.js` (NEW): 4 cases (valid payload, empty array, fetch-throws, blank/whitespace q with fetch NOT called) with `global.fetch` mocked. All GREEN.

### Task 2 — Mobile (`feat/find-a-car`, commit `d065a0f`)
- `src/constants/translations.ts`: `location` (RU 'Местоположение' / EN 'Location'), `locationInput` (RU 'Город' / EN 'City'), `locationNotFound` (RU 'Город не найден, уточните' / EN 'City not found, please refine') in BOTH RU and EN blocks.
- `src/services/AuthService.ts`: `geocodeCity(city)` → GET `/api/geocode/city` with `params: { q }`, returns uniform `{ ok, location? }` (catch → `{ ok:false }`).
- `src/screens/SellCarScreen.tsx`: imported AuthService; `location: ''` in formData init; `c.location || ''` edit prefill; free-text location TextInput under the Ext/Int section; geocode gate in handleSubmit after `setLoading(true)` — blank city skips the call, non-empty city is geocoded and the NORMALIZED string is appended (raw typed city never persists), `!geo.ok` shows `Alert.alert(t.error, t.locationNotFound)` and returns. adminEdit branch untouched.
- `src/screens/CarDetailsScreen.tsx`: `{renderSpecItem(t.location, car.location)}` in Ext/Int specs (legacy listings fall back to '-').

## Verification
- BACKEND: `node --check` GREEN on server.js, geocodeService.js, Car.js; `npx jest __tests__/geocode.test.js` → 4/4 passed.
- MOBILE: `npx tsc --noEmit` — per-file error counts on the four changed files are IDENTICAL to baseline (no NEW errors; pre-existing `any`/`unknown` errors in AuthService and test files are baseline). `npx eslint` on the four files — no NEW errors after fixing the one introduced unused-var (see Deviations); remaining errors/warnings are all pre-existing baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Removed unused `error` binding in geocodeCity catch**
- **Found during:** Task 2 (eslint verification)
- **Issue:** My new `geocodeCity` catch used `catch (error)` with `error` unused, adding one NEW `@typescript-eslint/no-unused-vars` error vs baseline.
- **Fix:** Changed to optional-catch-binding `catch { ... }`. AuthService eslint count returned to its pre-existing baseline (1 error: unused `API_URL`, pre-existing).
- **Files modified:** src/services/AuthService.ts
- **Commit:** d065a0f (folded into Task 2 commit)

## Notes
- The ~18 pre-existing mobile jest failures across 5 suites are baseline and were not run/attributed to this change. tsc/eslint baseline errors in AuthService (untyped legacy methods) and CarDetails test files are pre-existing and out of scope.
- Out-of-scope paths confirmed untouched: browse CarCard, search filtering, admin/moderation edit path (listingService.js, listingSchemas.js, SellCarScreen adminEdit branch).
- No new dependencies; no new hardcoded keys/secrets (Nominatim is keyless; UA is a policy contact).

## Self-Check: PASSED
- All 6 created/modified files verified present in both repos.
- Backend commit b59eacc and mobile commit d065a0f both verified in git log.
