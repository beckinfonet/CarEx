# Phase 13 Spike Result — iOS static-frameworks (NPUSH-01)

**Spike:** `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true` on RN 0.83 with Stripe intact.
**Gate (D-02):** PASS only when a **Release archive runs on a real iOS device AND a Stripe TEST checkout completes**. Simulator/Debug do NOT count (Pitfall 3).
**Status:** IN PROGRESS — automated `pod install` portion (Task 1 + Task 2) executed by agent; **real-device Release gate (Task 3) pending human verification.**

---

## Rollback Checkpoint (pre-frameworks, committed BEFORE any linkage change)

This is the clean known-good revert target established before touching iOS linkage (D-02).

| Item | Value |
|------|-------|
| Branch | `feature/notifications-system` |
| Pre-frameworks git SHA | `5d6c02452d1899b7dc637a3e1d9588fa6c377692` (`5d6c024`) |
| `ios/Podfile.lock` sha256 | `52f23de8da2d8bcd65ebfb941d9b536c43b4188659c04a46b5aad7454b7f0c0c` |
| `ios/Podfile.lock` PODFILE CHECKSUM | `7d248f31ee12180f8faccacc61f937db160dfdbb` |
| CocoaPods | `1.16.2` |
| Xcode | `26.4` |
| Pre-switch Podfile toggle state | `linkage = ENV['USE_FRAMEWORKS']` — dynamic by default; static frameworks NOT yet enabled (no env var set; `USE_FRAMEWORKS` unset in shell) |
| `$RNFirebaseAsStaticFramework` | NOT present (pre-switch) |
| Timebox START (D-01, 2 days) | `2026-06-07T03:54:25Z` |
| Timebox DEADLINE (hard abort) | `2026-06-09T03:54:25Z` |
| Parked unrelated churn | `android/version.properties`, `ios/carEx.xcodeproj/project.pbxproj` stashed (`stash@{0}: phase13-spike: park version-bump churn`) so the checkpoint is clean version-bump-free |

### Exact revert command (run if spike ABORTS — D-02)

```bash
# 1. Restore the pre-frameworks Podfile + lockfile from the checkpoint SHA
git checkout 5d6c02452d1899b7dc637a3e1d9588fa6c377692 -- ios/Podfile ios/Podfile.lock

# 2. Also restore entitlements / Info.plist if they were modified by the spike
git checkout 5d6c02452d1899b7dc637a3e1d9588fa6c377692 -- ios/carEx/carEx.entitlements ios/carEx/Info.plist

# 3. Fully tear down and reinstall pods at the pre-frameworks (dynamic) linkage
cd ios && pod deintegrate && pod install && cd ..

# 4. Confirm Podfile.lock matches the checkpoint
shasum -a 256 ios/Podfile.lock   # expect 52f23de8da2d8bcd65ebfb941d9b536c43b4188659c04a46b5aad7454b7f0c0c
```

On abort, ship Phase-12's in-app notification center as the **only** channel for this milestone and re-attempt native push in a future milestone (do NOT extend the timebox, do NOT pivot transports — D-02).

---

<!-- Working Incantation section appended in Task 2 -->
