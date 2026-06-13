---
quick_id: 260612-onb
type: execute
wave: 1
depends_on: []
autonomous: true
worktree_isolation: false
files_modified:
  # BACKEND repo (carEx-services) — commit with `git -C <backend path>`
  - backend-services/carEx-services/src/carRequests/validateRequestInput.js
  - backend-services/carEx-services/src/carRequests/router.js
  - backend-services/carEx-services/src/models/CarRequest.js
  - backend-services/carEx-services/__tests__/carRequests/validateRequestInput.test.js
  # MOBILE repo (carEx) — commit in this repo
  - src/services/requests/RequestService.ts
  - src/screens/FindCarScreen.tsx
  - src/constants/translations.ts

must_haves:
  truths:
    - "A buyer creating a car request can pick USD or KGS for the budget; the chosen currency is persisted."
    - "When the buyer does not change the selector, the request is stored as KGS (existing behavior preserved)."
    - "Editing an existing request prefills the saved currency and can change it."
    - "RequestCard and the request detail screen display the chosen currency next to the budget amount."
    - "The backend rejects/normalizes a currency that is not KGS or USD, falling back to KGS."
  artifacts:
    - path: "backend-services/carEx-services/src/carRequests/validateRequestInput.js"
      provides: "currency normalization + validation (KGS|USD, default KGS) returned in value"
      contains: "currency"
    - path: "src/screens/FindCarScreen.tsx"
      provides: "KGS/USD segmented selector wired to FormState.currency"
      contains: "currency"
    - path: "src/services/requests/RequestService.ts"
      provides: "currency field on CreateRequestInput passed through POST/PUT"
      contains: "currency"
  key_links:
    - from: "src/screens/FindCarScreen.tsx"
      to: "RequestService.createRequest / updateRequest"
      via: "input.currency in CreateRequestInput"
      pattern: "currency: form.currency"
    - from: "backend router POST/PUT handlers"
      to: "CarRequest document"
      via: "value.currency from validator (not hardcoded 'KGS')"
      pattern: "value.currency"
---

<objective>
Add a USD / KGS currency selector to the car-request Budget field so buyers explicitly choose the budget currency instead of it silently defaulting to KGS. The chosen currency must persist through the backend validator and POST/PUT handlers, prefill on edit, and render on the request card + detail screens (which already read `currency`). Default stays KGS for the Kyrgyzstan-focused audience.

Purpose: Buyers quoting in USD currently have their budget mislabeled as KGS, which misleads sellers.
Output: End-to-end currency selection across the mobile form, mobile service, backend validator, and backend create/update handlers, with tests.
</objective>

<cross_repo_warning>
**This task spans TWO git repositories. Worktree isolation is DISABLED — you are on the main tree of each repo.**

- MOBILE (this repo): `/Users/beckmaldinVL/development/mobileApps/carEx` — branch `feat/find-a-car`. Commit normally (`git add` / `git commit` in this repo).
- BACKEND (sibling repo): `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` — branch `feat/car-requests-slice3`. You MUST commit backend changes IN the backend repo using `git -C /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services <git-args>`. Never mix backend files into a mobile commit.

**Do NOT update ROADMAP.md.** This is a quick task, not a phase.

Read each file before editing it, even though the findings below are exact.
</cross_repo_warning>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md

<interfaces>
<!-- Exact contracts extracted from the codebase. Use directly; no exploration needed. -->

BACKEND validator — src/carRequests/validateRequestInput.js (returns `{ errors, value }`):
Currently has no `currency` handling. `currency` from the body is silently dropped.

BACKEND POST handler — src/carRequests/router.js ~line 93-106:
```
const doc = await CarRequest.create({
  ...value,                 // <- spread of validated fields
  ...,
  currency: 'KGS',          // <- HARDCODED; overrides any value.currency
  status: 'open',
  ...
});
```
NOTE: the hardcoded `currency: 'KGS'` line appears AFTER `...value`, so it overrides. Remove it (so `...value.currency` carries through) OR replace with `currency: value.currency`.

BACKEND PUT handler — src/carRequests/router.js ~line 192-208 applies editable fields
(budgetMax, budgetMin, yearMin/Max, colors, engine, fuel, note, telegramUsername) but
does NOT set `doc.currency`.

BACKEND model — src/models/CarRequest.js line 14: `currency: { type: String, default: 'KGS' }` (plain String, no enum).

MOBILE service — src/services/requests/RequestService.ts:
```typescript
export interface CreateRequestInput {
  makeId: string;
  modelId?: string | null;
  ...
  budgetMax: number;
  ...
  telegramUsername?: string | null;
  // NO currency field today
}
```
`CarRequest` and `RedactedCarRequest` interfaces ALREADY have `currency: string`.
`createRequest` POSTs `input` to `/api/car-requests`; `updateRequest` PUTs `input` to `/api/car-requests/:id`.

MOBILE form — src/screens/FindCarScreen.tsx:
- FormState interface (~line 30-44) and EMPTY const (~line 46-60): no currency field.
- Edit prefill `setForm({...})` (~line 94-108): no currency.
- handleSubmit builds `input: CreateRequestInput` (~line 165-179): no currency.
- Budget section UI (~line 332-350): `<Text style={styles.section}>{t.budget}</Text>` then a `styles.row` with two TextInputs.
- `set(k, v)` helper (~line 123) sets one FormState key.

MOBILE picker pattern to MIRROR — src/screens/ServiceProfileScreen.tsx ~line 25-27:
```typescript
const CURRENCIES = [
  { code: '$', label: 'USD', flag: '🇺🇸' },
  { code: 'сом', label: 'KGS', flag: '🇰🇬' },
];
```
The value SENT to the backend is the `label` ('KGS' | 'USD'), NOT the `code` symbol.

MOBILE display (NO changes needed) — RequestCard.tsx formatBudget (~line 13-20) and
CarRequestDetailsScreen.tsx budgetText (~line 126-129) already render `${amount} ${req.currency}`.

BACKEND test conventions — __tests__/carRequests/validateRequestInput.test.js:
```javascript
const { validateRequestInput } = require('../../src/carRequests/validateRequestInput');
const validBody = { makeId: '64b000000000000000000001', budgetMax: 15000 };
// it('accepts a minimal valid body ...', () => { const { errors, value } = validateRequestInput(validBody); ... });
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — accept, validate, persist currency (validator + POST/PUT + test)</name>
  <files>backend-services/carEx-services/src/carRequests/validateRequestInput.js, backend-services/carEx-services/src/carRequests/router.js, backend-services/carEx-services/src/models/CarRequest.js, backend-services/carEx-services/__tests__/carRequests/validateRequestInput.test.js</files>
  <action>
    Repo: BACKEND (carEx-services). Commit with `git -C /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`.

    1. validateRequestInput.js — Add currency handling. Read `body.currency`; if present, uppercase + trim it. Accept it only if it equals 'KGS' or 'USD'; otherwise (absent, empty, or unrecognized) default to 'KGS'. Always set `value.currency` to the resolved value ('KGS' | 'USD'). Do NOT push a validation error for an unrecognized currency — silently coerce to the 'KGS' default to preserve forgiving behavior (per the KGS-default constraint). Define an allowed-currencies constant (e.g. `const ALLOWED_CURRENCIES = ['KGS', 'USD'];`) near the top to mirror the existing ALLOWED_STRING_FIELDS style.

    2. router.js POST handler (~line 93-106) — Remove the hardcoded `currency: 'KGS',` line inside `CarRequest.create({...})` so the `...value` spread carries `value.currency`. (Equivalent acceptable alternative: replace with `currency: value.currency`.) Ensure the resolved currency is what gets stored.

    3. router.js PUT handler (~line 192-208) — Add `doc.currency = value.currency;` alongside the other editable-field assignments so editing can change currency. Since the validator always returns a 'KGS'|'USD' value, no `?? null` fallback is needed.

    4. CarRequest.js model (line 14) — OPTIONAL hardening: change `currency: { type: String, default: 'KGS' }` to `currency: { type: String, enum: ['KGS', 'USD'], default: 'KGS' }`. Keep `default: 'KGS'`. This is nice-to-have; the validator is the real gate. Apply it.

    5. validateRequestInput.test.js — Add cases mirroring existing style: (a) defaults currency to 'KGS' when absent; (b) accepts and uppercases 'usd' → 'USD'; (c) coerces an unrecognized currency (e.g. 'EUR') to 'KGS'. Use the existing `validBody`.
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services && npx jest __tests__/carRequests/validateRequestInput.test.js __tests__/carRequests/router.test.js</automated>
  </verify>
  <done>Validator returns `value.currency` as 'KGS'|'USD' (default KGS); POST persists the chosen currency (no longer hardcoded); PUT updates currency; new validator tests pass; existing carRequests backend tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Mobile — currency on service input + KGS/USD selector in form + i18n</name>
  <files>src/services/requests/RequestService.ts, src/screens/FindCarScreen.tsx, src/constants/translations.ts</files>
  <action>
    Repo: MOBILE (carEx). Commit in this repo normally.

    1. RequestService.ts — Add `currency: 'KGS' | 'USD';` to the `CreateRequestInput` interface (required). `createRequest`/`updateRequest` already spread `input` into the POST/PUT body, so the field passes through automatically — confirm no body filtering drops it.

    2. translations.ts — Add a RU-first label for the selector, e.g. `currency` key → RU 'Валюта', EN 'Currency'. Add to BOTH the RU and EN objects (EN parity is mandatory; RU is default). Reuse `t.budget` for the existing budget label.

    3. FindCarScreen.tsx:
       - Add `currency: 'KGS' | 'USD'` to the `FormState` interface and set `currency: 'KGS'` in the `EMPTY` const (preserves default).
       - In the edit-prefill `setForm({...})` block (~line 94-108), add `currency: (found.currency === 'USD' ? 'USD' : 'KGS')` so a saved 'USD' prefills and anything else (incl. legacy/missing) falls back to KGS.
       - Render a KGS/USD segmented toggle near the Budget section (after the `styles.row` with the two budget TextInputs, ~line 350). Mirror the ServiceProfileScreen UX: two tappable pills showing flag + label ('KGS' 🇰🇬 / 'USD' 🇺🇸), the active one highlighted. On tap, call `set('currency', 'KGS' | 'USD')` (the `set` helper already exists; widen its type if needed, or use a dedicated `setForm` update). Label the group with `t.currency`. The value stored/sent is the label 'KGS'|'USD', never the symbol. Add StyleSheet entries at the bottom of the file following the existing inline-StyleSheet convention; use `COLORS`/`SIZES` constants (no hardcoded hex).
       - In `handleSubmit`, add `currency: form.currency,` to the `input: CreateRequestInput` object (~line 165-179).
  </action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx && npx tsc --noEmit -p tsconfig.json && npx jest src/services/requests/__tests__/RequestService.test.ts</automated>
  </verify>
  <done>`CreateRequestInput` includes `currency`; the form shows a working KGS/USD selector defaulting to KGS; submit sends `currency`; edit prefills the saved currency; RU+EN `currency` label exist; typecheck passes; RequestService tests pass.</done>
</task>

</tasks>

<verification>
- Backend: `npx jest __tests__/carRequests` green (or at least validateRequestInput + router suites); manual sanity that POST without `currency` stores 'KGS' and POST with `currency:'USD'` stores 'USD'.
- Mobile: `npx tsc --noEmit` clean; `npx jest src/services/requests/__tests__/RequestService.test.ts` green. (Ignore the ~18 pre-existing unrelated mobile jest failures across 5 other suites — they fail on clean main.)
- Display screens (RequestCard, CarRequestDetailsScreen) unchanged and automatically show the chosen currency.
</verification>

<success_criteria>
- Buyer selects USD or KGS in FindCarScreen; choice persists end-to-end and is visible on card + detail.
- Omitting the selector (or legacy data) yields KGS.
- Editing a request prefills and can change currency.
- Backend currency is validated to KGS|USD with KGS fallback; hardcoded 'KGS' removed from POST; PUT updates currency.
- Two commits land: one in the backend repo (`git -C ...`), one in the mobile repo.
- No new dependencies; existing picker/StyleSheet/i18n patterns reused.
</success_criteria>

<output>
After completion, create `.planning/quick/260612-onb-add-usd-kgs-currency-selector-to-car-req/260612-onb-SUMMARY.md`.

Commit guidance (commit only when work is done and verified):
- Backend: `git -C /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services add <files> && git -C /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services commit -m "feat(car-requests): persist buyer-selected budget currency (KGS|USD)"`
- Mobile: `git add <files> && git commit -m "feat(find-a-car): add USD/KGS currency selector to car-request budget"`
</output>
