---
status: blocked
phase: 11-buyer-affected-ux-quality-security-review
source: [11-VERIFICATION.md]
started: 2026-05-29T20:00:00Z
updated: 2026-05-29T20:30:00Z
blocked_on: prod LDATA-04 backfill migration — see [[prod_legacy_cars_hidden]]
---

## Current Test

[blocked — prod `/api/cars` returns `HTTP 200 []` because legacy cars have no `status` field and Phase 9's hide hook filters them out. Run `node scripts/migrate-listing-moderation.js` on the Railway backend against the prod Atlas DB, then resume UAT.]

## Tests

### 1. CarDetailsScreen banner + CTA gating (LBUY-01, LBUY-04)
expected: Open CarDetailsScreen on a suspended/archived/deleted listing as a non-admin buyer. Severity-aware banner renders above the hero image and is non-dismissable. All four CTAs (Telegram, WhatsApp, Book it, Get services) appear visually disabled (opacity 0.4) and unresponsive to touch. Severity tone matches the status — amber/AlertTriangle for suspended, gray/Archive for archived, red/Ban for deleted.
result: [pending]

### 2. ServiceCartScreen banner + checkout disable + Remove-only (LBUY-02)
expected: Add a non-active listing to cart and navigate to ServiceCartScreen. The inline banner renders inside the car card row. The global checkout button is disabled with a subtitle hint. Tapping "Remove from cart" removes only the car slot — service items remain. Pressing checkout while the banner is visible does nothing.
result: [pending]

### 3. Book-it 409 banner-state flip vs generic alert (LBUY-01 TOCTOU close)
expected: With a listing currently active, tap "Book it" through to payment. Have an admin suspend the listing mid-flow. After the 409 response, the screen displays the ListingStatusBanner in warning tone with the suspended title — NOT a generic "Payment Failed" alert.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps
