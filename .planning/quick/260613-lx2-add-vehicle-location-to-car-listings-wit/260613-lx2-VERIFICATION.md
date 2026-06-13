---
phase: quick-260613-lx2
verified: 2026-06-13T16:30:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Create a listing with city 'Incheon' (or 'Инчхон') on a device/sim against the backend feat/vehicle-location deploy."
    expected: "Submit succeeds; CarDetails Ext/Int specs shows 'Инчхон, Республика Корея' (server-normalized, not the raw typed string)."
    why_human: "Requires a running backend + live Nominatim outbound call + on-device form submit; not verifiable by static grep."
  - test: "Create/edit a listing with a junk city like 'asdfqwer'."
    expected: "Submit is BLOCKED; an Alert shows RU 'Город не найден, уточните' (EN 'City not found, please refine'); loading clears; nothing persists."
    why_human: "Depends on a real 404 from the geocode endpoint and the runtime Alert; static analysis confirms the gate code path but not the live behavior."
  - test: "Create a listing with the Location field left blank."
    expected: "No geocode call is made; listing saves; CarDetails location spec renders '-'."
    why_human: "Network-call avoidance + legacy fallback rendering are runtime/visual behaviors."
  - test: "Confirm the mobile location work lands on the feat/find-a-car branch before/at release."
    expected: "feat/find-a-car contains the location commit (d065a0f or its equivalent)."
    why_human: "DEVIATION: d065a0f is currently on fix/notifications-header-overflow (one commit ahead of feat/find-a-car), NOT on feat/find-a-car as the task goal/SUMMARY state. Needs a human merge/branch decision — see Gaps Summary."
---

# Quick Task 260613-lx2: Add Vehicle Location to Car Listings Verification Report

**Phase Goal:** Seller enters a city when creating/editing a car listing; validated+normalized on submit via a server-side OpenStreetMap Nominatim geocode endpoint (no API key); buyers see the normalized "City, Country" on the car details page. Optional field; not-found blocks submit with a RU error; details-page-only v1; RU/EN i18n parity. Cross-repo: backend feat/vehicle-location, mobile feat/find-a-car.
**Verified:** 2026-06-13T16:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Seller can type a city into a Location field on the create form (free text, optional) | VERIFIED | SellCarScreen.tsx:78 `location: ''` in formData init; TextInput at 1001-1007 (`value={formData.location}`, `placeholder={t.locationInput}`) |
| 2 | Seller can type city when editing own listing (prefilled from stored value) | VERIFIED | SellCarScreen.tsx:153 `location: c.location || ''` in edit prefill block |
| 3 | On submit a non-empty city is geocoded server-side via Nominatim and stored normalized "City, Country" | VERIFIED | SellCarScreen.tsx:418-426 calls `AuthService.geocodeCity(typedCity)`, appends `normalizedLocation` (442-444); backend geocodeService.js returns `${name}, ${country}` from Nominatim jsonv2; server.js:949/1069 persists `location` on POST/PUT |
| 4 | Un-geocodable city BLOCKS submit with RU 'Город не найден, уточните' / EN parity | VERIFIED | SellCarScreen.tsx:421-425 `if (!geo.ok)` → `Alert.alert(t.error, t.locationNotFound)` + `setLoading(false)` + `return`; translations.ts:327 (RU) / 1451 (EN) |
| 5 | Blank Location → no geocode call; listing saves empty | VERIFIED | SellCarScreen.tsx:418-419 geocode guarded by `if (typedCity)`; `normalizedLocation` defaults `''`; blank appends empty string |
| 6 | Buyer sees stored location on details page; legacy listings render '-' | VERIFIED | CarDetailsScreen.tsx:906 `renderSpecItem(t.location, car.location)` (renderSpecItem falls back to '-'); server GET handlers spread `...car` (server.js:315/418/431/507) so location flows out, no GET change needed |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| backend `src/models/Car.js` | `location: String` on carSchema | VERIFIED | Line 38 `location: String,` |
| backend `src/geocode/geocodeService.js` | geocodeCity(q) via Nominatim, UA, timeout, never throws | VERIFIED | global fetch + AbortController 5s timeout; UA `CarEx/1.0 (contact: beckprograms@gmail.com)`; params format=jsonv2&addressdetails=1&accept-language=ru&limit=1; returns `{ok:false}` on empty/missing-fields/non-2xx/timeout/throw |
| backend `server.js` | GET /api/geocode/city + POST/PUT persist location | VERIFIED | Route 850-860 (public, try/catch → 404 never 500); POST destructure 868 + `new Car` 949; PUT destructure 1005 + `location: location ?? car.location` 1069 |
| backend `__tests__/geocode.test.js` | 4-case unit test, fetch mocked | VERIFIED | 4/4 GREEN (valid payload, empty array, fetch-throws, blank q no-call) |
| mobile `src/services/AuthService.ts` | geocodeCity method | VERIFIED | Line 160 GET /api/geocode/city `params:{q}`, catch → `{ok:false}` |
| mobile `src/screens/SellCarScreen.tsx` | location field, prefill, input, submit gate | VERIFIED | 78, 153, 1001-1007, 418-426 |
| mobile `src/screens/CarDetailsScreen.tsx` | location spec row | VERIFIED | Line 906 |
| mobile `src/constants/translations.ts` | location/locationInput/locationNotFound RU+EN | VERIFIED | Each key count = 2 (RU 218/326/327, EN 1342/1450/1451); no missing keys, no dupes |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| SellCarScreen handleSubmit | GET /api/geocode/city | AuthService.geocodeCity before multipart | WIRED | 420 awaits before forEach at 434; normalized appended 442-444 |
| server.js geocode route | Nominatim search | geocodeService global fetch + UA | WIRED | NOMINATIM_URL + USER_AGENT in geocodeService.js |
| server.js POST/PUT /api/cars | Car.location | destructure + new Car / Object.assign | WIRED | 868/949 (POST), 1005/1069 (PUT) |
| CarDetailsScreen | car.location | renderSpecItem(t.location, car.location) | WIRED | 906 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| CarDetailsScreen location row | car.location | GET car handler spreads `...car` from Mongo doc | DB-backed (schema field persisted on save) | FLOWING (static-verified); live render needs human |
| SellCarScreen normalizedLocation | geo.location | AuthService.geocodeCity → live Nominatim | Real on backend call | needs human (live outbound call) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| backend geocodeService correctness | `npx jest __tests__/geocode.test.js` | 4/4 passed | PASS |
| backend syntax | `node --check` server.js / geocodeService.js / Car.js | all OK | PASS |
| mobile type safety (no new errors) | `npx tsc --noEmit` baseline vs HEAD on 4 files | 10 errors at parent 3f7811b == 10 at HEAD; none on new code lines | PASS (no regression) |
| mobile lint (no new errors) | `npx eslint` 4 files baseline vs HEAD | 10 errors / 20 warns at baseline == HEAD | PASS (no regression) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LX2-LOC | 260613-lx2-PLAN | Optional geocoded vehicle location, details-page v1 | SATISFIED | All 6 truths + 8 artifacts verified above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TBD/FIXME/XXX in new location/geocode code in either repo | - | - |

Note: the eslint `'API_URL' is defined but never used` in AuthService.ts and the `any`/`unknown` tsc errors are PRE-EXISTING baseline (identical count at parent commit 3f7811b), not introduced by this task.

### Scope Confirmation (out-of-scope NOT touched)

- Backend diff `origin/main...HEAD` = exactly the 4 intended files (Car.js, geocodeService.js, server.js, geocode.test.js). ModerationService / listingService.js / listingSchemas.js untouched.
- Mobile commit d065a0f = exactly the 4 intended files. CarCard, search/filter, and the SellCarScreen `adminEdit` branch (route.params?.adminEdit) contain NO location references.

### Human Verification Required

See frontmatter `human_verification` — 4 items: the three runtime listing flows (valid city normalize, junk city block, blank save→'-') and the branch-placement decision below.

### Gaps Summary

The feature is fully present and correct in code across both repos and all 6 observable truths are statically verified, with backend tests GREEN and no tsc/eslint regressions. No code gaps.

One process DEVIATION (not a code gap, routed to human): the task goal and SUMMARY both state the mobile work is committed on `feat/find-a-car`, but `git merge-base --is-ancestor d065a0f feat/find-a-car` returns NO. The location commit `d065a0f` lives on `fix/notifications-header-overflow`, which branched from `feat/find-a-car` after PR #15 merged (one commit ahead at 4c4e62f). The code is real and in the current working tree, so goal achievement holds — but if a reviewer expects to find this work on `feat/find-a-car` for release/merge, they will not. A human should decide whether to merge/cherry-pick onto `feat/find-a-car` or accept the current branch placement. The backend IS correctly on `feat/vehicle-location` at b59eacc as specified.

Status is `human_needed` because (a) the core acceptance behaviors are runtime/visual (live Nominatim call, on-device Alert, details-page render) and cannot be confirmed by static analysis, and (b) the branch-placement deviation needs a human decision.

---

_Verified: 2026-06-13T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
