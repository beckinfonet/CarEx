# 260607-c2i — Deferred Items

Release-prep actions discovered while fixing the PR #12 push findings. None are
code changes for this quick task; they are pre-**App-Store-(production)-archive**
prerequisites that must NOT be applied to dev/TestFlight builds.

## REL — iOS `aps-environment` development → production swap

- **File / line:** `ios/carEx/carEx.entitlements` line 5 — `aps-environment` is
  currently `development`.
- **Required action:** before building the **App Store (production) archive**,
  swap the value `development` → `production` so push tokens register against the
  production APNs gateway. `development` is the CORRECT value for all current dev
  and TestFlight builds — do NOT change it now.
- **Why deferred (not fixed here):** both the Debug and Release build configs in
  `ios/carEx.xcodeproj/project.pbxproj` reference the single
  `CODE_SIGN_ENTITLEMENTS = carEx/carEx.entitlements` file (lines 343 and 373),
  so there is no per-config entitlements split today. Flipping the value now
  would break dev/TestFlight push (sandbox APNs tokens against a production
  entitlement). A clean fix is a per-config entitlements split (two `.entitlements`
  files, one per build config) — out of scope for this push-correctness pass and
  only worth doing as part of the production-release milestone.
- **Originally tracked:** `13-PATTERNS.md:236` (known release-prep TODO).

## Cross-reference — Stripe / backend live-key release swap

The above lives alongside the already-tracked production-archive prerequisites in
`STATE.md` so all production-release gates sit in one checklist:

- **Stripe publishable key** — `App.tsx` `StripeProvider publishableKey=...` must
  be the live `pk_live_…` key (and the backend must use the matching `sk_live_…`
  secret on Railway) before a production release. Tracked in `STATE.md` (Phase 13
  release follow-up note) and the deferred table (`Stripe pk_test_ → pk_live_ swap`).
- Pattern: every production-archive secret/entitlement flip (Stripe live keys,
  Railway `sk_live`, and this `aps-environment` swap) is a single release-prep
  checklist item — none are applied in dev/TestFlight builds.
