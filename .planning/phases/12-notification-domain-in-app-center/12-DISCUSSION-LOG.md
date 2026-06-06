# Phase 12: Notification Domain + In-App Center - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 12-notification-domain-in-app-center
**Areas discussed:** Watch vs Favorite control, Bell + badge placement, "Notify me" save-search action, Settings & subscription structure

---

## Watch vs Favorite control

### Q1 — Watch control appearance
| Option | Description | Selected |
|--------|-------------|----------|
| Labeled bell button | Bell icon + text label, rendered separately from the icon-only heart | ✓ |
| Bell icon in action row | Bell next to Heart in the top-right action row | |
| Eye icon in action row | Eye metaphor in the action row | |

**User's choice:** Labeled bell button.

### Q2 — Watch event opt-in
| Option | Description | Selected |
|--------|-------------|----------|
| All 4 on by default | All four events on; per-event toggles in NotificationSettings | ✓ |
| All 4, no per-event control | All four, no toggles anywhere in v1.2 | |
| Choose at watch time | Sheet to pick events when tapping Watch | |

**User's choice:** All 4 on by default; per-event toggles deferred to settings.

### Q3 — Watch button placement
| Option | Description | Selected |
|--------|-------------|----------|
| In the contact/CTA stack | Alongside Book it / Get services | |
| Below the hero image | Standalone pill under photo/title, above specs | ✓ |
| Planner's discretion | Lock "labeled bell, distinct from heart"; planner picks | |

**User's choice:** Below the hero image.

---

## Bell + badge placement

### Q1 — Bell/feed entry location
| Option | Description | Selected |
|--------|-------------|----------|
| Right of the search pill | Standalone bell beside FloatingSearchPill | |
| Inside ProfileAvatarButton area | Avatar + bell cluster | |
| Row in Profile menu only | No header bell; reach via Profile row | |
| (re-asked, grounded) Map "More" to BottomBar/MoreMenu | Red dot on existing BottomBar More; Notifications item in MoreMenu | ✓ |
| Add a bottom navigator | New global tab nav (rejected — own phase) | |

**User's choice:** Free-text — "there is a menu section at the bottom: Home, Sell Car, More … visually acts like a bottom navigator." Resolved to the existing `BottomBar` + `MoreMenu` after I verified there is no top-header bell and no tab navigator. NCEN-01's "header bell" reinterpreted onto BottomBar/MoreMenu (the de-facto global nav).
**Notes:** First answer referenced a "bottom navigator" that I initially couldn't find (grep missed it). On re-search I located `BottomBar.tsx` (Home/Sell Car/More) + `MoreMenu.tsx`, mounted on `HomeScreenV2:328`. User confirmed that IS the surface they meant.

### Q2 — Badge prominence + split
| Option | Description | Selected |
|--------|-------------|----------|
| Count badge (capped 9+) | Red badge with number, capped 9+ | ✓ |
| Dot only | Plain red dot, no count | |
| Dot on More, count in menu | Dot on BottomBar More; 9+ count on in-menu Notifications item | ✓ |
| Count on both | 9+ count on both More button and menu item | |

**User's choice:** Count badge 9+, split as: red dot on More button, 9+ count on the Notifications item inside MoreMenu.

---

## "Notify me" save-search action

### Q1 — Affordance & placement
| Option | Description | Selected |
|--------|-------------|----------|
| Sticky bar above results | Persistent bar in SearchResultsV2 header when filters active | ✓ |
| Empty-state CTA + header action | Strong CTA in no-results state + smaller header action | |
| Button in the filter modal | "Save & notify" inside FilterModal | |

**User's choice:** Sticky bar above results.

### Q2 — Save flow / confirmation
| Option | Description | Selected |
|--------|-------------|----------|
| One-tap + toast | Instant create (instant cadence) + toast with Undo | ✓ |
| Confirm sheet | Sheet with criteria + name + cadence before saving | |

**User's choice:** One-tap + toast (Undo).

### Q3 — Cadence selector behavior in Phase 12
| Option | Description | Selected |
|--------|-------------|----------|
| Daily shown but disabled | Instant selected; Daily greyed "coming soon"; Phase 14 enables | ✓ |
| Daily selectable, silently instant | Daily pickable but behaves as instant until Phase 14 | |
| Hide daily entirely in P12 | No selector; instant only; added in Phase 14 | |

**User's choice:** Daily shown but disabled.

---

## Settings & subscription structure

### Q1 — Subscription management structure
| Option | Description | Selected |
|--------|-------------|----------|
| All in NotificationSettings | Single screen: mute, toggles, quiet hours, saved-search + watch lists | ✓ |
| Settings + separate Subscriptions screen | Split toggles vs lists across two screens | |
| Planner's discretion | Lock controls; planner picks one-screen vs split | |

**User's choice:** All in NotificationSettings.

### Q2 — Settings entry point
| Option | Description | Selected |
|--------|-------------|----------|
| Row in ProfileScreen | "Notifications" row in ProfileScreen menu | ✓ |
| Row in MoreMenu too | Entry in both ProfileScreen and MoreMenu | |
| Gear on NotificationsScreen | Reach settings via gear on feed header only | |

**User's choice:** Row in ProfileScreen (labeled "Notification settings" to disambiguate from the MoreMenu feed entry).

---

## Claude's Discretion

- Exact RU/EN label strings, icon sizing, toast component, sticky-bar visual treatment (D-13).
- Empty-state copy for NotificationsScreen (D-14).
- Notification feed-item appearance — per-category icons, read/unread styling, optional day grouping (D-15).
- Quiet-hours and daily-cap default values — plumbing only in Phase 12 (D-16).

## Deferred Ideas

- A true global bottom-tab navigator (with the More tab carrying the badge) — app-wide nav restructure, its own future phase. Phase 12 reuses the existing BottomBar/MoreMenu.
- Per-event opt-out beyond settings, confirm-sheet save flow, feed day-grouping/swipe-dismiss — v2 / NOTF2 backlog.
