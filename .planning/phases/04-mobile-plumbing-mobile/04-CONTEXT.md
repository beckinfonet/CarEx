# Phase 4: Mobile Plumbing (Mobile) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Mobile gets a separate `ModerationService` module (not glued onto `AuthService`), a shared axios instance with a request interceptor that attaches `Authorization: Bearer <idToken>` and a response interceptor that catches `403 account_suspended`, and an `AppState` foreground handler so suspensions propagate without an app restart. Scope is plumbing only — the affected-user banner UX and the backend checkout-flow migration live in other phases.

**Covers:** MOB-01, MOB-02, MOB-03, MOB-04.

**Does NOT cover this phase:**
- ModerationBanner / SuspendedScreen UI (Phase 6 — affected-user UX)
- Admin moderation screens that consume `ModerationService` (Phase 5)
- Token-refresh-on-401 lifecycle (follow-up phase — Phase 4 treats stale-token as "log out + re-login")
- Migration of existing `AuthService.createOrders` checkout flow from the now-410 `POST /api/orders` to `POST /api/payments/confirm-booking` (deferred — but flagged below because it will break on live run until Phase 4 OR a follow-up fixes it)
- Removal of Phase 3's dual-accept body-uid fallback (Phase 6 QUAL-03)
- Split into `AdminModerationService` + `UserModerationService` — one unified module for now

**Scope boundary:** Mobile only — all work in this repo (`/Users/beckmaldinVL/development/mobileApps/carEx`). Backend is untouched.

</domain>

<decisions>
## Implementation Decisions

### Shared Axios Client (`src/services/http/client.ts` — MOB-02)

- **D-01:** **Shared client's base URL is `${API_URL}` only.** The instance is `axios.create({ baseURL: API_URL })`. Identity Toolkit calls (`identitytoolkit.googleapis.com/v1/accounts:*`) stay on plain `axios` with the Firebase Web API key — they are a different authentication surface (API key in query string, not idToken in Authorization header). Logically two services; keeps the interceptor's concerns pure.

- **D-02:** **Bearer injection is unconditional on the shared client.** Request interceptor attaches `Authorization: Bearer <idToken>` whenever a token is cached, to ALL requests — not just the five Phase 3-gated routes. Rationale:
  - Phase 3 mounts `attachAuthIfPresent` (soft, no 401 on missing header) — so sending idToken to a non-gated route is a no-op, not a break.
  - Avoids duplicating the gated-routes list on the mobile side (drift risk when Phase 6 expands the gated set).
  - Simpler to reason about: "every carEx API call carries idToken when we have one."
  - If no token cached (logged-out), interceptor skips the header — request goes through as anonymous.

- **D-03:** **Token refresh is OUT OF SCOPE for Phase 4.** Firebase idTokens last 1 hour. When a request returns `401` (stale/missing token), the client clears the cached token and routes to login (existing `AuthService.logout()` + navigation). Proactive refresh via `secureToken.googleapis.com` and reactive refresh-on-401-then-retry are both tracked as follow-up work in a later auth-lifecycle phase. Rationale: Phase 4 is plumbing for moderation propagation; bolting token-refresh machinery onto this milestone widens scope beyond what MOB-01..04 require.

- **D-04:** **Request interceptor reads idToken via a module-level getter registered by AuthContext.**
  ```ts
  // src/services/http/client.ts
  let tokenProvider: (() => string | null) | null = null;
  export function setTokenProvider(fn: () => string | null) { tokenProvider = fn; }

  client.interceptors.request.use((config) => {
    const token = tokenProvider?.();
    if (token && config.url?.startsWith('/') /* or matches API_URL */) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  ```
  `AuthContext` calls `setTokenProvider(() => currentIdTokenRef.current)` once on mount. Zero `AsyncStorage` read per request (big perf win over the current `AuthService.getToken()` pattern). Dependency direction is correct: context → client, not client → context.

### ModerationService (`src/services/moderation/ModerationService.ts` — MOB-01)

- **D-05:** **`ModerationService` wraps the 7 admin moderation write endpoints plus the Phase-5 history read.** Methods (final signatures confirmed during planning):
  - `suspend(targetUid, body)` → `POST /api/admin/moderation/:targetUid/suspend`
  - `unsuspend(targetUid)` → `PATCH /api/admin/moderation/:targetUid/unsuspend`
  - `revokeRole(targetUid, body)` → `POST /api/admin/moderation/:targetUid/revoke-role`
  - `restoreRole(targetUid, body)` → `POST /api/admin/moderation/:targetUid/restore-role`
  - `editProviderProfile(targetUid, body)` → `POST /api/admin/moderation/:targetUid/edit-profile`
  - `deleteProviderProfile(targetUid)` → `DELETE /api/admin/moderation/:targetUid/provider-profile`
  - `getHistory(targetUid)` → `GET /api/admin/moderation/:targetUid/history` (Phase 5 adds this route; method is ready on Phase 4 either as a stub or a TODO — planner decides based on whether Phase 5's route lands before Phase 4 merges)

  Affected-user moderation read stays with existing `AuthService.getBackendUser(uid)` — that call already returns the User doc including `moderationStatus`, so `AuthContext.refreshUser()` continues to invoke it. No new method needed in Phase 4 for affected-user refresh; the interceptor path is:  **interceptor catches 403 → calls AuthContext.refreshUser() → refreshUser() calls AuthService.getBackendUser() → moderationStatus now fresh in context.**

- **D-06:** **Single module, no split.** Methods grouped by section comments (`// --- Admin writes ---`, `// --- Reads ---` if needed). Matches the backend router shape (`/api/admin/moderation/*`). Avoids ceremony for a milestone whose point is consolidation.

- **D-07:** **Methods throw a normalized `ModerationError`** with Phase 3 D-15 fields:
  ```ts
  export class ModerationError extends Error {
    constructor(
      public code: 'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string,
      public status?: string,        // moderationStatus.state — 'blocked_with_review' | 'feature_limited' | …
      public reasonCategory?: string,
      public note?: string,
      public httpStatus?: number,
    ) { super(`ModerationError: ${code}`); }
  }
  ```
  Screens pattern-match on `err.code`. Consistent surface regardless of HTTP status. `ModerationError` is the mobile counterpart to the backend's `ProviderSuspendedError` (Phase 3 D-11).

- **D-08:** **No AuthService migration.** Grep confirms `AuthService.ts` has zero moderation methods today. MOB-01 guardrail ("no methods added to AuthService during this milestone") keeps it that way. `getAdminStatus` and `requestSeller/Broker/Logistics` stay in AuthService (they're auth/onboarding, not moderation proper).

### 403 Response Interceptor (MOB-03)

- **D-09:** **Interceptor catches `response.status === 403 && response.data?.error === 'account_suspended'`, awaits `AuthContext.refreshUser()`, then re-throws a typed `ModerationError`.** Pseudocode:
  ```ts
  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const res = err.response;
      const isAcctSuspended = res?.status === 403 && res?.data?.error === 'account_suspended';
      if (isAcctSuspended && !err.config?._skipModerationInterceptor) {
        await moderationRefreshListener?.();  // → AuthContext.refreshUser()
        throw new ModerationError(
          'account_suspended',
          res.data.status,
          res.data.reasonCategory,
          res.data.note,
          403,
        );
      }
      throw err;
    }
  );
  ```
  The caller's promise rejects with `ModerationError`. Calling screens read `user.moderationStatus` from context (which is now fresh) or branch on the error code.

- **D-10:** **Await `refreshUser()` inside the interceptor before re-throwing.** Rationale: when the calling screen catches `ModerationError` in its own try/catch, `user.moderationStatus` in context is ALREADY updated. Reads are synchronous. One 403 = one coherent state transition. The latency cost (a second network round-trip) is paid on an already-failing request — acceptable.

- **D-11:** **Loop guard via `_skipModerationInterceptor: true` axios config flag.** `AuthContext.refreshUser()` calls the shared client with `{ _skipModerationInterceptor: true }` in its axios config. The interceptor checks this flag and, when set, simply re-throws the error without calling refreshUser again. Single-instance design, easy to test. Without this flag, a 403 during the refresh itself would infinite-loop.

- **D-12:** **Banner UI is deferred to Phase 6.** Phase 4 only ensures `user.moderationStatus` is fresh in AuthContext after a 403. Screens may continue to show their existing generic error (Alert.alert) for the failed write. The root-mounted ModerationBanner component + copy + dismiss-affordance are Phase 6 scope. MOB-03 is satisfied by the plumbing side: the interceptor catches, refreshUser runs, moderationStatus updates — no navigation loop (because we don't navigate anywhere).

### AppState Foreground Handler (MOB-04)

- **D-13:** **`AppState` listener lives in `App.tsx`, inside the AuthProvider subtree.** A small `useAppStateRefresh()` hook or inline effect block. Placement mirrors the existing `OfflineNotice` at root and matches success criterion #4 verbatim ("the `AppState` handler in `App.tsx`").

- **D-14:** **30-second cooldown between foreground refreshes.** The hook tracks `lastRefreshAt` as a ref; on background→active transition, if `Date.now() - lastRefreshAt > 30000`, call `refreshUser()`. Rationale: mobile app-switches happen constantly (notification → back, share sheet → back); a refresh every time burns battery and API quota. 30s is short enough to catch the "I was suspended in the last few minutes" case and long enough to not fire on every tab-away.

- **D-15:** **Dedupe via `refreshInFlight: Promise<User> | null` inside AuthContext.** `AuthContext.refreshUser()` internally:
  ```ts
  let refreshInFlight: Promise<User> | null = null;
  async function refreshUser() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try { return await AuthService.getBackendUser(user.localId); }
      finally { refreshInFlight = null; }
    })();
    return refreshInFlight;
  }
  ```
  Both the AppState handler and the 403 interceptor can call `refreshUser()` concurrently; they await the same promise. No double fetch, no race on setState. Correctness matters because a 403 could hit in the same tick as the foreground transition.

- **D-16:** **Skip refresh entirely when `user === null` (logged out).** `if (!user?.localId) return;` at the top of the handler. Avoids a useless `GET /api/users/undefined` 404 on every foreground transition for users who aren't logged in. Also protects against a mid-logout race where the context is tearing down.

### Claude's Discretion

Areas where the planner/executor may decide without asking:

- **Test strategy** — Jest + React Native Testing Library. Interceptor unit tests with axios-mock-adapter (or a manual jest.mock('axios')); AppState hook tests with `@testing-library/react-native`'s `act` + AppState mocking. Integration test harness decided at plan time.
- **TypeScript signatures for ModerationService method bodies** — match Phase 2 backend route shapes (review `02-*-SUMMARY.md` for body schemas).
- **Exact config flag name** — `_skipModerationInterceptor` is the working name; planner may rename for codebase consistency (`_skipInterceptors`, `_internalRefresh`, etc.) as long as the grep-stable single-location-of-truth property is preserved.
- **AppState hook vs inline effect in App.tsx** — `useAppStateRefresh(refreshUser, { cooldownMs: 30_000 })` hook is cleaner but a 15-line inline effect is also acceptable if the planner judges the hook ceremony unnecessary.
- **Whether `getHistory` ships in Phase 4 or waits for Phase 5** — depends on Phase 5 scheduling. Safe default: include a stub method that throws "Not implemented — Phase 5 adds the /history route" if called before Phase 5.
- **Error normalization for non-403 errors** — `ModerationError` is scoped to moderation-specific responses. Other HTTP errors can continue to surface as raw axios errors (current convention) OR a minimal `ApiError` wrapper — planner choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone scope, constraint "Don't introduce new state-management or networking libs"
- `.planning/REQUIREMENTS.md` §Mobile Plumbing — MOB-01, MOB-02, MOB-03, MOB-04
- `.planning/ROADMAP.md` §"Phase 4: Mobile Plumbing (Mobile)" — Goal + 4 success criteria (the verifier's source of truth)
- `.planning/STATE.md` — Current blockers, recent activity

### Phase 3 artifacts (locked carry-forward)
- `.planning/phases/03-backend-enforcement-backend/03-CONTEXT.md` §Decisions — D-03 (dual-accept body-uid fallback that Phase 4 Bearer wiring retires on the idToken path), D-12 (`POST /api/orders` is 410 Gone — mobile checkout must not call it), D-15 (403 response shape that mobile `ModerationError` mirrors)
- `.planning/phases/03-backend-enforcement-backend/03-REVIEW.md` + `03-REVIEW-FIX.md` — Known backend behaviors after the CR-01 fix (`$and`-merge in hide hooks); doesn't affect Phase 4 but proves the gated routes behave correctly on the server side

### Phase 1 & 2 artifacts (background)
- `.planning/phases/01-schema-security-baseline-backend/01-CONTEXT.md` §Decisions — D-11/D-12 (`moderationStatus` shape including `restrictedFeatures[]` — the fields mobile will display), D-26 (`STATUS_POLICY` capability map)
- `.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md` — Admin write endpoint shapes that `ModerationService` wraps (D-02 error shape, D-08/D-10 revoke-role semantics, D-17/D-18 suspend body shape)

### Mobile codebase (existing — required reading for planner/executor)
- `src/services/AuthService.ts` — Current axios usage + AsyncStorage pattern. Shared client extraction starts here. Key lines:
  - `1-10` — `axios` import + `AUTH_URL`/`API_KEY` constants (identity-toolkit scope — stays on plain axios per D-01)
  - `11` — `export const AuthService = { … }` module-level object pattern
  - `getToken/saveToken` — AsyncStorage-backed idToken cache (becomes the getter source in D-04)
  - `getBackendUser(uid)` — the call that `AuthContext.refreshUser()` delegates to
- `src/context/AuthContext.tsx` — Where `refreshUser` lives today (line 61). Phase 4 enriches it per D-15 (dedupe) and wires `setTokenProvider` on mount per D-04.
- `App.tsx` — Provider stack order + root-mounted listeners. Phase 4 adds the AppState handler here per D-13. Existing pattern to mirror: `OfflineNotice` component uses `useNetwork()` hook which wraps `NetInfo.addEventListener`.
- `src/constants/config.ts` — `API_URL` base (the shared client's `baseURL`)
- `src/components/OfflineNotice.tsx` — Reference pattern for root-mounted banner (Phase 6 will write ModerationBanner using the same shape)
- `CLAUDE.md` — "Don't introduce new state-management or networking libs for this milestone. Extend existing `AuthService.ts` or split sensibly; do not rewrite it wholesale."

### External docs
- React Native AppState: https://reactnative.dev/docs/appstate (listener lifecycle, 'active'/'background'/'inactive' states)
- Axios interceptors: https://axios-http.com/docs/interceptors (request/response interceptor ejection, config flags)
- Axios instance create: https://axios-http.com/docs/instance (`axios.create({ baseURL })` semantics)
- Firebase idToken lifetime: 1h (secureToken.googleapis.com for refresh — deferred per D-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`axios` 1.13.4** (already in package.json) — no new dep needed for the shared client
- **`@react-native-async-storage/async-storage` 2.2.0** — used for idToken persistence; Phase 4 doesn't change that
- **`AuthService` object-module pattern** (`export const AuthService = { method: async () => … }`) — mirror this shape for `ModerationService`
- **`AuthContext.refreshUser()` at `src/context/AuthContext.tsx:61-65`** — already implements a user-doc re-fetch; Phase 4 wraps it in a dedupe guard (D-15)
- **`useNetwork()` hook + `OfflineNotice` component** — reference pattern for AppState listener + root-mounted strip (Phase 6 UI will also mirror this)
- **`src/types/navigation.ts`** — `RootStackParamList`; no new routes in Phase 4

### Established Patterns (must honor)

- **Module-level object export for services** (`export const AuthService = { ... }`) — `ModerationService` follows this, not a class
- **`try/catch` around every axios call that throws `error.response.data.error`** — current AuthService convention; Phase 4 normalizes via `ModerationError` for moderation-specific 403s, but other errors continue in the existing shape
- **Provider stack in `App.tsx`** (GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer) — AppState effect lives inside AuthProvider subtree, above NavigationContainer
- **`useAuth()` / `useCart()` / `useLanguage()` hooks throw if used outside provider** — `ModerationService` is NOT a context (no new provider needed); it's a stateless service module
- **i18n via `useLanguage().t`** — any new user-facing string added in Phase 4 (e.g., the logout redirect banner) must have RU + EN keys in `src/constants/translations.ts`

### Integration Points

- **`src/services/http/client.ts`** (NEW) — shared axios instance; both `AuthService` and `ModerationService` import from here instead of creating their own
- **`src/services/moderation/ModerationService.ts`** (NEW) — 7 admin methods + error types
- **`src/services/moderation/errors.ts`** (NEW, optional) — `ModerationError` class; could live inside ModerationService.ts but separating helps Phase 5 & 6 reuse the type without dragging in the service
- **`src/context/AuthContext.tsx`** (MODIFIED) — register `setTokenProvider` on mount (D-04); add `refreshInFlight` dedupe (D-15); refactor existing refreshUser to call the shared client path via AuthService.getBackendUser (which itself migrates to shared client)
- **`src/services/AuthService.ts`** (MODIFIED) — migrate non-identity-toolkit calls to use the shared client; identity-toolkit calls (signIn/signUp/:delete) stay on plain axios. NO new methods added (MOB-01).
- **`App.tsx`** (MODIFIED) — add `useAppStateRefresh()` hook call (or inline useEffect) inside AuthProvider subtree; listen to AppState, call `useAuth().refreshUser()` on background→active transitions per D-14/D-16

### Anti-Pattern Warnings

- **Do NOT add moderation methods to `AuthService.ts`** — MOB-01 guardrail. Grep the diff: `grep -c 'moderation\|suspend\|revoke' src/services/AuthService.ts` should return 0 before and after Phase 4.
- **Do NOT attach Bearer to identity-toolkit requests** — Firebase Identity Toolkit rejects Authorization header on unauthenticated endpoints (signIn, signUp). Keep those on plain `axios`, not the shared client (D-01).
- **Do NOT introduce a new state-management library** — CLAUDE.md + PROJECT.md both forbid. AuthContext + refs + module-level singletons are enough.
- **Do NOT call `refreshUser()` inside the request interceptor** — only the response interceptor on 403. The request interceptor stays fast and synchronous.
- **Do NOT let the 403 interceptor recurse** — MUST honor `_skipModerationInterceptor: true` flag (D-11) on the refresh request. Missing this is the single most likely bug class.
- **Do NOT fire-and-forget `refreshUser()` in the interceptor** — `await` it (D-10) so screens see fresh context.
- **Do NOT navigate on 403** — success criterion #3 forbids "user-visible navigation loop". Banner UX lives in Phase 6; Phase 4 only refreshes state.
- **Do NOT fire the AppState refresh when logged out** — `user === null` guard at top of handler (D-16).
- **Do NOT drop the 30s cooldown** — background→active fires on every app-switch including notification pulls; without debounce the backend will see burst traffic (D-14).

</code_context>

<specifics>
## Specific Ideas

- **`_skipModerationInterceptor` flag as grep-bait for follow-up review.** Same role as `includeAllUsers` on the backend (Phase 3 D-07) — a single explicit opt-out that's auditable. Only TWO call sites should exist in the mobile code: (1) the interceptor declaration, (2) `AuthContext.refreshUser()`. Any third occurrence is a red flag for Phase 6 code review.

- **Service naming symmetry with backend.** Backend: `src/security/requireNotSuspended.js` + `src/moderation/service.js`. Mobile: `src/services/http/client.ts` + `src/services/moderation/ModerationService.ts`. Same topic folder naming helps when a developer jumps repos.

- **`ModerationError` inherits from Error** (not a plain object) so that existing `catch (err)` patterns in screens continue to work, `instanceof ModerationError` is reliable, and stack traces are preserved.

- **Dedupe promise is STORED AT MODULE LEVEL inside AuthContext**, not in React state. Rationale: React state is batched and async; module-level `let` gives synchronous reads. This is the same pattern Phase 3's confirmBooking uses for its idempotency fast-path.

- **The 30s cooldown applies to ALL foreground refreshes** — not just the AppState-triggered ones. If the 403 interceptor fires a refresh, then 5 seconds later the user backgrounds+foregrounds, the AppState handler's refresh is a no-op. Shared `lastRefreshAt` inside AuthContext.

- **`API_URL` startsWith check in the request interceptor.** `config.url` is the path-only suffix when using `axios.create({ baseURL })`. So the interceptor doesn't need a URL-matching check against `API_URL` — the baseURL already scopes it. One-line interceptor: `if (token) config.headers.Authorization = \`Bearer ${token}\`;`

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to later phases or milestones — do not quietly re-introduce:**

- **ModerationBanner root-mounted strip (Phase 6, AFF-* requirements).** Phase 4 only refreshes `user.moderationStatus`; the visible banner + copy + dismiss affordance is Phase 6 affected-user UX. Root-mounted strip pattern already proven by `OfflineNotice`.

- **Token refresh lifecycle (proactive + reactive on 401).** Firebase idTokens last 1h. Phase 4 treats expiry as "log out → re-login". A follow-up phase (not numbered yet) will add `secureToken.googleapis.com` refresh with an in-flight dedupe. Risk is bounded: real user sessions rarely span >1h without a screen interaction.

- **Checkout flow migration from `POST /api/orders` → `POST /api/payments/confirm-booking`.** The 410 Gone from Phase 3 D-12 means the existing `AuthService.createOrders` call will fail once Phase 3 ships. This is NOT in MOB-01..04 scope. **Risk flag:** the mobile app's cart checkout will break on the first live-backend run against Phase 3 until either (a) a follow-up phase migrates the checkout flow to confirm-booking, or (b) Phase 4 expands scope. Planner should note this during planning and surface it to the user so the timeline is explicit. Possible resolution: add a 1-plan mini-scope to Phase 4 that swaps the call shape, OR create a Phase 4.1 after Phase 4 ships.

- **Split into `AdminModerationService` + `UserModerationService`.** Rejected in D-06. If/when affected-user reads grow beyond `getBackendUser`, split may revisit. Not now.

- **Mute/dismiss banner endpoint on the backend.** No backend support today; session-local dismiss state in Phase 6 is sufficient. Server-side dismiss tracking is a future enhancement.

- **Proactive request interceptor token-expiry check.** See token refresh lifecycle above.

- **Separate bare axios instance for `refreshUser`.** Rejected in D-11 in favor of the config flag. Clean isolation was deemed overkill for a single opt-out.

- **AuthService modernization (axios client extraction for identity-toolkit too).** Phase 4 only migrates the backend-facing calls to the shared client. Identity-toolkit calls keep their plain-axios usage. A future modernization pass may refactor identity-toolkit into its own service (`src/services/identity/IdentityToolkitService.ts`) — not in scope.

- **Typed backend response interfaces generated from the backend schema.** Would be nice-to-have (OpenAPI or Zod + shared types) but out of scope; Phase 4 uses hand-written TypeScript types for `ModerationError` and `ModerationService` method signatures.

- **Cross-phase removal of Phase 3's dual-accept body-uid fallback.** Phase 6 QUAL-03 owns this. Phase 4 wiring Bearer on the mobile side makes the Bearer path the primary; body-uid fallback remains a defensive no-op until Phase 6 removes it.

</deferred>

---

*Phase: 04-mobile-plumbing-mobile*
*Context gathered: 2026-04-17*
