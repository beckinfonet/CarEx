# Phase 6: Affected-User UX + Security Review - Research

**Researched:** 2026-04-19
**Domain:** React Native 0.83 moderation UX surfaces + cross-repo merge-gate quality tooling (translation parity, MongoDB load test, security review artifact)
**Confidence:** HIGH on mobile patterns (all verified against in-repo code); MEDIUM on load-test tool choice (multiple valid paths, one recommended); HIGH on capability-key contract (grep-verified against backend repo)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Tinted background + 4 px left-accent visual treatment. Banner bg = severity color at ~10% opacity (UI-SPEC §Color resolves this to the existing 15% `COLORS.moderation.{severity}.bg` token verbatim); left border = severity color at full opacity, 4 px wide. Title + reason category on line 1, truncated note on line 2. Mirrors Phase 5 HistoryCard left-accent pattern.

**D-02:** Auto-grow to 2 lines of note with truncation + tap-to-expand. Default height fits title + reason category + up to 2 lines of the admin's verbatim note (ellipsis past that). Tapping the banner body toggles expanded state showing full note. Expanded state is per-session (no AsyncStorage persistence) and collapses on navigation away. Non-dismissable per AFF-01.

**D-03:** Stack `UserStatusBanner` above `OfflineNotice` when both apply. `App.tsx` wires `<UserStatusBanner />` immediately before `<OfflineNotice />` inside `NavigationContainer`. Both render independently; each takes its own vertical slice. No merged-banner logic.

**D-04:** Faded + disabled shape. Gated screen renders its original form beneath a semi-transparent dim layer with `pointerEvents="none"` on the underlying content. A centered overlay card floats with severity icon + title + body + CTA. Planning introduces a shared `GatedScreenWrapper` so the dim-layer + overlay-card pattern is reused verbatim across gated screens.

**D-05:** Capability-key-driven copy. `<FeatureGateOverlay capability="create_listing" />` — component looks up title/body/CTA copy from `translations.ts` keyed by `(capability, severity)`. Callers pass only the capability key; no per-screen prop strings. Capability keys must match the identifiers used in backend Phase 1 `STATUS_POLICY`.

**D-06:** Same overlay for all non-active severities, severity-aware copy. Overlay renders regardless of severity. Body copy adapts per severity. Banner owns the appeal CTA; overlay does NOT duplicate it.

**D-07:** Mailto prefill — Subject `CarEx moderation appeal — {uid}`; body includes `User ID`, `Reason category`, ISO `Suspended` timestamp (using `setAt`, not `updatedAt` — confirmed from `ModerationService.ts:118`), and a `[Your message here]` placeholder. Admin's verbatim note NOT included in the body.

**D-08:** No-mail-client fallback — UI-SPEC resolved this to **inline text in `Alert.alert`** (no clipboard library at all). Alert body includes the email address + UID; user tap-and-holds to copy on both iOS and Android native text-in-Alert surfaces. Translation keys `appealCopyEmail` / `appealCopied` / `appealCancel` are STRUCK per the UI-SPEC Clipboard Decision section.

### Claude's Discretion

- **QUAL-01 translation audit tooling** — jest-based parity test + optional grep script; split across two plans if needed.
- **QUAL-02 cross-repo load test split** — mirror Phase 5 D-16 pattern; plans `06-0a-PLAN.md` + `06-0b-PLAN.md` with `autonomous: false` frontmatter for backend repo.
- **QUAL-03 security review artifact format** — produce `06-SECURITY.md` with one section per ROADMAP 6-criteria item. Grep/test evidence per section. Informal self-review (no external auditor).
- **UserStatusBanner icons** — UI-SPEC resolved: `AlertTriangle` (feature_limited), `ShieldAlert` (blocked_with_review), `Ban` (permanently_banned).
- **Dim-layer opacity + color** — UI-SPEC resolved: `rgba(15, 17, 21, 0.7)`.
- **Expand-animation style** — UI-SPEC resolved: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`.

### Deferred Ideas (OUT OF SCOPE)

- In-app notification (push or modal) on sign-in after moderation action — deferred; banner-on-every-screen is the commitment.
- Capability-map surface beyond the 4 called-out screens — scope is the 4 ROADMAP-named surfaces.
- Deep-link guard for gated screens — use component-level gating, not navigation-level gating.
- Backend 05-0a / 05-0b landing — NOT Phase 6 scope; execution prerequisite tracked in STATE.md.
- Phase 5 `deferred-items.md` tech debt (App.test.tsx navigation-stack failure, 16 inline-styles warnings, `ModerationService.restoreRole` dead method) — Phase 6 security review MAY surface but does NOT block on them.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AFF-01 | `UserStatusBanner` above navigator, non-dismissable, severity-aware copy | §Standard Stack (LayoutAnimation), §Architecture Patterns (OfflineNotice mount pattern), §Code Examples (banner skeleton) |
| AFF-02 | Banner displays preset reason category + optional note verbatim | §Code Examples (reason-category localization), §Common Pitfalls (empty-note silent layout) |
| AFF-03 | Appeal CTA opens mailto prefilled with UID + reason for `blocked_with_review`; none for `permanently_banned` | §Code Examples (mailto assembly), §Common Pitfalls (canOpenURL unreliable on Android) |
| AFF-04 | `FeatureGateOverlay` on 4 gated screens; buyer features remain usable when only provider role gated | §Capability Contract Verification (BACKEND MISMATCH), §Architecture Patterns (GatedScreenWrapper) |
| QUAL-01 | Every new user-facing string exists in both RU + EN | §Standard Stack (jest parity test), §Code Examples (parity script + literal-scan grep) |
| QUAL-02 | 10k-user backend load test; P95 < 200 ms; `explain()` index use verified | §Standard Stack (k6 recommended), §Code Examples (full k6 + seeding + explain verification) |
| QUAL-03 | Security review artifact confirming 6 ROADMAP success criteria | §Code Examples (grep evidence map), §Architecture Patterns (SECURITY.md structure) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The following actionable directives from `./CLAUDE.md` apply to Phase 6. Planner MUST verify compliance:

- **Tech stack (mobile):** React Native 0.83 + TypeScript + axios + AsyncStorage. **Don't introduce new state-management or networking libs.** Extend existing `AuthService.ts` or split sensibly; do not rewrite wholesale.
- **Tech stack (backend):** Node/Express + Mongoose + MongoDB Atlas. New routes mount under `/api/admin/moderation/*`. Follow existing admin-auth pattern (`callerUid` param → `getAdminStatus` check; replaced in Phase 1 by `verifyIdToken`).
- **Auth enforcement:** Admin-only endpoints validate caller's admin status server-side on every request — never trust mobile-side `isAdmin`.
- **Data preservation:** Suspend/revoke never destroys order/audit history. Provider-profile hard-delete preserves orders via `providerSnapshot`.
- **Order safety:** In-flight orders touching a suspended provider PAUSE, not auto-cancel.
- **i18n:** All moderator + affected-user strings RU-first with EN parity.
- **Secrets hygiene:** No new hardcoded keys.
- **GSD enforcement:** File-changing tools only through GSD commands (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`).
- **Node >= 20** (verified: `node --version` = `v20.19.1`).

## Summary

Phase 6 is a two-half milestone-gate phase. **Half A** (AFF-01..04) is a purely presentational mobile UX addition — three new components (`UserStatusBanner`, `FeatureGateOverlay`, `GatedScreenWrapper`), zero new HTTP surface, zero new dependencies, all state sourced from `user.moderationStatus` already on the `AuthContext` user object. UI-SPEC §Copywriting / §Visuals / §Clipboard Decision already resolved most research-time questions. The **key execution risk** for Half A is a capability-key mismatch between UI-SPEC and backend Phase 1 `STATUS_POLICY` (detailed below in §Capability Contract Verification) that must be reconciled before Wave 2 components land.

**Half B** (QUAL-01..03) is three merge-gate checks with different confidence postures: QUAL-01 is mechanical (jest set-equality test); QUAL-02 is cross-repo load testing (requires backend Phase 5 05-0a/0b landing first, recommended tool is **k6**); QUAL-03 is an artifact-only security review mapping ROADMAP §Phase 6 criteria to grep/test evidence.

**Primary recommendation:** Structure Phase 6 as 7 waves per CONTEXT-suggested shape, with three hard reconciliations to do at planning time: (1) collapse UI-SPEC's `apply_as_provider` capability key to the correct backend identifier(s), (2) decide whether `ServiceApplicationScreen` needs TWO capability keys (broker vs. logistics) or a single new frontend-only alias, (3) decide whether the UI-SPEC's 4 capability keys even cover the backend's 7 (current answer: NO — `update_profile` + seller-role variants are uncovered, but they fall outside the 4 ROADMAP-named surfaces and are explicitly out of scope).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render user moderation banner | Mobile UI (React Native component) | Mobile Context (AuthContext) | Pure presentational read of `user.moderationStatus` already set by Phase 4 |
| Render feature-gate overlay | Mobile UI (React Native component) | Mobile Context (AuthContext) | Same — reads denormalized `restrictedFeatures` per Phase 1 D-12 |
| Open mailto appeal | Mobile UI (React Native `Linking`) | OS (mail app) | Native intent / URL-scheme dispatch; no backend call |
| Translation parity audit | Mobile Tests (jest) | CI | Static-file set-equality check; no runtime involvement |
| Load test (10k users, P95 < 200ms) | Backend Tests (k6 or equivalent) | Mobile (none) | Backend-only; harness lives in `backend-services/carEx-services` |
| `explain()` index verification | Backend Tests (mongosh / mongoose) | — | Backend-only; runs inline with load-test harness |
| Security review artifact | Docs (markdown file in `.planning/`) | Mobile + Backend (grep evidence) | Cross-cutting documentation; grep commands run across both repos |

**Implication for planning:** Half A is 100% mobile-repo. Half B mixes: QUAL-01 is mobile; QUAL-02 is backend; QUAL-03 is cross-cutting docs. Plans that touch backend must have `autonomous: false` frontmatter per the CONTEXT D-16 precedent set by Phase 5 plans 05-0a/05-0b.

## Standard Stack

### Core (all already installed — Phase 6 adds ZERO dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native` | 0.83.1 [VERIFIED: package.json:27] | `LayoutAnimation`, `Linking`, `Alert`, `View`, `Text`, `Modal`, `Pressable`, `UIManager` | RN stock primitives — no new deps required per CLAUDE.md constraint |
| `@react-navigation/native` | ^7.1.28 [VERIFIED: package.json:21] | `useFocusEffect` for banner expand-on-blur collapse (D-02) | Already wraps `NavigationContainer` at `App.tsx:85` |
| `react-native-safe-area-context` | ^5.6.2 [VERIFIED: package.json:32] | `useSafeAreaInsets` for banner top-padding (matches `OfflineNotice.tsx:20` precedent) | Already in provider stack |
| `lucide-react-native` | ^0.563.0 [VERIFIED: package.json:25] | `AlertTriangle`, `ShieldAlert`, `Ban` severity icons | Established icon lib; `AlertTriangle` already imported in `ModerationActionModal.tsx` |

### Load-testing (Half B — backend repo — recommended)

| Tool | Latest Version | Purpose | Why Recommended |
|------|---------|---------|--------------|
| **k6** | v1.3+ (Grafana) [CITED: k6.io/docs 2025] | 10k-user synthetic load against admin search + moderation history endpoints; P95 assertion via `thresholds`; Firebase idToken handled via pre-test `setup()` hook + per-VU `http.post` | Best fit for this workload: native `thresholds: { http_req_duration: ['p(95)<200'] }` means P95 < 200 ms is a **first-class pass/fail assertion**, not a post-hoc number to read off a report; Go binary (no npm bloat, no Node-version coupling to backend repo); JS test scripting already familiar to this team |
| autocannon | 8.0.0 [VERIFIED: `npm view autocannon version`] | Alternative — HTTP-focused Node lib | Simpler for "throughput + latency only" benchmarks; no multi-step scenarios; less idiomatic for "seed 10k users + then load-test with auth" |
| artillery | 2.0.30 [VERIFIED: `npm view artillery version`] | Alternative — Node-based YAML scenarios | Valid alternative; slightly heavier YAML setup than k6; no fundamental capability advantage for this workload |

**Recommendation: k6.** The P95 threshold is native pass/fail; the Firebase idToken flow maps cleanly to k6's `setup()` + per-VU header injection (see §Code Examples). k6 NOT currently installed locally (verified: `command -v k6` → not found); planner adds an install step (`brew install k6` on macOS; single-binary Linux install in CI). The npm package `k6@0.0.0` is a **stub for autocomplete only**, not the real tool. [VERIFIED: `npm view k6 description` = "Dummy package for autocompleting k6 scripts."]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| k6 | autocannon | autocannon is simpler for single-endpoint throughput but weaker for multi-step Firebase-auth flows; no native P95 assertion — caller must compare numbers manually |
| k6 | artillery | artillery YAML works; JS scripts also supported in artillery-engine-playwright style but less mature than k6's; no objective superiority for this workload |
| LayoutAnimation (banner expand) | `react-native-reanimated` (installed ^4.2.2) | Reanimated is heavier ceremony (worklet + shared-value plumbing) for a single height expand/collapse; UI-SPEC resolved to LayoutAnimation; Reanimated remains available if the LayoutAnimation path surfaces new-architecture issues (see Common Pitfalls) |
| `@react-native-clipboard/clipboard` | inline text in Alert | UI-SPEC Clipboard Decision: CLAUDE.md forbids new native deps; users tap-and-hold the Alert body to copy on both platforms — native Alert text is selectable on iOS and Android |

**Installation (Half A):** No `npm install` required. All primitives are in `react-native` core.

**Installation (Half B, QUAL-02 — backend repo only):**
```bash
# macOS dev
brew install k6
# CI / Linux
sudo gpg -k; sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Version verification (performed 2026-04-19):**
- `autocannon` latest = 8.0.0 [VERIFIED via `npm view autocannon version`]
- `artillery` latest = 2.0.30 [VERIFIED via `npm view artillery version`]
- `k6` latest = v1.x via Grafana (Go binary, not npm-tracked) [CITED: k6.io]

## Architecture Patterns

### System Architecture Diagram

```
                         user.moderationStatus (AuthContext)
                                    │
                    ┌───────────────┼───────────────────────┐
                    ▼                                        ▼
          UserStatusBanner                         FeatureGateOverlay
         (App.tsx global mount)               (per-screen via GatedScreenWrapper)
                    │                                        │
                    │                                        │
         ┌──────────┼──────────┐               ┌─────────────┼──────────────┐
         ▼          ▼          ▼               ▼             ▼              ▼
       Line 1    Line 2    Appeal CTA       Dim layer    Overlay card   CarDetails
     (title +   (note,    (mailto,         (pointer-    (icon, body,   (targeted
     reason-    expand)   severity-         events="   severity-aware   CTA-only
      chip)               specific          none")      copy)           gate via
                          visibility)                                   small modal)
                                │
                                ▼
                     Linking.openURL(mailto:...)
                        .catch(() => Alert.alert(...))
                     (no canOpenURL — CarEx convention)

                Half B (merge-gate quality checks):

  QUAL-01 ─▶  jest: translation parity test (RU keys set === EN keys set)
              + optional grep: scan new moderation files for literal Text children not wrapped in t.*
  QUAL-02 ─▶  k6 harness ─▶ POST /api/auth/signin (once in setup) ─▶ GET /api/admin/users/search
              ─▶ GET /api/admin/moderation/:uid/history ─▶ assert P95 < 200 ms
              ─▶ mongosh .explain('executionStats') ─▶ verify IXSCAN on 3 indexes
  QUAL-03 ─▶  06-SECURITY.md: 6 sections, each with grep/test evidence + PASS/FAIL verdict
```

### Recommended Project Structure

```
src/
├── components/
│   └── moderation/               # Half A — all 3 new components
│       ├── UserStatusBanner.tsx          (NEW)
│       ├── FeatureGateOverlay.tsx         (NEW)
│       ├── GatedScreenWrapper.tsx         (NEW)
│       ├── EmptyState.tsx                 (existing; NOT reused as overlay card — see UI-SPEC)
│       ├── SeverityBadge.tsx              (existing; not touched)
│       ├── ModerationActionModal.tsx      (existing; not touched)
│       ├── QuickActionSheet.tsx           (existing; not touched)
│       ├── TypedConfirmationModal.tsx     (existing; not touched)
│       └── __tests__/
│           ├── UserStatusBanner.test.tsx   (NEW — Wave 0 scaffold)
│           ├── FeatureGateOverlay.test.tsx (NEW — Wave 0 scaffold)
│           └── GatedScreenWrapper.test.tsx (NEW — Wave 0 scaffold)
├── screens/
│   ├── SellCarScreen.tsx                   (wrap root in GatedScreenWrapper)
│   ├── ServiceCartScreen.tsx               (wrap root in GatedScreenWrapper)
│   ├── ServiceApplicationScreen.tsx        (wrap root in GatedScreenWrapper)
│   └── CarDetailsScreen.tsx                (targeted CTA gate — NOT full-screen wrap)
├── constants/
│   └── translations.ts                      (add ~32 new keys per UI-SPEC revised count)
└── App.tsx                                  (mount <UserStatusBanner /> above <OfflineNotice />)

__tests__/
├── translation-parity.test.ts               (QUAL-01 — NEW)
└── ...existing...

scripts/
└── audit-moderation-literals.sh             (QUAL-01 optional — NEW)

.planning/phases/06-affected-user-ux-security-review/
├── 06-CONTEXT.md                            (existing)
├── 06-UI-SPEC.md                            (existing)
├── 06-RESEARCH.md                           (this file)
├── 06-0a-PLAN.md                            (NEW — backend k6 harness, autonomous: false)
├── 06-0b-PLAN.md                            (NEW — backend 10k user seeding, autonomous: false)
├── 06-SECURITY.md                           (NEW — QUAL-03 artifact)
└── ...plans...
```

### Pattern 1: Non-dismissable banner inside `NavigationContainer`

**What:** The `OfflineNotice` precedent establishes exactly how a non-dismissable banner mounts above `Stack.Navigator` inside `NavigationContainer`.

**When to use:** Any global banner that must respect safe-area insets and overlay every screen.

**Example:**
```tsx
// Source: VERIFIED from src/components/OfflineNotice.tsx (repo)
export const OfflineNotice = () => {
  const isConnected = useNetwork();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  if (isConnected) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, height: 44 + insets.top }]}>
      <WifiOff size={16} color="#FFF" />
      <Text style={styles.text}>{t.noInternet}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#b52424',
    width: Dimensions.get('window').width,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    zIndex: 9999,
  },
  // ...
});
```

The `UserStatusBanner` follows the same contract: `position: absolute`, `top: 0`, respects insets via `useSafeAreaInsets()`. Per UI-SPEC it uses `zIndex: 9998` so `OfflineNotice` (9999) stacks on top when both apply.

### Pattern 2: LayoutAnimation for expand/collapse

**What:** Native-driven layout transitions with zero timing logic. [CITED: reactnative.dev/docs/layoutanimation]

**When to use:** Any height/width transition where you want OS-native spring physics, automatic "Reduce Motion" respect, and zero state-timer management. UI-SPEC resolved D-02 to this approach.

**Example:**
```tsx
// Source: VERIFIED from reactnative.dev/docs/layoutanimation (RN 0.83 docs)
import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Module-level (runs once at App.tsx startup)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const handleExpand = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded(prev => !prev);
};
```

### Pattern 3: useFocusEffect for auto-collapse on navigation away

**What:** React Navigation's focus-aware effect hook. The cleanup function fires on blur (screen loses focus) OR on unmount. [CITED: reactnavigation.org/docs/use-focus-effect]

**When to use:** Per-session state that should reset as the user navigates to a different screen (e.g., `expanded` banner state resets when user leaves Home and goes to SellCar).

**Known caveat (MEDIUM confidence):** GitHub issue react-navigation/react-navigation#10190 reports that `native-stack`'s cleanup timing fires *after* the next screen initializes on `navigate()` (but immediately on `goBack()`). For Phase 6 this is ACCEPTABLE — "banner collapses just after navigation" is still user-visible correct behavior; the banner itself is non-dismissable and the expansion state is purely cosmetic. Planner should not invest in a workaround unless UAT specifically surfaces a flash.

**Example:**
```tsx
// Source: VERIFIED from reactnavigation.org/docs/use-focus-effect
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

useFocusEffect(
  useCallback(() => {
    // Effect runs on focus — intentionally empty; banner doesn't do anything on focus
    return () => {
      // Cleanup runs on blur — collapse the banner
      setExpanded(false);
    };
  }, [])
);
```

### Pattern 4: Linking.openURL without canOpenURL (CarEx convention)

**What:** Call `Linking.openURL(url)` unconditionally and handle failure in `.catch()`. `canOpenURL` is unreliable on Android (returns false for installed apps without `<queries>` manifest entries).

**When to use:** Any `mailto:` / `whatsapp://` / `tg://` / `tel:` link. Convention established across the codebase.

**Example:**
```tsx
// Source: VERIFIED pattern from src/screens/CarDetailsScreen.tsx:222-231 and ServiceDetailsScreen.tsx:57-68
Linking.openURL(`mailto:${address}?subject=${encSubject}&body=${encBody}`).catch(() => {
  Alert.alert(
    t.appealNoMailTitle,
    t.appealNoMailBody.replace('{uid}', user.localId),
    [{ text: t.appealOk, style: 'default' }]
  );
});
```

Grep-verified repo-wide: `Linking.openURL` count = 8 files; `Linking.canOpenURL` count = 0 files. The convention is LITERALLY never-use-canOpenURL in this codebase.

### Pattern 5: GatedScreenWrapper (component wrapper, not hook)

**What:** A single component that composes over each gated screen's existing body, renders dim-layer + overlay-card when gated, returns children verbatim when not gated.

**When to use:** Any screen that must render its original content beneath a non-interactive dim layer while an overlay card carries the moderation message. UI-SPEC resolved D-04 to this approach. Each gated screen change is a 1-import + 2-JSX-line diff.

**Example:** See UI-SPEC §Component 3 Implementation Sketch. Verbatim.

### Pattern 6: Translation parity via set-equality jest test

**What:** Compile-time-friendly, zero-dep parity check for RU/EN keys in `translations.ts`.

**When to use:** Anywhere translations are maintained in parallel object literals. Phase 5 already established the pattern informally; Phase 6 QUAL-01 formalizes it.

**Example:**
```ts
// Source: PROPOSED based on Phase 5 Plan 05-02 convention (verified: 459=459 keys currently)
// File: __tests__/translation-parity.test.ts
import { TRANSLATIONS } from '../src/constants/translations';

describe('Translation parity (QUAL-01)', () => {
  const ruKeys = Object.keys(TRANSLATIONS.RU).sort();
  const enKeys = Object.keys(TRANSLATIONS.EN).sort();

  test('RU and EN key sets are identical', () => {
    expect(ruKeys).toEqual(enKeys);
  });

  test('every value is a non-empty string (no TODOs)', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries(TRANSLATIONS[lang])) {
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
        expect(val).not.toMatch(/^(TODO|FIXME|TRANSLATE)/i);
      }
    }
  });
});
```

### Anti-Patterns to Avoid

- **Per-screen dim-layer code duplication:** Do NOT copy the dim-layer + `pointerEvents="none"` logic into each gated screen. Use `GatedScreenWrapper` as the single integration seam. UI-SPEC §Component 3 LOCKED this decision; it is non-negotiable.
- **Reusing `EmptyState` as the overlay card:** UI-SPEC §Component 2 EXPLICITLY REJECTED this. `EmptyState` uses `flex: 1` (stretches to fill parent — intended for empty list states); the overlay needs a centered fixed-width card inside a full-screen dim layer. Do not refactor `EmptyState` for dual-mode use; write `FeatureGateOverlay` from scratch and copy the icon-title-body visual rhythm.
- **`canOpenURL` for mailto:** Unreliable on Android. See CarEx convention above (grep = 0 callers of `canOpenURL` repo-wide).
- **Passing per-screen copy strings as props to `FeatureGateOverlay`:** D-05 locks capability-key-driven copy. No `<FeatureGateOverlay title="..." body="..." />`.
- **Duplicate mailto CTA inside overlay card:** D-06 locks: banner owns the appeal CTA; overlay refers the user to the banner. No CTA duplication.
- **Clipboard package:** D-08 + UI-SPEC Clipboard Decision rule out any `@react-native-clipboard/clipboard` install.
- **Echoing admin's verbatim note into the mailto body:** D-07 excludes it; the note is already visible in the banner.
- **Adding moderation HTTP to `AuthService.ts`:** MOB-01 invariant from Phase 4. Phase 6 does NOT add new HTTP surface, so this should naturally hold. Grep-gate: `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` must remain `0` after Phase 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated height transition on banner expand | Custom `Animated.timing` state machine | `LayoutAnimation.configureNext` | Single-call API, native driver, auto-respects OS "Reduce Motion", no timer cleanup bugs |
| Load-test a 10k-user workload from scratch | Custom Node script with `axios.all` + p-limit | k6 | k6 handles VUs, ramp-up, P95 thresholds, Firebase auth setup hook, HTML report — DIY script would be 300+ lines of wheel-reinvention |
| RU/EN parity check | Hand-written shell script that diffs extracted keys | Jest test with `Object.keys()` set-equality | Jest gives you watch mode + CI-integrated pass/fail + assertion messages; shell script is less robust on shell differences |
| Secure-text copy fallback | `@react-native-clipboard/clipboard` pod install | Inline text in `Alert.alert` (UI-SPEC Clipboard Decision) | CLAUDE.md forbids new native deps; Alert text is selectable on both platforms; adding the package requires pod install + gradle refresh on a release-prep codebase |
| Find-and-wrap-the-top-level-View pattern | Per-screen custom integration | `GatedScreenWrapper` shared component | Shared wrapper keeps each gated screen's diff to 2 JSX lines; hook alternative would duplicate dim-layer logic 4× |
| Navigation-aware state reset (banner expand) | `navigation.addListener('blur', ...)` in useEffect | `useFocusEffect` from `@react-navigation/native` | Correctly handles both blur AND unmount; stable API since RN5; no manual subscriber cleanup |

**Key insight:** Phase 6 is deliberately a "thin" phase — it exists to surface to users what the backend already enforces. Every problem that looks like it needs custom code (animation, clipboard, load-test) has an in-ecosystem answer that this codebase already prefers. Resist the temptation to build; most of the decisions have already been made in CONTEXT + UI-SPEC.

## Capability Contract Verification (CRITICAL FINDING)

**Claim:** UI-SPEC §Copywriting Contract uses 4 capability keys: `create_listing`, `create_order`, `apply_as_provider`, `contact_seller`.

**Reality (grep-verified from backend repo `src/moderation/capabilities.js`):** Backend `STATUS_POLICY.feature_limited.capabilities.blocked` is a **7-element array**:

```js
// Source: VERIFIED literal read of /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/capabilities.js:6-14
[
  'create_listing',
  'create_order',
  'contact_seller',
  'request_seller_role',
  'request_broker_role',
  'request_logistics_role',
  'update_profile',
]
```

**The mismatch:**

| UI-SPEC capability key | Backend STATUS_POLICY match | Verdict |
|------------------------|------------------------------|---------|
| `create_listing` | `create_listing` | ✅ MATCHES |
| `create_order` | `create_order` | ✅ MATCHES |
| `contact_seller` | `contact_seller` | ✅ MATCHES |
| `apply_as_provider` | *(NO MATCH — backend has 3 keys: `request_seller_role`, `request_broker_role`, `request_logistics_role`)* | ❌ DOES NOT EXIST IN BACKEND |

**Planning implication:** Before Wave 2 lands, the planner MUST resolve one of three paths:

1. **(Recommended) Frontend-only alias.** `apply_as_provider` becomes a FRONTEND-ONLY logical capability that maps on the mobile side to "any of `request_broker_role` or `request_logistics_role` is in `user.moderationStatus.restrictedFeatures`". The `FeatureGateOverlay` API stays as UI-SPEC documents (`capability="apply_as_provider"`), but internally resolves to a predicate over the three backend keys. Frontend-only, no backend change needed. Aligns with the fact that `ServiceApplicationScreen` serves both roles via `route.params.type`.

2. **Use the specific backend key per route.** `ServiceApplicationScreen` passes `capability="request_broker_role"` or `capability="request_logistics_role"` based on `route.params.type`. Requires adding TWO new translation-key groups instead of one. More accurate but more copy to maintain.

3. **Add `apply_as_provider` to backend STATUS_POLICY.** Rejected — backend capabilities are frozen by Phase 1; Phase 6 is UX/gate work, not a schema extension. Would also break the Phase 1 parity test that asserts exact 7-token feature_limited array.

**Claude's recommendation:** Path 1. The capability key is a FRONTEND concept that drives copy lookup; backend enforcement is via `restrictedFeatures` array membership. Map UI-SPEC capability → predicate, not UI-SPEC capability → backend key. Planner locks this choice at plan-time; UI-SPEC translation keys stay unchanged.

**Additional uncovered backend capabilities:** `update_profile` and `request_seller_role` are in the backend `feature_limited` blocked list but have NO mobile gated screen in the ROADMAP §Phase 6 scope. This is acceptable — the ROADMAP only names 4 surfaces, and the backend enforces the actual denial regardless of whether the mobile shows a helpful overlay. `update_profile` + `request_seller_role` denials will surface as a raw `403 account_suspended` → banner update via the Phase 4 interceptor. Seller-role is approved via an alert/modal flow, not a dedicated screen; profile updates happen in `ProfileScreen` which is not in the gated-screens list. **Out of scope per ROADMAP.**

[VERIFIED: grep across `.planning/phases/01-schema-security-baseline-backend/01-04-*` + literal read of backend `src/moderation/capabilities.js`]

## Runtime State Inventory

*Not applicable — Phase 6 does not rename, rebrand, refactor, or migrate any existing identifiers. It adds new components, new translation keys, and new tests, but does not modify any stored data, OS-registered state, or environment names. Section intentionally abbreviated.*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema or data changes | — |
| Live service config | None — no external service config | — |
| OS-registered state | None | — |
| Secrets/env vars | No new secrets introduced (QUAL-03 gate verifies this) | — |
| Build artifacts | None — no pyproject / package rename | — |

## Common Pitfalls

### Pitfall 1: UIManager.setLayoutAnimationEnabledExperimental no-op on RN New Architecture

**What goes wrong:** On React Native's New Architecture (Fabric enabled), `UIManager.setLayoutAnimationEnabledExperimental` is a silent no-op that prints a warning. The documented-for-Android enable line is effectively unnecessary there — but calling it remains safe. [CITED: GitHub issue expo/expo#38333, 2025]

**Why it happens:** LayoutAnimation migrated to the new architecture's native side; the Android-specific enable flag lost meaning.

**How to avoid:** Still call it at App.tsx startup inside `if (Platform.OS === 'android')` — it's a no-op on new arch, a necessary enable on old arch. CarEx `metro.config.js` + no explicit `RCT_NEW_ARCH_ENABLED` flag means CarEx is on **OLD ARCH as of 2026-04-19** (verified by no `newArchEnabled=true` in `android/gradle.properties` — planner must confirm if uncertain). Keep the enable call; document as a conditional "no-op on new arch" comment.

**Warning signs:** Banner height doesn't animate on Android; check if the enable line was removed or placed AFTER the first render.

### Pitfall 2: LayoutAnimation configureNext must be called IMMEDIATELY before setState

**What goes wrong:** Calling `LayoutAnimation.configureNext(...)` earlier in a handler, then doing async work, then calling `setState` — the configuration is consumed by the FIRST next layout, not the one you intended.

**Why it happens:** The call is one-shot; whatever layout pass happens next consumes it.

**How to avoid:** Call `LayoutAnimation.configureNext(...)` on the line immediately preceding `setExpanded(...)`. No async boundary between them.

**Warning signs:** Expand/collapse is abrupt on first tap; subsequent taps animate.

### Pitfall 3: useFocusEffect cleanup fires AFTER next screen initializes on native-stack navigate()

**What goes wrong:** When navigating via `navigation.navigate('OtherScreen')`, the cleanup function of `useFocusEffect` on the current screen fires AFTER the next screen's initial render — opposite of what you'd expect from unmount timing. [CITED: GitHub issue react-navigation/react-navigation#10190]

**Why it happens:** Native-stack optimization; blur fires asynchronously.

**How to avoid for Phase 6:** The symptom is "banner stays expanded for a brief flash after user navigates." Acceptable for D-02's stated goal (collapse on navigation away). Do not invest in a workaround unless UAT surfaces a visible flash complaint. If it does surface, the fix is to listen to `navigation.addListener('beforeRemove', cleanup)` instead.

**Warning signs:** User reports "banner stays expanded for a split second on nav." File as UAT follow-up, not as a Wave 0 concern.

### Pitfall 4: canOpenURL false-negative on Android for mailto:

**What goes wrong:** `Linking.canOpenURL('mailto:...')` returns `false` on many Android devices even when a mail app is installed, because Android 11+ requires `<queries>` manifest entries declaring the URL schemes the app intends to check. [CITED: CarEx internal convention at `CarDetailsScreen.tsx:220-224`]

**Why it happens:** Android 11 package visibility changes; the app's `AndroidManifest.xml` does NOT declare a `<queries>` block for mailto.

**How to avoid:** Skip `canOpenURL` entirely. Call `Linking.openURL(url).catch(fallback)` — same pattern used throughout the codebase for WhatsApp / Telegram / tel. UI-SPEC §Appeal CTA behavior already resolves this.

**Warning signs:** On Android, tapping Appeal shows the no-mail-client Alert even though Gmail is installed.

### Pitfall 5: ServiceApplicationScreen handles BOTH broker AND logistics

**What goes wrong:** Planner treats `ServiceApplicationScreen` as a single-capability gated surface and picks ONE capability key. But `ServiceApplicationScreen` dispatches based on `route.params.type` where type can be `'broker'` or `'logistics'` (verified: line 36-46 of `src/screens/ServiceApplicationScreen.tsx`). A user who is feature-limited on broker but not logistics should see a different gate — or MORE CORRECTLY, the frontend-alias approach (see Capability Contract Verification) should resolve this transparently.

**Why it happens:** Screen-to-capability mapping LOOKS 1:1; it is actually 1:2 or 1:many.

**How to avoid:** Follow the frontend-alias approach. `FeatureGateOverlay capability="apply_as_provider"` checks membership of EITHER `request_broker_role` OR `request_logistics_role` in `restrictedFeatures`. If backend only gated one but not the other, gate-copy still shows; this is overly-restrictive but safe. If planner opts for path 2 (per-role capability), the screen passes `capability="request_broker_role"` or `"request_logistics_role"` based on `route.params.type` — more accurate but doubles translation-key count.

**Warning signs:** Tests reveal `restrictedFeatures` includes `request_broker_role` but not `request_logistics_role` — does `<FeatureGateOverlay capability="apply_as_provider" />` correctly detect this? It should, via the alias predicate.

### Pitfall 6: `all_writes` sentinel in restrictedFeatures for blocked_with_review/permanently_banned

**What goes wrong:** Phase 1 DATA-01/D-12: `restrictedFeatures` for `blocked_with_review` and `permanently_banned` is NOT a list of specific capabilities — it's the single-element array `['all_writes']`. Mobile code that does `restrictedFeatures.includes('create_listing')` correctly returns `false` even though the feature IS blocked.

**Why it happens:** The sentinel is a compact representation that delegates to the severity state, not to per-capability membership.

**How to avoid:** `GatedScreenWrapper`'s predicate must account for BOTH paths:
```tsx
const isGated =
  state !== 'active' &&
  (restricted.includes('all_writes') ||  // sentinel path (blocked_with_review / permanently_banned)
   restricted.includes(capability));      // specific-capability path (feature_limited)
```
UI-SPEC §Component 3 Implementation Sketch uses only the `restricted.includes(capability)` path — WHICH IS A BUG for `blocked_with_review` / `permanently_banned`. Planner MUST fix this at implementation time. The UI-SPEC code was written assuming a pre-resolved list; the reality is the sentinel exists. [VERIFIED: backend `capabilities.js:57` `return ['all_writes']` for both severities]

**Warning signs:** A user with `state: 'blocked_with_review'` navigates to `SellCarScreen` and sees the normal form with no overlay. Fix: flip the predicate to also check `'all_writes'` sentinel OR simply check `state !== 'active'` as the gate (since for these two severities the ENTIRE screen is gated anyway).

### Pitfall 7: Translation banner keys in backend STATUS_POLICY don't match mobile translation keys

**What goes wrong:** Backend `STATUS_POLICY[state].banner.titleKey` uses a namespaced key convention (`'moderation.feature_limited.title'`) but mobile `translations.ts` uses flat keys (`moderationFeatureLimited`). Mobile does NOT consume the backend `banner.titleKey` directly — it constructs its own lookup from severity.

**Why it happens:** Two separate systems. Backend ships capability map including *potential* banner message pointers. Mobile ignores them and owns its own copy.

**How to avoid:** This is not a bug; it's an architectural fact. Don't wire mobile banner rendering to read `user.moderationStatus.bannerTitleKey` from the backend response (which would be a namespaced-key soup problem). Mobile owns its own copy via `bannerCopy.{severity}` translation keys per UI-SPEC.

**Warning signs:** Someone proposes "just pass the banner title from backend to mobile" — reject; the mobile-side translation table is authoritative for display copy.

### Pitfall 8: UI-SPEC claims 459+32=491 translation keys, but parity assertion verifies 459=459 BEFORE Phase 6

**What goes wrong:** UI-SPEC §QUAL-01 writes "Phase 5 Plan 05-02 established this pattern at 455=455 keys — Phase 6 extends by 32 to 487=487". Actual verified count is 459=459 (not 455). Phase 6 will raise that by however-many new keys land, but the BASELINE for QUAL-01's `expect(ruKeys.length).toEqual(487)` would be wrong.

**Why it happens:** UI-SPEC was written against an earlier snapshot.

**How to avoid:** Do NOT hardcode the expected total in the parity test. Use `expect(ruKeys).toEqual(enKeys)` (set equality of the actual keys) — robust against any key count. [VERIFIED: current count 459 via `awk /^  RU: {/,/^  }/ ...` on `translations.ts`]

**Warning signs:** Parity test fails with `Expected length 487 but got 491`.

### Pitfall 9: k6 Firebase idToken minting inside the test loop (don't)

**What goes wrong:** A naive k6 test does `http.post(authUrl, ...)` on every VU's default function, minting a new idToken per iteration. This (a) saturates Firebase Identity Toolkit rate limits, (b) measures identity-toolkit latency, not carEx backend latency, (c) invalidates P95 < 200 ms assertion because identity RTT dominates.

**Why it happens:** Copy-paste k6 examples often show per-iteration auth.

**How to avoid:** Use k6's `setup()` function to mint ONE idToken shared across all VUs, or pre-seed 10k (user, token) pairs in a fixture file. Per-VU mint happens exactly once at VU startup, not per iteration.

**Warning signs:** Firebase returns 429s mid-test; P95 is 800 ms dominated by `identitytoolkit.googleapis.com` roundtrips.

### Pitfall 10: explain() executionStats vs queryPlanner — use executionStats for index verification

**What goes wrong:** `db.collection.find(...).explain()` with default (`'queryPlanner'`) shows the PLAN but not the RUNTIME. For asserting "actually used the index" and "0 collection scans", you need `'executionStats'` verbosity. [CITED: mongodb.com/docs/manual/reference/explain-results/]

**Why it happens:** queryPlanner returns winning plan only; executionStats runs the query and captures `executionStages.stage` + `totalKeysExamined` + `totalDocsExamined`.

**How to avoid:** Use `db.users.find({...}).explain('executionStats')` and assert:
- `executionStats.executionStages.stage` is `IXSCAN` (or an IXSCAN inside a FETCH)
- `executionStats.totalDocsExamined / executionStats.nReturned` is bounded (ideally `1` — no over-fetching)
- `executionStats.executionSuccess` === `true`

### Pitfall 11: Banner reads `user.moderationStatus.updatedAt` — field is actually `setAt`

**What goes wrong:** CONTEXT D-07 references `user.moderationStatus.updatedAt`. UI-SPEC corrected this to `setAt` per `ModerationService.ts:118` but didn't strike the CONTEXT mention. Planner reading CONTEXT first may wire to the wrong field.

**Why it happens:** Schema field drift across contexts.

**How to avoid:** Use `user.moderationStatus.setAt` (the actual field). UI-SPEC is authoritative over CONTEXT where they disagree on this point. [VERIFIED: ModerationService.ts:118 shows `setAt?: string;`]

**Warning signs:** Mailto body shows `Suspended: undefined`.

### Pitfall 12: Jest `@react-native-clipboard/clipboard` mock (not applicable — we don't install it)

*N/A — UI-SPEC Clipboard Decision drops clipboard entirely. Listed only as a preemptive "don't add this pitfall by adding the package."*

## Code Examples

Verified patterns from official sources and in-repo convention:

### Banner skeleton (AFF-01, AFF-02, AFF-03)

```tsx
// File: src/components/moderation/UserStatusBanner.tsx (NEW)
// Source: Adapted from UI-SPEC §Component 1 + OfflineNotice.tsx (repo) precedent
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TouchableOpacity, LayoutAnimation, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

const SEVERITY_ICON = {
  feature_limited: AlertTriangle,
  blocked_with_review: ShieldAlert,
  permanently_banned: Ban,
} as const;

export const UserStatusBanner: React.FC<{ testID?: string }> = ({ testID = 'user-status-banner' }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  const state = user?.moderationStatus?.state as keyof typeof SEVERITY_ICON | 'active' | undefined;

  useFocusEffect(useCallback(() => () => setExpanded(false), []));

  if (!state || state === 'active') return null;

  const palette = COLORS.moderation[
    state === 'feature_limited' ? 'featureLimited'
    : state === 'blocked_with_review' ? 'blockedReview'
    : 'permaBanned'
  ];
  const Icon = SEVERITY_ICON[state];
  const note = user.moderationStatus.note as string | undefined;
  const reasonLabel = localizedReasonLabel(user.moderationStatus.reasonCategory, t);
  const severityTitle = t[`bannerTitle_${state}` as keyof typeof t] as string;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  const handleAppeal = () => {
    const subject = `CarEx moderation appeal — ${user.localId}`;
    const body = [
      `User ID: ${user.localId}`,
      `Reason category: ${reasonLabel}`,
      `Suspended: ${user.moderationStatus.setAt ?? ''}`,
      '',
      t.appealPlaceholder,
    ].join('\n');
    const url = `mailto:support@carexmarket.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t.appealNoMailTitle,
        t.appealNoMailBody.replace('{uid}', user.localId),
        [{ text: t.appealOk, style: 'default' }]
      );
    });
  };

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9998,
        backgroundColor: palette.bg,
        paddingTop: insets.top + SIZES.spacingMd,
        paddingBottom: SIZES.spacingMd,
        paddingLeft: SIZES.spacingMd + 4,
        paddingRight: SIZES.spacingMd,
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.border }} />
      {/* Line 1 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.spacingSm }}>
        <Icon size={16} color={palette.fg} />
        <Text style={[TYPOGRAPHY.bodyStrong, { color: palette.fg, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
          {severityTitle} — {reasonLabel}
        </Text>
      </View>
      {/* Line 2: note (tappable to expand) */}
      {note ? (
        <Pressable testID={`${testID}-note`} onPress={toggleExpand} hitSlop={8}>
          <Text
            style={[TYPOGRAPHY.body, { color: COLORS.textPrimary, marginTop: SIZES.spacingXs }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {note}
          </Text>
        </Pressable>
      ) : null}
      {/* Appeal CTA (only for blocked_with_review) */}
      {state === 'blocked_with_review' ? (
        <View style={{ marginTop: SIZES.spacingSm, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            testID={`${testID}-appeal`}
            onPress={handleAppeal}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={{
              backgroundColor: COLORS.accent, borderRadius: SIZES.radiusSm,
              paddingHorizontal: SIZES.spacingMd, paddingVertical: SIZES.spacingSm,
              minHeight: SIZES.minTapTarget, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={[TYPOGRAPHY.bodyStrong, { color: '#FFFFFF' }]}>{t.appealCta}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

function localizedReasonLabel(cat: string | null | undefined, t: any): string {
  switch (cat) {
    case 'spam': return t.reasonSpam;
    case 'policy_violation': return t.reasonPolicyViolation;
    case 'fraud': return t.reasonFraud;
    case 'other':
    default: return t.reasonOther;
  }
}
```

### Android LayoutAnimation enable at App.tsx startup

```tsx
// File: App.tsx (add at module top-level before default export)
// Source: VERIFIED — reactnative.dev/docs/layoutanimation
import { Platform, UIManager } from 'react-native';

// LayoutAnimation on Android requires this enable (old arch only; no-op on new arch).
// Used by UserStatusBanner for expand/collapse transitions.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
```

### GatedScreenWrapper with sentinel-aware predicate

```tsx
// File: src/components/moderation/GatedScreenWrapper.tsx (NEW)
// Source: UI-SPEC §Component 3 + Pitfall 6 all_writes sentinel fix
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { FeatureGateOverlay } from './FeatureGateOverlay';

export type CapabilityKey = 'create_listing' | 'create_order' | 'apply_as_provider' | 'contact_seller';

// Frontend alias: `apply_as_provider` resolves to EITHER backend key.
const CAPABILITY_ALIASES: Record<CapabilityKey, string[]> = {
  create_listing: ['create_listing'],
  create_order: ['create_order'],
  contact_seller: ['contact_seller'],
  apply_as_provider: ['request_broker_role', 'request_logistics_role'],
};

interface Props {
  capability: CapabilityKey;
  children: React.ReactNode;
}

export const GatedScreenWrapper: React.FC<Props> = ({ capability, children }) => {
  const { user } = useAuth();
  const state = user?.moderationStatus?.state ?? 'active';
  const restricted: string[] = user?.moderationStatus?.restrictedFeatures ?? [];

  const backendKeys = CAPABILITY_ALIASES[capability];
  const sentinelGated = restricted.includes('all_writes');
  const keyGated = backendKeys.some(k => restricted.includes(k));
  const isGated = state !== 'active' && (sentinelGated || keyGated);

  if (!isGated) return <>{children}</>;

  return (
    <View style={{ flex: 1 }} testID={`gated-screen-wrapper-${capability}`}>
      <View style={{ flex: 1 }} pointerEvents="none">{children}</View>
      <FeatureGateOverlay capability={capability} />
    </View>
  );
};
```

### Translation parity test (QUAL-01 primary)

```ts
// File: __tests__/translation-parity.test.ts (NEW)
// Source: PROPOSED — mirrors Phase 5 Plan 05-02 informal pattern
import { TRANSLATIONS } from '../src/constants/translations';

describe('QUAL-01: translation parity', () => {
  const ru = Object.keys(TRANSLATIONS.RU).sort();
  const en = Object.keys(TRANSLATIONS.EN).sort();

  test('RU and EN key sets are identical', () => {
    const onlyInRu = ru.filter(k => !en.includes(k));
    const onlyInEn = en.filter(k => !ru.includes(k));
    expect({ onlyInRu, onlyInEn }).toEqual({ onlyInRu: [], onlyInEn: [] });
  });

  test('every value is a non-empty string', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries(TRANSLATIONS[lang])) {
        expect(typeof val).toBe('string');
        expect((val as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('no untranslated placeholders (TODO/FIXME/TRANSLATE)', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries(TRANSLATIONS[lang])) {
        expect(val).not.toMatch(/^(TODO|FIXME|TRANSLATE)[:\s]/i);
      }
    }
  });
});
```

### Literal-string scanner (QUAL-01 optional)

```bash
#!/usr/bin/env bash
# File: scripts/audit-moderation-literals.sh (NEW)
# Purpose: scan new moderation files for user-facing Text literals not wrapped in t.*
# Exit 0 if clean; exit 1 with offending lines if any found.

set -euo pipefail

FILES=(
  src/components/moderation/UserStatusBanner.tsx
  src/components/moderation/FeatureGateOverlay.tsx
  src/components/moderation/GatedScreenWrapper.tsx
)

# Match <Text>Literal</Text> or <Text ...>Literal</Text> where literal is a Cyrillic/Latin word
# but NOT when the child is {t.keyName} or {someVar}
PATTERN='<Text[^>]*>[^{<][^<]*[A-Za-zА-Яа-я][^<]*</Text>'

found=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  if grep -nE "$PATTERN" "$f"; then
    echo "❌ Hardcoded literal found in $f — wrap in {t.someKey}"
    found=1
  fi
done

if [[ $found -eq 0 ]]; then
  echo "✅ No hardcoded literals in new moderation files"
fi

exit $found
```

### k6 load-test harness (QUAL-02 — backend repo plan 06-0a)

```js
// File: backend-services/carEx-services/scripts/load-test/admin-search.k6.js (NEW)
// Source: Adapted from k6.io/docs + Pitfall 9 (idToken minted once in setup)
// Run: k6 run --vus 200 --duration 60s scripts/load-test/admin-search.k6.js
import http from 'k6/http';
import { check } from 'k6';

// ---- CONFIG ----
const API_URL = __ENV.API_URL || 'http://localhost:5001';
const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY; // required
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '40s', target: 200 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // ROADMAP §Phase 6 success criterion 5: P95 < 200 ms
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

// Runs ONCE. Output is passed to every VU via the default fn's argument.
export function setup() {
  const res = http.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) throw new Error(`Admin sign-in failed: ${res.status} ${res.body}`);
  return { idToken: JSON.parse(res.body).idToken };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.idToken}` };

  // Endpoint 1: admin search (seed generates 10k users; query hits indexed moderationStatus.state)
  const search = http.get(`${API_URL}/api/admin/users/search?q=user&state=feature_limited&limit=20`, { headers });
  check(search, {
    'search 200': (r) => r.status === 200,
    'search < 200ms': (r) => r.timings.duration < 200,
  });

  // Endpoint 2: moderation history for one user (compound index targetUid+createdAt)
  const targetUid = JSON.parse(search.body).users[0]?.localId;
  if (targetUid) {
    const history = http.get(`${API_URL}/api/admin/moderation/${targetUid}/history?limit=20`, { headers });
    check(history, {
      'history 200': (r) => r.status === 200,
      'history < 200ms': (r) => r.timings.duration < 200,
    });
  }
}
```

### Seed script for 10k synthetic users (QUAL-02 — backend repo plan 06-0b)

```js
// File: backend-services/carEx-services/scripts/seed-moderation-load.js (NEW)
// Source: Proposed; mirrors existing scripts/migrate-moderation.js pattern
const mongoose = require('mongoose');
require('dotenv').config();
require('../src/models/User');
const User = mongoose.model('User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const BATCH = 1000;
  const TOTAL = 10000;
  const STATES = ['active', 'feature_limited', 'blocked_with_review', 'permanently_banned'];

  console.log(`Seeding ${TOTAL} synthetic users...`);
  for (let i = 0; i < TOTAL; i += BATCH) {
    const docs = Array.from({ length: BATCH }, (_, j) => {
      const idx = i + j;
      const state = STATES[idx % 4];
      return {
        localId: `loadtest_${idx}`,
        email: `loadtest_${idx}@carex.test`,
        firstName: `Load${idx}`,
        lastName: `Test`,
        moderationStatus: {
          state,
          reasonCategory: state === 'active' ? null : 'spam',
          note: state === 'active' ? null : 'Synthetic load-test record',
          restrictedFeatures: state === 'active' ? [] : (state === 'feature_limited' ? ['create_listing'] : ['all_writes']),
          setByAdminUid: state === 'active' ? null : 'loadtest_admin',
          setAt: state === 'active' ? null : new Date(),
        },
      };
    });
    await User.insertMany(docs, { ordered: false });
    console.log(`  Inserted ${i + BATCH}/${TOTAL}`);
  }
  console.log('Seed complete.');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
```

### Mongo explain() verification (QUAL-02 — inline after k6 run)

```bash
# File: backend-services/carEx-services/scripts/load-test/verify-indexes.sh (NEW)
# Run after k6 passes to confirm index use. Exit 0 if IXSCAN, exit 1 if COLLSCAN.
set -euo pipefail
MONGO_URI="${MONGODB_URI:?set MONGODB_URI}"

# Expect stage: IXSCAN on moderationStatus.state
mongosh "$MONGO_URI" --quiet --eval '
const r1 = db.users.find({ "moderationStatus.state": "feature_limited" }).limit(20).explain("executionStats");
const stage1 = r1.queryPlanner.winningPlan.inputStage?.stage || r1.queryPlanner.winningPlan.stage;
if (!["IXSCAN","FETCH"].includes(stage1)) throw "users query used COLLSCAN: " + stage1;

const r2 = db.moderationactions.find({ targetUid: "loadtest_0" }).sort({ createdAt: -1 }).limit(20).explain("executionStats");
const stage2 = r2.queryPlanner.winningPlan.inputStage?.stage || r2.queryPlanner.winningPlan.stage;
if (!["IXSCAN","FETCH"].includes(stage2)) throw "moderationactions query used COLLSCAN: " + stage2;

const r3 = db.moderationactions.find({ adminUid: "loadtest_admin" }).sort({ createdAt: -1 }).limit(20).explain("executionStats");
const stage3 = r3.queryPlanner.winningPlan.inputStage?.stage || r3.queryPlanner.winningPlan.stage;
if (!["IXSCAN","FETCH"].includes(stage3)) throw "adminUid query used COLLSCAN: " + stage3;

print("OK: all 3 indexes used (IXSCAN confirmed)");
'
```

### Security review artifact template (QUAL-03)

```markdown
# Phase 6 Security Review (QUAL-03)

**Reviewed:** 2026-04-NN
**Reviewer:** Claude (self-review)
**Target:** Admin moderation milestone — backend + mobile pre-merge

## Criterion 1: verifyIdToken runs on every admin route (SEC-01)

**Verification:**
```
cd backend-services/carEx-services
grep -rn "router\." src/moderation/ src/admin/ 2>/dev/null | while read line; do
  # Every admin route should be preceded by verifyIdToken + requireAdmin middleware
  ...
done
```

**Evidence:** [list routes + middleware chain]
**Verdict:** ✅ PASS / ❌ FAIL

## Criterion 2: No callerUid body param trusted for authorization

**Verification:**
```
grep -rn "req.body.callerUid\|body\.callerUid" backend-services/carEx-services/src/
# Must return 0 hits in new Phase 1+ routes
```

**Verdict:** ✅ PASS / ❌ FAIL

## Criterion 3: Suspend + confirm-booking are transactional

**Verification:** review `session.withTransaction(...)` in suspend + confirm-booking services.
**Verdict:** ✅ PASS / ❌ FAIL

## Criterion 4: ModerationAction rejects updates/deletes at application layer

**Verification:** Phase 1 Plan 01-01 append-only test.
**Verdict:** ✅ PASS / ❌ FAIL

## Criterion 5: No new hardcoded secrets

**Verification:**
```
git diff main...HEAD -- '**/*.{ts,tsx,js}' | grep -E "(sk_|pk_live|AIza|AKIA|-----BEGIN)"
# Must return 0 hits.
```

**Verdict:** ✅ PASS / ❌ FAIL

## Criterion 6: [reserved for the 6th ROADMAP item]

...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Animated.timing` for height | `LayoutAnimation.configureNext` | Always preferred for layout transitions | Single-call API; better OS integration |
| `canOpenURL` then `openURL` | `openURL().catch(fallback)` | CarEx convention + Android 11+ reality | Avoids false-negatives; matches existing codebase |
| Per-iteration auth in k6 | `setup()` hook minted once | Always — foundational k6 pattern | Avoids rate limits + spurious latency |
| npm-based k6 install | Go binary via `brew install k6` | Always — `k6` on npm is a stub [VERIFIED] | Correct tool, not autocomplete package |
| New Architecture `setLayoutAnimationEnabledExperimental` | Still call it (no-op) | RN 0.71+ New Arch | Safe; no-ops quietly; maintains old-arch compat |

**Deprecated/outdated:**
- Legacy `Clipboard` from `react-native` — **confirmed removed** per UI-SPEC Clipboard Decision. Do not import.
- `canOpenURL` for URL-scheme checks on Android — avoid; use `.catch(fallback)` pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CarEx is on RN old architecture as of 2026-04-19 | Pitfalls §1 | LOW — the `UIManager.setLayoutAnimationEnabledExperimental` call is a no-op on new arch; wrong assumption means unnecessary warning but not a broken banner |
| A2 | `pointerEvents="none"` on a `View` containing a `ScrollView` correctly disables all scroll-touch interaction | Patterns §GatedScreenWrapper | MEDIUM — if `ScrollView` children ignore parent `pointerEvents`, users could still scroll the gated form. Verify during implementation with a manual test on each of the 4 screens |
| A3 | Backend Phase 5 05-0a + 05-0b will land before Phase 6 QUAL-02 runs | Load test plans | HIGH — QUAL-02 cannot execute meaningfully without those routes live. STATE.md already tracks this blocker |
| A4 | Admin Alert.alert text is selectable on Android (tap-and-hold to copy) | UI-SPEC Clipboard Decision | LOW — if Android Alert text is NOT selectable, users must type the email manually. Mitigation: if UAT reveals the issue, revisit Clipboard Decision |
| A5 | `user.moderationStatus.setAt` is present on every non-active user record | Pitfall 11 + Banner mailto | LOW — Phase 2 writes this field on every state transition; Phase 1 migration backfilled existing non-active users; fallback is empty string in mailto body |
| A6 | RU Alert title "Почтовое приложение не установлено" in UI-SPEC is the intended user-facing text (not a placeholder) | Copywriting | LOW — user already reviewed UI-SPEC; if this is off, it's a copy change, not structural |
| A7 | Phase 6 SECURITY review's 6th criterion is ROADMAP-implicit; the 5 visible in ROADMAP §Phase 6 are (a)-(e); the 6th is "no new hardcoded secrets" and is (e) of the 5 | Pending planner confirmation | MEDIUM — SECURITY template must map the actual 6 ROADMAP items. Re-read ROADMAP §Phase 6 §Success Criteria #6 at plan-time |

**Conclusion:** All assumptions are LOW/MEDIUM risk and recoverable via UAT or plan-time re-read. None block Wave 0.

## Open Questions

1. **How does `pointerEvents="none"` interact with nested `ScrollView` / `KeyboardAvoidingView` inside `SellCarScreen` / `ServiceCartScreen`?**
   - What we know: UI-SPEC assumes it cleanly cascades. RN docs confirm `pointerEvents` is inherited downward unless a child explicitly overrides.
   - What's unclear: `ScrollView` on Android sometimes captures touches via a separate gesture system (GestureHandler integration).
   - Recommendation: planner adds a manual UAT item — "tap inside dimmed SellCar form, confirm no field focuses / no keyboard opens."

2. **Is the 6th security criterion in ROADMAP §Phase 6 Success #6 genuinely 6 or is it a 5-item list with parenthesized (a)-(e) sub-items?**
   - What we know: ROADMAP §Phase 6 Success Criterion #6 reads: "Security review sign-off confirms (a) verifyIdToken on every admin route, (b) no callerUid body param trusted for authorization on any new route, (c) suspend and confirm-booking mutations are transactional, (d) the ModerationAction collection rejects updates and deletes at the application layer, (e) no new hardcoded secrets were introduced". That's **FIVE sub-items (a-e)**.
   - What's unclear: UI-SPEC / CONTEXT references "6 criteria". The CONTEXT D-QUAL-03 section lists 5 sub-items plus "[one more from ROADMAP]" — deliberately leaving slot 6 TBD.
   - Recommendation: 06-SECURITY.md has 5 sections matching (a)-(e) verbatim; add a 6th section titled "Additional hardening notes" for any incidental findings. Do not invent a 6th criterion where ROADMAP only has 5.

3. **Should `handleCallSeller` ("Contact seller" CTA on CarDetailsScreen line 688) be wrapped in a separate `GatedButtonGate` component, or should we add a lightweight conditional render inline?**
   - What we know: UI-SPEC §Component 4 proposes a `GatedButtonGate` pattern. CarDetailsScreen line 688 is the exact `TouchableOpacity` to wrap; it sits inside `footerContactButtonsRow`.
   - What's unclear: complexity vs. payoff. Inline conditional = 10 lines in CarDetailsScreen; shared component = one more file + reuse across future screens.
   - Recommendation: inline conditional for Wave 3; if a second use site appears (e.g., "Book now" on ServiceDetails), extract at that point. Do not prematurely componentize.

## Environment Availability

Required external dependencies for Phase 6:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node >= 20 | jest parity test | ✓ | v20.19.1 [VERIFIED] | — |
| React Native 0.83.1 | all UI work | ✓ | 0.83.1 [VERIFIED: package.json] | — |
| k6 | QUAL-02 load test | ✗ | — | `brew install k6` on dev; apt/yum in CI |
| mongosh | QUAL-02 `explain()` verification | ✗ | — | `brew install mongosh`; OR write the verify in Node via `mongoose.connection.db.command()` |
| `backend-services/carEx-services` sibling repo | QUAL-02 seeding + load test | ✓ | present [VERIFIED: directory exists at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`] | — |
| Backend Phase 5 05-0a (`GET /api/admin/moderation/:uid/history`) | QUAL-02 history endpoint load test | ✗ | — | **BLOCKING** — QUAL-02 history test cannot run until this lands |
| Backend Phase 5 05-0b (`GET /api/admin/users/search`) | QUAL-02 search endpoint load test | ✗ | — | **BLOCKING** — QUAL-02 search test cannot run until this lands |
| MongoDB Atlas instance or local mongod | QUAL-02 seed + load test | Unknown | — | — |

**Missing dependencies with no fallback:**
- Backend 05-0a + 05-0b routes (cross-repo execution prerequisite per STATE.md)

**Missing dependencies with fallback:**
- k6 (install step in plan 06-0a)
- mongosh (use Node-based verify as alternative)

**Planning implication:** Phase 6 plans can be WRITTEN without waiting for backend 05-0a/0b. Phase 6 plans can EXECUTE for Half A (mobile UX) without waiting. Phase 6 QUAL-02 EXECUTION is blocked on 05-0a/0b landing. Structure the plan queue so mobile work doesn't wait on backend.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest ^29.6.3 [VERIFIED: package.json:52] + `react-test-renderer` ^19.2.0 [VERIFIED: package.json:54] |
| Config file | `/Users/beckmaldinVL/development/mobileApps/carEx/jest.config.js` [VERIFIED] |
| Preset | `react-native` (extends RN preset; transformIgnorePatterns extended for `@react-navigation`, `@stripe`, `lucide-react-native`, etc.) |
| Quick run command | `npx jest <file>` — runs a single test file |
| Full suite command | `npm test` |
| Screen-test pattern | `settle()` helper (React 19 async act hybrid) — established in Phase 5 Plan 05-10; reuse verbatim |
| LanguageContext mock pattern | `mockT` Proxy hoisted with `mock*` prefix (babel-plugin-jest-hoist allowlist) — established in Phase 5 Plan 05-10 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AFF-01 | Banner renders when state !== active | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "renders when"` | ❌ Wave 0 |
| AFF-01 | Banner returns null when state === active | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "returns null"` | ❌ Wave 0 |
| AFF-01 | Banner shows different icon + color per severity | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "severity"` | ❌ Wave 0 |
| AFF-01 | Banner is non-dismissable (no close button, tap does not hide) | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "non-dismissable"` | ❌ Wave 0 |
| AFF-02 | Banner displays reason category + note verbatim | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "reason"` | ❌ Wave 0 |
| AFF-02 | Empty note → line 2 hidden | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "empty note"` | ❌ Wave 0 |
| AFF-02 | Tap-to-expand toggles numberOfLines | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "expand"` | ❌ Wave 0 |
| AFF-03 | Appeal CTA visible on blocked_with_review only | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "appeal visibility"` | ❌ Wave 0 |
| AFF-03 | Appeal CTA opens mailto with correct subject + body | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "mailto"` | ❌ Wave 0 |
| AFF-03 | openURL rejection surfaces Alert | unit (component) | `npx jest src/components/moderation/__tests__/UserStatusBanner.test.tsx -t "no mail app"` | ❌ Wave 0 |
| AFF-04 | GatedScreenWrapper renders overlay when capability in restrictedFeatures | unit (component) | `npx jest src/components/moderation/__tests__/GatedScreenWrapper.test.tsx` | ❌ Wave 0 |
| AFF-04 | GatedScreenWrapper handles `all_writes` sentinel | unit (component) | `npx jest src/components/moderation/__tests__/GatedScreenWrapper.test.tsx -t "sentinel"` | ❌ Wave 0 |
| AFF-04 | `apply_as_provider` alias resolves to broker OR logistics | unit (component) | `npx jest src/components/moderation/__tests__/GatedScreenWrapper.test.tsx -t "alias"` | ❌ Wave 0 |
| AFF-04 | FeatureGateOverlay copy adapts per severity | unit (component) | `npx jest src/components/moderation/__tests__/FeatureGateOverlay.test.tsx -t "severity copy"` | ❌ Wave 0 |
| AFF-04 | Buyer features remain usable when only provider role gated | manual UAT | (UAT doc) | N/A |
| QUAL-01 | RU key set === EN key set | jest parity | `npx jest __tests__/translation-parity.test.ts` | ❌ Wave 0 |
| QUAL-01 | No TODO/FIXME placeholder values | jest parity | `npx jest __tests__/translation-parity.test.ts -t "placeholder"` | ❌ Wave 0 |
| QUAL-01 | No hardcoded user-facing literals in new moderation files | shell grep | `bash scripts/audit-moderation-literals.sh` | ❌ Wave 0 |
| QUAL-02 | P95 < 200 ms on /api/admin/users/search with 10k seeded users | load test | `k6 run --vus 200 --duration 60s scripts/load-test/admin-search.k6.js` (backend repo) | ❌ new (cross-repo) |
| QUAL-02 | P95 < 200 ms on /api/admin/moderation/:uid/history | load test | (same k6 script, both endpoints) | ❌ new (cross-repo) |
| QUAL-02 | IXSCAN on moderationStatus.state + 2 compound indexes | shell + mongosh | `bash scripts/load-test/verify-indexes.sh` (backend repo) | ❌ new (cross-repo) |
| QUAL-03 | verifyIdToken on every admin route | grep evidence | documented in 06-SECURITY.md with grep command | ❌ new |
| QUAL-03 | No callerUid body trust | grep evidence | `grep -rn "req.body.callerUid" backend-services/carEx-services/src/` | ❌ new |
| QUAL-03 | Transactions on suspend + confirm-booking | code review evidence | 06-SECURITY.md | ❌ new |
| QUAL-03 | ModerationAction append-only at app layer | existing test evidence | Phase 1 Plan 01-01 append-only test (already green) | ❌ new (pointer only) |
| QUAL-03 | No new hardcoded secrets | git diff grep | `git diff main...HEAD -- '*.ts' '*.tsx' '*.js' | grep -E '(sk_|pk_live|AIza)'` | ❌ new |

### Sampling Rate

- **Per task commit:** `npx jest <file>` for touched component/test
- **Per wave merge:** `npm test` for full suite + `npx jest __tests__/translation-parity.test.ts` for QUAL-01
- **Phase gate (before /gsd-verify-work):** full `npm test` green + `k6 run` green (backend) + `bash verify-indexes.sh` green + `06-SECURITY.md` all 5 sections pass

### Wave 0 Gaps

- [ ] `src/components/moderation/__tests__/UserStatusBanner.test.tsx` — new scaffold (covers AFF-01, AFF-02, AFF-03)
- [ ] `src/components/moderation/__tests__/FeatureGateOverlay.test.tsx` — new scaffold (covers AFF-04 overlay copy)
- [ ] `src/components/moderation/__tests__/GatedScreenWrapper.test.tsx` — new scaffold (covers AFF-04 gating predicate)
- [ ] `__tests__/translation-parity.test.ts` — new (covers QUAL-01 set-equality)
- [ ] `scripts/audit-moderation-literals.sh` — new (optional; covers QUAL-01 literal scan)
- [ ] `backend-services/carEx-services/scripts/load-test/admin-search.k6.js` — new (covers QUAL-02 search P95)
- [ ] `backend-services/carEx-services/scripts/load-test/verify-indexes.sh` — new (covers QUAL-02 index use)
- [ ] `backend-services/carEx-services/scripts/seed-moderation-load.js` — new (covers QUAL-02 10k seed)
- [ ] `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` — new (covers QUAL-03 all criteria)
- [ ] No framework install needed — jest already in package.json

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** — QUAL-03 §a (verifyIdToken) confirms Firebase idToken verification on admin routes | firebase-admin `verifyIdToken()` |
| V3 Session Management | **yes** — Phase 5 Plan 05-12 idToken refresh must be verified as complete in QUAL-03 | single-flight refresh + AppState foreground refresh |
| V4 Access Control | **yes** — QUAL-03 §a + §b (no callerUid trust) — admin-only enforcement server-side | `requireAdmin` middleware factory |
| V5 Input Validation | **yes** — Phase 2 Zod schemas on moderation endpoints | zod `.strict()` + discriminated unions |
| V6 Cryptography | **partial** — no new crypto in Phase 6; existing Firebase idToken verification + Stripe are touched only as review-subject, not modified | N/A (verify-only) |
| V7 Error Handling | **yes** — error responses must not leak internal details (`account_suspended` error shape is already a curated response, not a stack trace) | review `403 account_suspended` response body shape |
| V12 File Handling | **no** — no file upload or file serving in Phase 6 | N/A |
| V13 API | **yes** — admin search + history endpoints must enforce pagination + rate limiting (Phase 2 SEC-04) | `express-rate-limit` already installed |

### Known Threat Patterns for {React Native mobile + Node/Express + MongoDB}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed admin via mobile-side `isAdmin` | Spoofing | Server-side `verifyIdToken` + `requireAdmin` middleware (Phase 1 SEC-01, SEC-02) |
| TOCTOU race on suspend-while-confirming-booking | Tampering | Transactional re-check inside confirm-booking (Phase 3 ENF-03) |
| ModerationAction tampering (edit/delete audit rows) | Repudiation | Application-layer append-only (Phase 1 Plan 01-01 test); optional DB-level via Atlas tier-dependent auditing |
| Banner copy injection via admin note | Injection / XSS | React Native `<Text>` does NOT interpret HTML; admin note rendered as plain text. **Verify**: the planner must NOT pass `note` through any `dangerouslySetInnerHTML`-equivalent (doesn't exist in RN, but confirm via grep) |
| Mailto URL injection via UID or reason | Injection | `encodeURIComponent` wrap on every interpolated value before `mailto:` assembly (UI-SPEC §Appeal CTA behavior) |
| Hardcoded secret leaked in banner / overlay copy | Information disclosure | QUAL-03 §e grep for sk_/pk_live/AIza/AKIA in git diff |
| Load-test artifacts committed with live credentials | Information disclosure | Seed script uses env vars (MONGODB_URI, FIREBASE_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD); `.env` gitignored; k6 harness accepts via `__ENV` |

## Sources

### Primary (HIGH confidence)

- **In-repo files (literal reads):**
  - `/Users/beckmaldinVL/development/mobileApps/carEx/package.json` (dependency versions)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/components/OfflineNotice.tsx` (banner mount pattern)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/constants/theme.ts` (severity palette)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/screens/CarDetailsScreen.tsx:220-231, 683-691` (Linking convention + Contact seller CTA location)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/screens/ServiceApplicationScreen.tsx:32-55` (broker/logistics dispatch via route.params.type)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/screens/SellCarScreen.tsx:496-497, 635` (top-level SafeAreaView + ScrollView)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/screens/ServiceCartScreen.tsx:110-220` (top-level SafeAreaView)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/services/moderation/ModerationService.ts:110-120` (moderationStatus type including `setAt` field)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/src/services/http/client.ts` (apiClient + interceptor architecture)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/jest.config.js` (jest RN preset)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/05-admin-moderation-ui-mobile/05-LEARNINGS.md` (9 lessons + 11 patterns + 7 surprises — read in full)
  - `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-04-PLAN.md:80-138` (STATUS_POLICY capability map — SOURCE OF TRUTH for capability keys)
  - `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/capabilities.js` (live backend STATUS_POLICY — grep-verified match with Phase 1 plan)

- **Official docs (fetched live):**
  - [React Native LayoutAnimation](https://reactnative.dev/docs/layoutanimation) — confirmed 0.83 support; Android enable requirement; no deprecation
  - [React Navigation useFocusEffect v7](https://reactnavigation.org/docs/use-focus-effect) — cleanup fires on blur AND unmount; native-stack timing caveat

### Secondary (MEDIUM confidence — verified against official source)

- [k6.io documentation](https://k6.io/docs) — setup() hook pattern; `thresholds` syntax for P95 assertion; auth token handling
- [MongoDB explain results](https://www.mongodb.com/docs/manual/reference/explain-results/) — queryPlanner vs executionStats; IXSCAN stage meaning
- [GitHub react-navigation/react-navigation#10190](https://github.com/react-navigation/react-navigation/issues/10190) — useFocusEffect cleanup timing on native-stack navigate()
- [GitHub expo/expo#38333](https://github.com/expo/expo/issues/38333) — UIManager.setLayoutAnimationEnabledExperimental no-op warning on new arch

### Tertiary (LOW confidence — flagged for planner validation)

- Medium article load-testing PoC (k6 vs Artillery vs Locust) — used for qualitative comparison, not version numbers
- LinkedIn article on load-testing tool choice — general positioning only

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all versions verified via `package.json`, `npm view`, and direct repo reads
- **Architecture patterns:** HIGH — OfflineNotice + CarDetailsScreen Linking convention + Phase 5 LEARNINGS give us exact precedents
- **Pitfalls:** HIGH on Pitfalls 1-5 (grep-verified in-repo or confirmed via official docs); MEDIUM on Pitfall 3 (useFocusEffect timing — based on open GitHub issue, not official docs); HIGH on Pitfall 6 (grep-verified against backend capabilities.js)
- **Capability Contract Verification:** HIGH — literal read of both `.planning/phases/01-*` AND live backend `src/moderation/capabilities.js` confirms the 7-element feature_limited list and the absence of `apply_as_provider`
- **Load-test tooling:** MEDIUM — k6 is a defensible choice but autocannon + artillery are also valid; planner may confirm with user if strong alternate preference
- **Security review format:** MEDIUM — template is proposed, no project precedent exists yet

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — stable stack; RN 0.83 stable; k6 stable)
