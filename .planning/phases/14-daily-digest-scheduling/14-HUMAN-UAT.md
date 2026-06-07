---
status: partial
phase: 14-daily-digest-scheduling
source: [14-VERIFICATION.md]
started: 2026-06-07
updated: 2026-06-07
---

## Current Test

[awaiting human testing]

## Tests

### 1. Digest push tap routes to the Notification Center (D-03 / NDIG-03)
expected: Seed a `digestPending` Notification row for your test user, trigger `runDigest` on the deployed backend (or wait for the 08:00 Asia/Bishkek cron), then tap the resulting digest push. From all three app states — foreground, background, and quit (cold start) — the app opens the in-app Notification Center (`NotificationsScreen`), NOT CarDetails or any other screen.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
