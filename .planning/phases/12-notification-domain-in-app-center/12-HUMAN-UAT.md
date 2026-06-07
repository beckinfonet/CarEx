---
status: partial
phase: 12-notification-domain-in-app-center
source: [12-VERIFICATION.md]
started: 2026-06-06
updated: 2026-06-06
---

## Current Test

[awaiting human testing]

## Tests

### 1. Unread badge appears at launch without entering the center
expected: On a fresh authenticated app launch, the BottomBar More button shows a red dot badge (seeded by the WR-01 mount effect) when unread notifications exist — before opening the Notifications center.
result: [pending]

### 2. Watch subscription populates settings list
expected: Tap Watch on CarDetailsScreen, then Profile → Notification settings → "My watched cars" — the watched car appears in the list (CR-02 fix: `{ items }` envelope unwrapped).
result: [pending]

### 3. Saved-search deep-link restores filters on tap
expected: Create a saved search (e.g. BMW, price 2M–3M), trigger a new_match notification, tap it — SearchResults opens with BMW selected and the price range pre-applied (CR-03 fix: normalizeInitialFilters maps canonical keys → RU-label activeFilters + selectedMake/selectedModel seeds).
result: [pending]

### 4. Feed rows display meaningful localized title/body
expected: Open the notification center with ≥1 notification — rows show localized, interpolated copy (e.g. "Цена упала" + "BMW X5 — 2 500 000 сом"), not the generic "Уведомления" header with empty body (CR-01 fix: titleKey/bodyKey → notif_<key>_title/body + params interpolation).
result: [pending]

### 5. End-to-end subscription list (saved searches)
expected: Create a saved search, open Profile → Notification settings → "My saved searches" — the saved search row appears with criteria summary, cadence selector (Instant active / Daily disabled), and delete button (CR-02 fix, end-to-end).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
