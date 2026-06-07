# Phase 13: FCM Push Transport (native) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 13-fcm-push-transport-native
**Areas discussed:** Spike failure / plan B, Pre-prompt UX & trigger, Push body copy vs privacy, Denied-permission recovery

---

## Spike failure / plan B (the gate)

**1a — If the spike timebox expires without a Stripe-intact Release build:**

| Option | Description | Selected |
|--------|-------------|----------|
| Abort & revert, in-app only this milestone | Use rollback checkpoint, ship Phase-12 in-app center as only channel, retry push later | ✓ |
| Extend past timebox to fix the conflict | Keep grinding on Stripe/fmt + static-frameworks coexistence | |
| Investigate alternative transport | Push path avoiding static frameworks (bare APNs + FCM HTTP v1, no RNFB native) | |

**1b — Timebox:** 2 days (free-text).
**1c — notifee fallback:** Leave to the spike (display-layer decision recorded as spike output).

**Notes:** Abort path honors the gate cleanly with lowest schedule risk; resolves the [[firebase_sdk_split]] memory tension (spike is the explicit de-risking mechanism).

---

## Pre-prompt UX & trigger (NPRF-06)

**2a — When the soft pre-prompt fires:**

| Option | Description | Selected |
|--------|-------------|----------|
| First Watch OR first Save-search | Whichever first; one prompt covers both | ✓ |
| Separately per action | Once for Watch, once for Save-search | |
| Only after successful subscription | Fire right after subscription created | |

**2b — "Not now" behavior:**

| Option | Description | Selected |
|--------|-------------|----------|
| Re-ask on next trigger | Re-show soft prompt each subscription | |
| Ask once more later, then go silent | Re-show on 2nd/3rd subscription then stop | |
| Never auto-re-ask | Opt in from Settings afterward | ✓ |

**2c — Tone:** Plain & functional (RU-first). UNHINGED market voice rejected for this surface.

---

## Push body copy vs privacy (NPUSH-08)

**3a — Lock-screen reveal level:**

| Option | Description | Selected |
|--------|-------------|----------|
| Fully generic, one line per category | No make/model, no price, no KGS | ✓ |
| Generic + make/model, never price | Names car, hides amount | |
| Per-category judgment | Some name the car, sensitive stay generic | |

**3b — Title vs body split:**

| Option | Description | Selected |
|--------|-------------|----------|
| Category title + generic body | Scannable, leak-free | ✓ |
| Single generic line, app name as title | | |

**3c — Hard bans:** Confirmed — price amount + seller identity banned from any push (exact location added to the ban in CONTEXT.md).

---

## Denied-permission recovery

**4a — Where to re-enable after deny:**

| Option | Description | Selected |
|--------|-------------|----------|
| From NotificationSettingsScreen row → deep-link | "Off — Enable in Settings" row | ✓ |
| That plus a one-time inline banner | Dismissible banner in notification center | |
| No nudge anywhere | Silent; in-app center only | |

**4b — Re-enable mechanics:** Deep-link to OS Settings (selected) vs static instructions only.
**4c — Live OS permission status:** Reflect live status (selected) vs affordance-only.

---

## Claude's Discretion

- notifee adoption — deferred to spike output.
- Device-token model shape / multi-device handling, OAuth caching, backoff tuning, channel/entitlement wiring — left to research/planning (bounded by NPUSH requirements).

## Deferred Ideas

- Re-attempting native push after a spike abort → future milestone.
- UNHINGED-voice push copy → rejected for this phase, possible later polish.
- In-notification-center re-enable banner → rejected in favor of Settings-screen-only path.
