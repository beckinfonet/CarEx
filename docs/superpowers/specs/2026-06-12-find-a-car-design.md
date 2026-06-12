# Find a Car — Design Spec

**Date:** 2026-06-12
**Status:** Approved for planning
**Scope:** Full feature across both repos — mobile (`carEx`) + backend (`carEx-services`)

## Summary

A buyer-side counterpart to "Sell a Car." Buyers post a **Car Request** describing the
vehicle they want (as specific or as generic as they like). Approved sellers browse these
requests and pay a flat fee to **unlock** a request's contact details so they can reach the
buyer directly via phone / WhatsApp / Telegram. Contact information is hidden behind a
paywall and is never exposed to a seller who has not paid.

**Core value:** sellers with matching inventory can find and reach motivated buyers; the app
monetizes each contact reveal.

## Product decisions (locked)

| Decision | Choice |
|---|---|
| Engagement scope | Mobile **and** backend, end-to-end |
| Paywall model | **Pay per request unlock** (flat fee) |
| Pricing | **Fixed flat fee, app-wide**, set server-side; admin-changeable |
| Contact revealed | **Phone (= WhatsApp) + optional Telegram** |
| Buyer notified on unlock | **Yes** — push + in-app (v1.2 notification engine) |
| Seller discovery | **Browse page + match notifications** |
| Browse/unlock gate | **Approved sellers only** (`GatedScreenWrapper`) |
| Buyer posting gate | **Phone OTP verification required** (reuse `/api/otp`) |
| Required fields | **Make + budget + verified phone**; everything else optional |
| Verification model | **SMS-verify phone (doubles as WhatsApp)**; Telegram optional + unverified |
| Lifecycle | **Buyer manages (edit / close / delete) + auto-expire at 30 days** |
| Entry points | Buyer CTA (Home/Profile) → form; seller browse in seller area; "My Requests" in Profile |

### Verification rationale

- **Phone via SMS OTP** is already implemented (`/api/otp/send` + `/api/otp/verify`, Twilio).
- **WhatsApp** accounts are bound to a phone number, so an SMS-verified number *is* a verified
  WhatsApp contact — rendered as a `wa.me/<number>` deep link. No WhatsApp API needed. Edge case:
  a verified number with no WhatsApp account simply won't resolve the link.
- **Telegram** `@username` is not tied to a verifiable phone; true verification would need a
  Telegram bot handshake (out of scope — possible fast-follow). It is stored unverified and
  labeled as such in the UI.

## Constraints (from CLAUDE.md)

- **Mobile stack:** RN 0.83 + TS + axios + AsyncStorage. No new state/networking libs.
- **Backend stack:** Node/Express + Mongoose + MongoDB Atlas.
- **Auth enforcement:** every seller/admin-only endpoint validates caller status **server-side**;
  never trust mobile-side `isAdmin` / seller flags.
- **Contact privacy is the security spine:** buyer contact fields must be stripped from every
  seller-facing response unless a paid unlock exists for that seller.
- **Data preservation:** closing/expiring a request only flips status; unlock + payment history
  is preserved.
- **i18n:** all strings RU-first with EN parity.
- **No regressions** to signup, login, browse, cart, or Stripe checkout.
- **Secrets hygiene:** no new hardcoded keys.
- **Currency:** KGS (som) per regional audience; flat fee follows the existing Stripe currency
  handling — confirm against the current `createPaymentIntent` currency param during planning.

---

## Backend design (`carEx-services`)

### Data model

Two new Mongoose collections.

**`CarRequest`**

| Field | Type | Notes |
|---|---|---|
| `buyerUid` | string, indexed | Firebase UID of poster |
| `makeId` / `makeName` | string | **required** |
| `modelId?` / `modelName?` | string | optional |
| `yearMin?` / `yearMax?` | number | optional range |
| `budgetMax` | number | **required** |
| `budgetMin?` | number | optional |
| `currency` | string | default `KGS` |
| `exteriorColor?` | string | optional |
| `interiorColor?` | string | optional |
| `interiorMaterial?` | string | optional |
| `engine?` | string | optional free text |
| `fuel?` | string | optional |
| `note?` | string | optional free-text wishlist |
| `contactPhone` | string (E.164) | **required**; also the WhatsApp number |
| `contactPhoneVerified` | boolean | must be true for `status: open` |
| `telegramUsername?` | string | optional |
| `telegramVerified` | boolean | always `false` for now |
| `status` | enum | `open \| closed \| expired` |
| `expiresAt` | Date | `createdAt + 30 days` |
| `unlockCount` | number | denormalized count of paid unlocks |
| `createdAt` / `updatedAt` | Date | timestamps |

**`RequestUnlock`** (one row per paid reveal)

| Field | Type | Notes |
|---|---|---|
| `requestId` | ObjectId ref `CarRequest` | |
| `sellerUid` | string | |
| `paymentIntentId` | string | Stripe |
| `amount` / `currency` | number / string | recorded at unlock time |
| `createdAt` | Date | |

**Unique index `(requestId, sellerUid)`** — a seller never pays twice for the same request;
re-viewing after unlock is free and idempotent.

### API surface — `/api/car-requests`

Seller routes accept `callerUid` and validate **approved-seller status server-side** (follow the
existing `callerUid` → status-check admin pattern). Buyer routes validate that `buyerUid` owns the
document.

**Buyer routes**

- `POST /` — create a request. Server **requires a verified `(uid, phone)` OTP record** matching
  the submitted `contactPhone` before setting `status: open`. Enforced server-side, not trusted
  from the client.
- `GET /mine?buyerUid=` — buyer's own requests (full contact, since it is theirs).
- `PUT /:id` — edit (owner only).
- `PATCH /:id/close` — mark "found it" / close (owner only).
- `DELETE /:id` — delete (owner only).

**Seller routes** (approved-seller gate)

- `GET /?callerUid=&make=&model=&budgetMax=…` — browse **open** requests, **contact redacted**,
  each tagged `unlocked: boolean` for this seller; response includes the current `unlockPrice`.
- `GET /:id?callerUid=` — request detail, contact redacted unless this seller has unlocked it.
- `POST /:id/unlock/payment-intent` — server sets the flat amount (**server-authoritative**, never
  trusts client). Short-circuits to free / no charge if already unlocked.
- `POST /:id/unlock/confirm` — verify payment → write `RequestUnlock` (idempotent on
  `(requestId, sellerUid)`) → return revealed contact → fire buyer notification → bump
  `unlockCount`.

**Config**

- Flat **unlock price** stored server-side (env var or settings doc), returned in the browse
  payload. Admin-changeable without a mobile release.

### Matching notifications

When a buyer posts a request, the backend finds sellers whose **active listings match**
(`makeId` equal; `modelId` if the request specifies one; listing price ≤ `budgetMax`) and sends
each a v1.2 notification: *"A buyer is looking for your {car}."* Gated by a new per-seller
notification preference (follows the "New Listings" toggle precedent).

### Security / data-preservation rules

- Contact fields are stripped from **every** seller-facing response unless an unlock row exists for
  that seller.
- Unlock amount is **server-authoritative** via Stripe (mirrors existing
  `createPaymentIntent` / `confirmBooking`).
- Closing or expiring a request only flips `status`; unlock and payment records persist.
- Auto-expiry: requests past `expiresAt` are treated as `expired` and excluded from browse.

---

## Mobile design (`carEx`)

### Service layer

New **`src/services/RequestService.ts`** — follows the existing `ModerationService` split
precedent rather than further bloating `AuthService.ts`. Uses the shared `apiClient` and
`user.localId`.

Methods: `createRequest`, `getMyRequests`, `updateRequest`, `closeRequest`, `deleteRequest`,
`getOpenRequests(filters)`, `getRequestDetail`, `unlockPaymentIntent`, `confirmUnlock`,
`getUnlockPrice`.

### Screens & navigation

Add to `RootStackParamList` (`src/types/navigation.ts`) and register in `App.tsx`:

| Route | Screen | Gate |
|---|---|---|
| `FindCar: { requestId? } \| undefined` | **FindCarScreen** — post/edit form | any logged-in user |
| `CarRequests` | **CarRequestsScreen** — seller browse list + filters | `GatedScreenWrapper` (approved seller) |
| `CarRequestDetails: { requestId }` | **CarRequestDetailsScreen** — detail + unlock/reveal | approved seller |
| `MyRequests` | **MyRequestsScreen** — buyer's requests (edit/close/delete) | any logged-in user |

New component **`src/components/RequestCard.tsx`** (mirrors `CarCard`): make/model, year range,
budget, key specs, status, and unlock state.

**FindCarScreen** mirrors `SellCarScreen`'s structure but lighter — `MakeModelFormField` (make
required, model optional), budget min/max, year range, exterior/interior color, material,
engine/fuel, note, and a **contact block** using `PhoneNumberFormatter` + the existing OTP verify
step (submit is blocked until the phone is verified), plus an optional Telegram field. The same
screen handles edit mode via the `requestId` param (same pattern as `SellCarScreen` edit).

### Paywall + contact-reveal flow

On **CarRequestDetailsScreen**, an un-unlocked request shows redacted contact + "Unlock for
{price}":

1. `RequestService.unlockPaymentIntent(requestId)`
2. Stripe native payment sheet (existing root `StripeProvider`)
3. `RequestService.confirmUnlock(...)` → contact revealed

Revealed contact renders **tap-to-call**, **tap-to-WhatsApp** (`wa.me/<number>`), and
**tap-to-Telegram** (if provided, labeled *unverified*). Already-unlocked requests skip payment
entirely.

### Notifications & matching (v1.2 engine)

- **Buyer notified on unlock:** *"A seller is interested in your request"* — push + in-app,
  surfaced in the existing Notifications screen, with a new toggle in `NotificationSettings`.
- **Seller match notifications:** as described in the backend section, gated by a new notification
  preference.

### Entry points

- **Buyers:** prominent **"Find a Car"** CTA on Home/Profile → `FindCarScreen`; **"My Requests"**
  in Profile → `MyRequestsScreen`.
- **Sellers:** **"Buyer Requests"** entry in the seller area (alongside `MyListings`) →
  `CarRequestsScreen`.

### i18n

~35–40 new RU-first + EN keys (form labels, unlock CTA, reveal labels, notification copy), added
to both language trees in `src/constants/translations.ts`.

---

## Delivery slices (vertical, each shippable)

1. **Buyer posts** — `CarRequest` model + create endpoint (with OTP enforcement) + buyer manage
   endpoints + `FindCarScreen` + `MyRequestsScreen`. No seller side yet.
2. **Seller browses** — list/detail endpoints (contact redacted) + `CarRequestsScreen` +
   `CarRequestDetailsScreen` + `RequestCard`.
3. **Paywall** — `RequestUnlock` model + unlock endpoints + Stripe reveal flow + buyer "unlocked"
   notification + `NotificationSettings` toggle.
4. **Match notifications** — seller-side listing-match logic + seller notification preference.

## Out of scope (possible fast-follows)

- Telegram bot verification handshake.
- In-app messaging (raw contact reveal is used instead).
- Subscription/credit billing or tiered/bounty pricing.
- Buyer-set bounties.
