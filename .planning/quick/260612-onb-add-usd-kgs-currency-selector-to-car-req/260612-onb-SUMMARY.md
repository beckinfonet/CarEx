---
quick_id: 260612-onb
title: Add USD/KGS currency selector to car-request budget
type: execute
completed: 2026-06-12
repos:
  backend: feat/car-requests-slice3
  mobile: feat/find-a-car
commits:
  backend: 5c5313f
  mobile: 8e086fe
key-files:
  modified:
    - backend-services/carEx-services/src/carRequests/validateRequestInput.js
    - backend-services/carEx-services/src/carRequests/router.js
    - backend-services/carEx-services/src/models/CarRequest.js
    - backend-services/carEx-services/__tests__/carRequests/validateRequestInput.test.js
    - src/services/requests/RequestService.ts
    - src/screens/FindCarScreen.tsx
    - src/constants/translations.ts
    - src/services/requests/__tests__/RequestService.test.ts
---

# Quick 260612-onb: USD/KGS Currency Selector for Car-Request Budget Summary

Buyers now explicitly choose USD or KGS for their car-request budget instead of it silently defaulting to KGS. The chosen currency flows end-to-end: mobile form selector → service input → backend validator → create/update persistence → display on RequestCard and the detail screen (both already read `currency`). Default stays KGS for the Kyrgyzstan audience, and legacy/missing data falls back to KGS.

## What shipped

### Backend (carEx-services, branch `feat/car-requests-slice3`, commit `5c5313f`)
- `validateRequestInput.js` — added `ALLOWED_CURRENCIES = ['KGS', 'USD']` + `DEFAULT_CURRENCY = 'KGS'`. Reads `body.currency`, trims + uppercases it, and resolves to a valid currency or the KGS default. Always returns `value.currency`. Forgiving by design: an unrecognized value coerces to KGS with no validation error.
- `router.js` POST handler — removed the hardcoded `currency: 'KGS'` line so the `...value` spread carries the resolved currency.
- `router.js` PUT handler — added `doc.currency = value.currency;` alongside the other editable-field assignments so edits can change currency.
- `CarRequest.js` model — hardened `currency` to `enum: ['KGS', 'USD'], default: 'KGS'`.
- `validateRequestInput.test.js` — three new cases: defaults to KGS when absent, uppercases `usd` → `USD`, coerces `EUR` → `KGS`.

### Mobile (carEx, branch `feat/find-a-car`, commit `8e086fe`)
- `RequestService.ts` — `CreateRequestInput` now has a required `currency: 'KGS' | 'USD'`. The field passes through `createRequest`/`updateRequest` automatically (they spread `input` into the POST/PUT body).
- `FindCarScreen.tsx` — added `currency` to `FormState` (default `'KGS'` in `EMPTY`), edit prefill maps `found.currency === 'USD' ? 'USD' : 'KGS'`, a two-pill segmented KGS/USD selector (flag + label, active pill highlighted) renders under the Budget section, `set('currency', ...)` is wired (the `set` helper was made generic so it's type-safe), and `handleSubmit` sends `currency: form.currency`. New StyleSheet entries use `COLORS`/`SIZES` only.
- `translations.ts` — added `currency` label: RU `'Валюта'`, EN `'Currency'`.
- `RequestService.test.ts` — updated the three input fixtures to include the now-required `currency` field.

## Verification

- Backend: `npx jest __tests__/carRequests/validateRequestInput.test.js __tests__/carRequests/router.test.js` → 2 suites / 24 tests pass.
- Mobile: `npx tsc --noEmit` shows no in-scope errors (remaining output is the documented pre-existing baseline: AuthService implicit-any + node-global usage in unrelated test files). `npx jest src/services/requests/__tests__/RequestService.test.ts` → 12/12 pass.
- Display screens (RequestCard, CarRequestDetailsScreen) unchanged — they already render `${amount} ${currency}` and now show the buyer's chosen currency automatically.

## Deviations from Plan

None for Rules 1-4. One in-scope adjustment within Task 2 as planned: making `currency` required on `CreateRequestInput` broke three `RequestService.test.ts` fixtures that omitted it — updated those fixtures (the test file is an explicit Task 2 verification target).

## Self-Check: PASSED

- backend commit `5c5313f` present on `feat/car-requests-slice3`.
- mobile commit `8e086fe` present on `feat/find-a-car`.
- All 8 modified files exist and are committed in their correct repos.
- Backend (24 tests) and mobile RequestService (12 tests) suites green.
