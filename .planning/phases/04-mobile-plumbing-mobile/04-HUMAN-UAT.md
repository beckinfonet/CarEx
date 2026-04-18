---
status: partial
phase: 04-mobile-plumbing-mobile
source:
  - 04-VERIFICATION.md
started: 2026-04-18T07:55:00Z
updated: 2026-04-18T07:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-device end-to-end suspension propagation via 403 interceptor
expected: With admin suspending user A on live backend, any API call from user A's logged-in mobile session surfaces ModerationError, AuthContext.refreshUser fires, and user.moderationStatus.state transitions to the new value inside user A's running session with no app restart and no navigation loop.
result: [pending]

### 2. Real-device AppState foreground refresh after background suspension
expected: Logged-in user A backgrounds the app (home button / task switcher), admin suspends user A on live backend, user A foregrounds app — within 1-2 seconds AuthContext.refreshUser fires, AuthService.getBackendUser hits the backend, and user.moderationStatus.state transitions to the backend-authoritative value. No app restart required.
result: [pending]

### 3. No user-visible navigation loop on 403 during interactive use
expected: User A triggers an action that 403s (e.g., creates a listing while suspended). They see no flicker, no modal spawn-and-dismiss, no screen bounce. The error surfaces as a ModerationError that screens can handle in Phase 6 — Phase 4 must only NOT cause navigation side-effects.
result: [pending]

### 4. CR-01 deadlock scenario: user-initiated refresh when user is already suspended
expected: A screen calls refreshUser() directly while the user's backend state has just transitioned to suspended. The call must settle within axios default timeout (not hang) and the user.moderationStatus in context must update to reflect the suspended state.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
