# Find a Car — Slice 3 (Paywall + Contact Reveal) Design Spec

**Date:** 2026-06-12
**Status:** Approved for planning
**Scope:** Both repos — backend (`carEx-services`) + mobile (`carEx`)
**Builds on:** Slice 1 (buyer posts) + Slice 2 (seller browse/detail, contact redacted). See `docs/superpowers/specs/2026-06-12-find-a-car-design.md` (master) for the locked feature decisions.

## Summary

Sellers can **unlock** a buyer's contact details from the request detail screen. Slice 3 ships the **full paywall infrastructure** — `RequestUnlock` records, server-authoritative pricing, the Stripe payment flow, idempotent reveal, and a buyer "a seller is interested" notification — but gates the actual *charge* behind a server flag so we can launch the feature **free** and switch on billing later **without a mobile release**.

**Core value:** the app can connect motivated buyers with interested sellers now, exercise the real unlock data flow in production, and turn on monetization later by flipping one server-side flag.

## The escape hatch (new requirement)

A backend flag `REQUEST_UNLOCK_ENABLED` (env, **default `false`**) controls whether payment is required:

- **Paywall OFF (free, current launch state):** revealing contact skips Stripe entirely. The seller sees a note — *"Бесплатно сейчас. Позже это станет платной услугой."* / *"Free for now. This will become a paid service later."* — and a **"Reveal contact"** button. The unlock is still **fully recorded** (a `RequestUnlock` with `amount: 0`, `paymentIntentId: null`), `unlockCount` is bumped, and the buyer **is notified**.
- **Paywall ON (later):** revealing contact runs the Stripe payment sheet first; on confirmed payment the same record/reveal/notify happens. Flipping the env var on Railway is the only change required — no app-store release.

**Rationale:** a free unlock and a paid unlock differ only in the Stripe step. Building both paths now, switched by a server flag, means the record/reveal/notify pipeline is proven in production before money is involved, so going live with billing is the smallest possible change.

### Rejected alternatives

- **Client-side free flag** — would require an app release to start charging, and a client-trusted "free" flag is a paywall bypass. Rejected.
- **Set unlock price to 0** — conflates "free promo" with "misconfigured price"; the Slice-2 safe-fallback rewrites a non-positive price back to the default. Rejected.

## Constraints (from CLAUDE.md + master spec)

- **Auth:** unlock endpoints validate **approved-seller** status server-side from `req.auth.uid` (Slice-2 pattern). Never trust client seller flags.
- **Contact privacy spine:** contact fields stay stripped (`redactForSeller`) on every response **unless** a `RequestUnlock` exists for that seller; then the detail response returns the real contact.
- **Server-authoritative amount:** the charge amount comes from `getUnlockPrice()` server-side, never from the client (mirrors existing `createPaymentIntent` / `confirmBooking`).
- **Idempotency / data preservation:** unique `(requestId, sellerUid)` — a seller never pays twice; re-viewing an unlocked request is free. Unlock + payment records persist through close/expire.
- **Currency:** KGS (som), consistent with Slice 2's `getUnlockPrice`.
- **i18n:** all new strings RU-first with EN parity.
- **No regressions** to signup, login, browse, cart, or existing Stripe checkout.
- **Secrets hygiene:** no new hardcoded keys; reuse the existing root `StripeProvider` + backend Stripe secret.

---

## Backend design (`carEx-services`)

### Data model — `RequestUnlock`

New Mongoose collection, one row per paid/free reveal.

| Field | Type | Notes |
|---|---|---|
| `requestId` | ObjectId ref `CarRequest`, indexed | |
| `sellerUid` | string, indexed | Firebase UID of the unlocking seller |
| `paymentIntentId` | string \| null | Stripe PI id; `null` for a free-mode unlock |
| `amount` | number | recorded at unlock time (`0` in free mode) |
| `currency` | string | recorded at unlock time |
| `createdAt` | Date | timestamp |

**Unique compound index `(requestId, sellerUid)`** — enforces "pay once" and makes confirm idempotent.

### Config — `unlockConfig`

Extend the Slice-2 price helper (`src/carRequests/unlockPrice.js`) or a sibling module:

- `getUnlockPrice()` — unchanged (`{ amount, currency }`, env-driven, safe fallback).
- `isPaywallEnabled()` — returns `process.env.REQUEST_UNLOCK_ENABLED === 'true'` (**default `false`**). Admin-changeable via Railway env, no release.

### API surface — additions to `/api/car-requests`

All approved-seller gated (reuse `getApprovedSeller`). A helper `hasUnlocked(requestId, sellerUid)` checks for an existing `RequestUnlock`.

- **`POST /:id/unlock`** — the **free / already-unlocked** path.
  - If already unlocked → return `{ unlocked: true, contact, request }` (idempotent, no write).
  - Else if `isPaywallEnabled() === false` → create a `RequestUnlock` (`amount: 0`, `paymentIntentId: null`), bump `unlockCount`, fire the buyer notification, return the revealed contact.
  - Else (`paywall on`, not yet unlocked) → `409 { error: 'payment_required' }` (client must use the Stripe path).
- **`POST /:id/unlock/payment-intent`** — Stripe path step 1. Server sets the amount from `getUnlockPrice()`. Short-circuits to `{ alreadyUnlocked: true }` if a record exists. Returns the PaymentIntent client secret.
- **`POST /:id/unlock/confirm`** — Stripe path step 2. Verifies the PaymentIntent succeeded and matches the server amount, then writes the `RequestUnlock` (idempotent on the unique index), bumps `unlockCount`, fires the buyer notification, and returns the revealed contact.

**Detail/browse update:** `GET /:id` returns the **real contact** when the caller has an unlock (`unlocked: true`); otherwise stays redacted (Slice-2 behavior). Browse list tags each row `unlocked` per the caller's existing records, and both browse and detail include `paywallEnabled` alongside `unlockPrice`.

### Contact reveal shape

On an unlocked detail response, include the previously-stripped fields the seller paid for: `contactPhone` (= WhatsApp number), `telegramUsername` + `telegramVerified` (labeled unverified). `buyerUid` stays internal.

### Buyer notification

When an unlock is written (free or paid), send the buyer a v1.2 notification — *"Продавец заинтересован в вашей заявке"* / *"A seller is interested in your request"* — push + in-app, surfaced in the existing Notifications screen. Gated by a new per-user notification preference (follows the "New Listings"/watched-car toggle precedent), which **defaults ON** — including for existing users (a missing/undefined preference is treated as enabled), so buyers receive the notification without having to discover and flip a toggle they may not know exists. PII-safe copy (no seller identity in the push body).

### Security / preservation rules

- Contact fields never appear in a seller response without a matching `RequestUnlock`.
- The charge amount is always server-derived; the client never sends it.
- Closing/expiring a request leaves unlock + payment records intact.
- A request that is no longer `open` cannot be newly unlocked (`404`/`409`); an existing unlock still resolves its already-revealed contact.

---

## Mobile design (`carEx`)

### Service layer — `RequestService`

- `unlock(requestId)` → `POST /:id/unlock` (free / already-unlocked path).
- `unlockPaymentIntent(requestId)` → `POST /:id/unlock/payment-intent` (Stripe step 1).
- `confirmUnlock(requestId, paymentIntentId)` → `POST /:id/unlock/confirm` (Stripe step 2).
- Browse/detail types gain `paywallEnabled: boolean`; the redacted detail type gains an optional revealed-contact block (`contactPhone?`, `telegramUsername?`, `telegramVerified?`) present only when `unlocked`.

### CarRequestDetailsScreen — replace the Slice-2 stub

Driven by `paywallEnabled` and `unlocked`:

- **Already unlocked** → render the revealed contact block: **tap-to-call**, **tap-to-WhatsApp** (`wa.me/<number>`), **tap-to-Telegram** (if present, labeled *unverified*).
- **Locked + paywall OFF** → a note banner ("Free for now. This will become a paid service later.") + **"Reveal contact"** button → `RequestService.unlock(...)` → reveal in place.
- **Locked + paywall ON** → **"Unlock · {price} {currency}"** button → `unlockPaymentIntent` → root `StripeProvider` payment sheet → `confirmUnlock` → reveal in place.

### NotificationSettings

Add the new buyer toggle ("a seller is interested in your request") to the existing settings screen, wired to the backend preference.

### i18n

~10–12 new RU-first + EN keys: free-mode note, reveal CTA, unlock-with-price CTA, contact action labels (call / WhatsApp / Telegram + "unverified"), payment-failed error, and the notification-setting label.

---

## Delivery / testing

TDD (backend convention): `RequestUnlock` model behavior, `isPaywallEnabled`, both unlock paths (free write + reveal + notify; Stripe confirm + idempotency; approved-seller gate; `payment_required` when paywall on), and the detail response revealing contact only when unlocked. Mobile service methods are unit-tested with a mocked `apiClient`; screens follow the codebase no-unit-test convention.

## Out of scope (fast-follows)

- Admin **UI** toggle for the paywall flag / price (env var is sufficient for now).
- Telegram bot verification handshake.
- In-app messaging (raw contact reveal is the mechanism).
- Subscription/credit/tiered/bounty pricing.

## Operational note

Going live with billing later = set `REQUEST_UNLOCK_ENABLED=true` (and confirm `REQUEST_UNLOCK_PRICE`) in Railway. No code change, no app release. Document this in the runbook when the slice lands.
