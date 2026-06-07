---
phase: 12-notification-domain-in-app-center
plan: 07
subsystem: i18n
tags: [mobile, i18n, persistence, language, async-storage, wave-4]
requires:
  - "12-05: PUT /api/users/:uid language whitelist (RU/EN enum-guarded, NI18N-01)"
provides:
  - "[MOB] Persistent LanguageContext: hydrates from AsyncStorage on mount (default RU), persists to AsyncStorage + PUT /api/users/:uid on setLanguage (NI18N-02)"
affects:
  - "Phase 13 server-side notification rendering reads the persisted User.language to localize push/digest copy"
tech-stack:
  added: []
  patterns:
    - "Lazy-uid persistence: read uid from stored userData (AuthService.getUserData) at setLanguage time instead of useAuth — avoids reordering the App.tsx provider stack (LanguageProvider sits below StripeProvider, Pitfall 6) and naturally guards the backend write before auth is ready"
    - "Hydrate-on-mount cancellable effect mirroring FavoritesContext.tsx:34-53"
    - "Backend write reuses the existing user-profile path (AuthService.updateBackendUser → apiClient PUT /api/users/:uid) — language is a profile field, not a notification concern, so MOB-01 does not apply"
key-files:
  created:
    - "[MOB] src/context/__tests__/LanguageContext.test.tsx"
  modified:
    - "[MOB] src/context/LanguageContext.tsx"
decisions:
  - "uid threaded via lazy AsyncStorage userData read (AuthService.getUserData) rather than adding useAuth to LanguageContext — keeps the App.tsx provider stack untouched (LanguageProvider below StripeProvider; reordering risks the no-breaking-changes constraint, RESEARCH Pitfall 6). The lazy read doubles as the auth guard: no stored user → no backend call → no crash before auth."
  - "Backend write reuses AuthService.updateBackendUser (existing PUT /api/users/:uid) since language is a user-profile field; no new AuthService method, no NotificationService usage (MOB-01 N/A — language is not a notification concern)."
  - "Persistence key '@carex_language'; both AsyncStorage write and backend write are fire-and-forget with console.error on failure (matches FavoritesContext toggle pattern) so a transient backend/storage error never blocks the in-memory language switch."
metrics:
  duration: "~5m"
  completed: "2026-06-06"
  tasks: 1
  files: 2
---

# Phase 12 Plan 07: Persistent LanguageContext Summary

Closes the verified i18n persistence gap (NI18N-02): `LanguageContext` was in-memory only (lost on restart, never reaching the backend). It now hydrates from AsyncStorage on mount (default `RU` when absent) and, on `setLanguage`, persists to AsyncStorage AND to `PUT /api/users/:uid` — but only when a user is logged in. This lets the backend render server-side notifications (Phase 13) in the user's chosen language, and the choice survives app restart.

## What Was Built

**Task 1 — Persist language to AsyncStorage + backend** (RED `5903218`, GREEN `a778508`)

- **RED** (`test(12-07)`): added `src/context/__tests__/LanguageContext.test.tsx` with the react-test-renderer + Probe harness (mirrors `NotificationContext.test.tsx`). Mocks `AuthService` (`getUserData` supplies the logged-in user lazily; `updateBackendUser` is the backend PUT). Uses the library's official in-memory AsyncStorage mock (jest.setup.js). Five behaviors: hydrate `EN` from storage, default `RU` when absent, `setLanguage` writes AsyncStorage + backend when logged in, `setLanguage` writes AsyncStorage but NOT backend when no user, and the throws-outside-provider invariant. Failed 3/5 against the in-memory implementation (the 2 passing were default-RU and throws-outside-provider, which the old impl already satisfied).
- **GREEN** (`feat(12-07)`): rewrote `src/context/LanguageContext.tsx`:
  - Added a cancellable hydrate-on-mount `useEffect` reading `AsyncStorage.getItem('@carex_language')`, applying it only when it is exactly `'RU'` or `'EN'` (defaults to `RU` otherwise). Mirrors `FavoritesContext.tsx:34-53`.
  - Replaced the bare `useState` setter with a `useCallback` `setLanguage` that: (1) sets state, (2) `AsyncStorage.setItem('@carex_language', lang)` fire-and-forget, (3) lazily reads `AuthService.getUserData()` and, **only when `userData?.localId` exists**, calls `AuthService.updateBackendUser(uid, { language: lang })`.
  - No `useAuth` import; the provider order in `App.tsx` is untouched.

## Verification

- `npx jest src/context/__tests__/LanguageContext.test.tsx` → **5 passed** (RED→GREEN).
- `git diff --stat App.tsx` → **empty** (provider stack NOT reordered — acceptance criterion).
- `grep -n "AsyncStorage" src/context/LanguageContext.tsx` → both `getItem` (line 53, hydrate) and `setItem` (line 70, persist) present.
- `npx eslint src/context/LanguageContext.tsx src/context/__tests__/LanguageContext.test.tsx` → clean.
- `npx jest src/context/__tests__/` → **37 passed, 4 suites** — zero regression in AuthContext / NotificationContext / PersonalityContext / LanguageContext.

## Deviations from Plan

None — plan executed exactly as written. The "thread the user/uid via callback OR lazy read of stored userData" choice (interfaces §LanguageContext) was resolved in favor of the lazy `AuthService.getUserData()` read, as the plan permitted and asked to be documented.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None — the only backend write is the planned `PUT /api/users/:uid` with a `{ language }` value constrained client-side to `'RU'|'EN'` and enum-validated server-side by the 12-05 whitelist (T-12-07-01). The write is guarded on a logged-in user, so no call fires before auth is ready (T-12-07-02). Both are in the plan's threat_model.

## Self-Check: PASSED

- Files: `src/context/LanguageContext.tsx` (modified) + `src/context/__tests__/LanguageContext.test.tsx` (created) confirmed on disk.
- Commits: `5903218` (RED test) + `a778508` (GREEN feat) confirmed in git log on `feature/notifications-system`.
- Tests: LanguageContext 5/5 pass; full context suite 37/37 pass; App.tsx diff empty; AsyncStorage getItem+setItem both present; lint clean.
