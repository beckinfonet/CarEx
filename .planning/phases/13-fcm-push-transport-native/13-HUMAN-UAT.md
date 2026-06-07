---
status: passed
phase: 13-fcm-push-transport-native
source: [13-VALIDATION.md, 13-05-PLAN.md]
started: 2026-06-07
updated: 2026-06-07
approved_at: 2026-06-07
approval_basis: "Operator signed off all real-device items on a TestFlight build (after the iOS Firebase-init hotfix 80795d9). NPUSH-01 Stripe checkout + 03/06/07 push delivery/tap/cold-start + NPRF-06/07 pre-prompt/recovery confirmed on device; both Jest suites green (mobile 17 known baseline fails only, backend push-copy-parity green)."
---

# Phase 13 — Real-Device HUMAN-UAT (FCM Push Transport)

> **Why this exists.** APNs/FCM transport, RNFB native handlers
> (`getInitialNotification` / `onNotificationOpenedApp` / background handler),
> the static-frameworks Release archive, and the lock-screen rendering are
> impossible to verify in Jest. These four criteria (NPUSH-01/03/06/07) plus the
> pre-prompt/recovery UX (NPRF-06/07) require a real device. This checklist is
> the phase gate (see 13-VALIDATION.md).
>
> **PHASE GATE (must ALL hold before `/gsd-verify-work`):**
> 1. Full Jest suite green in the **mobile** repo (baseline: 17 known pre-existing
>    failures; everything else green — push-copy-parity + prePrompt +
>    NotificationSettingsScreen suites green).
> 2. Full Jest suite green in the **backend** repo
>    (`backend src/notifications/__tests__/push-copy-parity.test.js` green —
>    NPUSH-08 / D-08b automated).
> 3. **Every item below signed PASS on a real device.**
>
> **Setup:** install a Release-signed build (TestFlight for iOS; signed
> APK/AAB or `--variant=release` for Android). Debug/Simulator does NOT satisfy
> NPUSH-01 (Pitfall 3). Use a real account, a real listing, and a real
> saved-search/Watch so the backend send loop fires a genuine push.

---

## Tests

### 1. NPUSH-01 — Static-frameworks Release archive runs + Stripe checkout intact
**Cross-ref:** 13-SPIKE-RESULT.md (✅ SPIKE PASSED 2026-06-06; D-02 both bars met).
This item RE-CONFIRMS the shipped build (not just the spike build) still satisfies it.

steps:
1. Build the iOS Release archive with `use_frameworks! :linkage => :static`
   (`$RNFirebaseAsStaticFramework = true`) — `npm run ios:archive` or the spike
   incantation in 13-SPIKE-RESULT.md.
2. Install the Release build on a **real iPhone** (TestFlight or Xcode → device).
3. Launch the app; confirm it does NOT crash at startup (RNFB + Stripe both
   linked statically).
4. Add a service to the cart and run a **Stripe TEST checkout** end-to-end.

PASS condition: app launches on the real device AND the Stripe test checkout
completes ("Payment successful! Your booking is confirmed.", listing flips to
Booked). No static-frameworks link/compile crash.

result: PASS
sign-off: beckinfonet / 2026-06-07 (TestFlight, post iOS Firebase-init hotfix 80795d9)

---

### 2. NPUSH-03 / NPUSH-08 — Push arrives with a PII-safe lock-screen body (D-08b)
steps:
1. On the device, accept the contextual pre-prompt (or enable push in OS
   Settings) so the device token is registered.
2. Create a saved search OR Watch a car that will match an instant event
   (e.g. a price drop / new match) — trigger a real backend instant event.
3. **Lock the device** so the push lands on the lock screen.
4. Read the delivered notification body on the lock screen.

PASS condition: a push is delivered to the device AND the lock-screen body
contains **NONE** of the following PII (D-08b HARD-BAN):
- ❌ make / model (no "{makeModel}")
- ❌ price / KGS som amount (no "{price}", no "{newPrice}", no "сом")
- ❌ seller identity / name
- ❌ exact location
The body must be the generic, param-free copy (e.g. "Откройте, чтобы
посмотреть"). Title may be category-specific (e.g. "Цена снизилась") but carries
no PII.

result: PASS
sign-off: beckinfonet / 2026-06-07 (TestFlight, post iOS Firebase-init hotfix 80795d9)

---

### 3. NPUSH-06 — Foreground / background / quit tap each handled
steps:
1. **Foreground:** with the app open and visible, trigger a push. Confirm it is
   received (`onMessage`) and surfaced/handled without crashing.
2. **Background:** put the app in the background (home button / app switcher,
   app still resident). Trigger a push; tap it. Confirm
   `onNotificationOpenedApp` routes to the target.
3. **Quit:** fully swipe-kill the app. Trigger a push (the background message
   handler registered at module scope in `index.js` must run headless). Confirm
   the push is delivered to the tray.

PASS condition: a push in EACH of the three app states is handled — foreground
received, background tap routes, quit-state push delivered to the tray — with no
crash in any state.

result: PASS
sign-off: beckinfonet / 2026-06-07 (TestFlight, post iOS Firebase-init hotfix 80795d9)

---

### 4. NPUSH-07 — Cold-start tap opens the correct CarDetails
steps:
1. Fully **kill** the app (swipe away — not just background).
2. Trigger a push whose `data.deeplink` targets a specific listing
   (`listing/:carId`).
3. From the killed state, **tap the push** to cold-launch the app
   (`getInitialNotification`).
4. Observe the screen the app opens to.

PASS condition: the app cold-launches AND navigates to the **correct
CarDetails** for the car referenced in the push (routed via the `linking`
whitelist `listing/:carId`). The car shown matches the push's listing.

result: PASS
sign-off: beckinfonet / 2026-06-07 (TestFlight, post iOS Firebase-init hotfix 80795d9)

---

### 5. NPRF-06 / NPRF-07 — Pre-prompt timing + denied-permission recovery (no dead-end)
steps:
1. **Fresh install / cleared state** (clear app data so `push_preprompt_seen` is
   unset). Launch the app — confirm **NO permission prompt appears on launch**.
2. Perform the FIRST Watch OR first Save-search. Confirm the soft in-app
   pre-prompt appears ("Включить" / "Не сейчас"), plain functional copy.
3. Tap **"Не сейчас"**. Perform a second Watch/Save-search — confirm the
   pre-prompt does **NOT** re-appear (fire-once, never auto-re-ask, D-04/D-05).
4. Open **NotificationSettings**. With push OFF, confirm the recovery row shows
   "Push-уведомления: выключены" and is tappable → deep-links to OS Settings.
5. In OS Settings, turn push ON, return to the app — confirm the row refreshes
   to "Push-уведомления: включены" (AppState/focus refresh, D-10/D-11).
6. With push DENIED, confirm the **Phase-12 in-app notification center still
   works fully** (open it, see items) — no dead-end (NPRF-07).

PASS condition: no launch prompt; pre-prompt fires once on first conversion and
"Не сейчас" never re-asks; settings recovery row reflects live status and
deep-links to OS Settings when off; the in-app center remains fully functional
when push is denied.

result: PASS
sign-off: beckinfonet / 2026-06-07 (TestFlight, post iOS Firebase-init hotfix 80795d9)

---

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Phase-Gate Sign-Off

- [x] Mobile Jest suite green (baseline 17 known failures, no new failures — 537 passed).
- [x] Backend Jest suite green (push-copy-parity NPUSH-08 / D-08b green — merged to main via PR #10).
- [x] All 5 device tests above signed PASS.

Phase gate satisfied.

**Overall sign-off:** beckinfonet / 2026-06-07
