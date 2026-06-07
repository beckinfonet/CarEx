# Feature Landscape: CarEx Notifications (v1.2)

**Domain:** Car-marketplace / classifieds notification system (saved searches, watched items, in-app center, FCM push)
**Researched:** 2026-06-06
**Confidence:** MEDIUM-HIGH (industry patterns well-attested via WebSearch + cross-source agreement; some regional details LOW)
**Scope note:** Enriches — does not contradict — the locked decisions in `docs/superpowers/specs/2026-06-06-notifications-system-design.md`. The two primitives (Saved Search + Watch), FCM-via-REST transport, per-subscription instant/daily cadence, and contextual-prompt timing are already decided. This doc fills the *behavior* gaps the spec leaves open: dedup norms, daily caps, which lifecycle events are truly standard, in-app center UX details, settings granularity, and explicit anti-features.

## Summary

The dominant marketplace pattern is exactly the two primitives CarEx already locked: **saved search → new-match alert** and **favorite/watch → lifecycle alert**. CarEx's design is squarely on the mainstream path (Avito, eBay, mobile.de, AutoTrader all do this). The biggest evidence-backed correction to common intuition: **for cars, instant beats digest** — well-priced used cars get their first inquiry within ~10 minutes and can be pending within an hour, so a daily-digest-only saved search is a competitively weak product. CarEx's instant-default-with-optional-daily is the right call; just make sure **instant is the default** and daily is opt-in, not the reverse.

The second load-bearing finding is that **notification fatigue is the #1 cause of opt-out**, and the spec already names this as the top risk. The concrete guardrails the industry converges on: a hard cap of **2–3 push/day/user**, **quiet hours** (overnight push is the single most-resented behavior and the #1 cited opt-out reason in surveys), **per-category toggles + master mute** (apps with comprehensive preference controls see ~43% lower opt-out and ~31% higher engagement), and **dedup/collapse** of repeated edits. The spec already has dedup and a settings screen; this research argues quiet hours and a daily cap should be promoted from "nice" to **table stakes** because they directly protect the milestone's stated goal (keep noise low → avoid opt-out).

Third: **contextual permission timing is validated hard by the data**. Users opt in ~89% of the time when *they* trigger the prompt (vs. iOS up-front ~40–45%), and a soft pre-prompt before the native dialog lifts opt-in 2–3x. The spec's "prompt on first Watch/Save-search, never on launch" is correct — the only addition is to insert a **soft in-app priming screen** before the native dialog (because iOS gives exactly one shot at the native prompt).

Regional note (KG/RU): the Avito/OLX mental model already trains this audience to expect "save favorites" + "saved search by criteria" + push on matches — so the primitives need no user education. The main regional adjustments are i18n correctness (already locked RU-first/EN) and quiet-hours defaults aligned to the local timezone (CarEx already derives city from device timezone — reuse that signal rather than building GPS).

## Saved-Search Alerts

### What criteria users expect to save
Across AutoTrader, Cars.com, mobile.de, Avito, OLX the saveable criteria set is consistently: **make, model, price range, year range, body type**, plus location/radius and mileage. CarEx's locked `criteria` (`makeId, modelId, priceMin, priceMax, yearMin, bodyType`) covers the table-stakes core.

| Criterion | Status | Notes / dependency |
|---|---|---|
| Make + model | Table stakes | Already in spec; reuse `useVehicleCatalog` makes/models. |
| Price min/max | Table stakes | In spec. KGS som, not ruble (per audience memory). |
| Year (min, and ideally max) | Table stakes | Spec has `yearMin` only — recommend adding `yearMax`; "2015–2018" is a common buyer intent. Low complexity. |
| Body type | Table stakes | In spec. |
| Location / radius | Differentiator | CarEx has no GPS and no backend city field (only timezone→city). Skip radius for v1.2; revisit if listings gain location. |
| Mileage range | Differentiator | Common on mobile.de; defer unless listing schema already has mileage. |
| Free-text / open query | Anti-feature for v1.2 | Cars.com's "Carson" open-text search is a big-platform NLP investment; matching free text against new listings is a different (expensive) engine. Stick to structured criteria. |
| "Create alert from current filters" one-tap | Table stakes | Spec's "Notify me about new matches" action. This is THE conversion moment — make it one tap from filter results. Depends on existing Home/filter browse. |

### Instant vs. digest norms
- **Cars are time-sensitive.** Evidence: best-priced cars get a first inquiry in ~10 min and go pending within the hour; AutoTrader's daily/weekly email digest and Facebook Marketplace's 2–4 hr batched alerts are widely cited as *too slow*. **Implication: instant should be the default cadence for new saved searches; daily is an opt-in noise-reduction choice for broad searches.**
- **Daily digest's legitimate role** is the *broad* saved search ("any BMW under X") that would fire many times/day. Aggregating those into one "12 new BMWs today" push (exactly the spec's digest design) is correct — it exists to tame high-volume searches, not as the default.
- **Recommendation:** Default new saved searches to **instant**, and *suggest* daily when the criteria are broad (optional UX nicety, differentiator). At minimum, default instant.

### Dedup / anti-spam expectations (CRITICAL — protects the milestone goal)
| Behavior | Status | Notes |
|---|---|---|
| Collapse repeated edits to one notification (short window) | Table stakes | Already a spec guard. Applies mainly to Watch price edits, but the principle is universal. |
| One notification per (subscription, listing) — never re-notify the same match | Table stakes | A saved search must fire **once** per newly-matching car, never again on subsequent edits of that same car. Needs a "already notified this car for this search" record (dedup key). Low-medium complexity; design the matching engine for it from day one. |
| Never notify the actor about their own listing | Table stakes | Spec guard. Seller editing own price ≠ alert. |
| Respect hide-hook / moderation status | Table stakes | Spec guard. Never notify about suspended/archived/deleted/hidden listings. |
| Per-user daily cap (2–3 push/day for instant saved searches) | Table stakes (recommend promote) | Industry hard cap is 2–3/day across all tiers; 2–5 marketing pushes/*week* already drives 46% to opt out. Instant saved searches on a popular model could blow past this. Suggested rule: if an instant saved search would exceed N pushes/day, auto-roll the overflow into that user's daily digest. Medium complexity; can ship simple (hard count + suppress-to-digest) in Phase C. |
| Max alerts/day convention | Reference | No universal number, but 2–3/day is the converged safe ceiling. Watch events (price drop/sold) are *transactional* and should be exempt from the cap — they're requested, low-volume, high-value. |

## Watched-Item Alerts

### Standard lifecycle events
The spec's four events (**price drop, booked, sold, back-available**) match the standard watchlist vocabulary (eBay-style: price change, status change, ending/gone). Assessment:

| Event | Status | Notes / dependency |
|---|---|---|
| Price drop | Table stakes | The #1 reason people watch an item. Hook: `PUT /api/cars/:id` + admin moderation PATCH where price decreased. Should fire **instant** (spec: Watch is always instant). |
| Sold / no longer available | Table stakes | Closes the loop; users hate finding out by tapping a dead listing. Hook: status transition. |
| Booked / pending | Table stakes-ish | Signals urgency ("someone's buying the car you watch"). CarEx already has booking; reuse `listingStatus`. Slightly less universal than price-drop/sold but valuable given CarEx's booking model. |
| Back-available (booked→active) | Differentiator (well-chosen) | Less common on big platforms (most don't model "un-sell"), but CarEx's booking-can-fall-through reality makes it genuinely useful — a watcher who lost the car gets a second chance. Keep it; it's a real differentiator for a booking-based marketplace. Low marginal complexity (it's just the inverse status transition). |
| **Price *increase*** | Anti-feature | Nobody watching to buy wants a "price went up" push. Only notify on **drop**. The spec already says "price drop" — make sure the hook checks direction. |
| New photos / description edit on watched car | Anti-feature for v1.2 | Low signal, high noise; this is exactly the kind of edit that should be *deduped/suppressed*, not notified. |

### How "back-available" should behave
- Fire only on a genuine **booked→active** transition (spec's definition), not on archived→active admin restores (that's moderation, not market availability — would be noise/confusing).
- Treat as **instant** (it's the most time-sensitive event of all — the car is briefly available again).
- Edge case to specify: if the watcher's price-drop and back-available could both fire from one transition, collapse to one notification (dedup principle).

### Dependency note
Watch button lives on `CarDetailsScreen` (spec). It depends on stable car identity — **use `car._id || car.id || carId`**, never bare `car.id` (per project memory: bare `car.id` has caused a silent prod booking-status bug). Subscriptions key on `carId`, so this matters for correctness.

## In-App Center

The in-app center is **pure REST, zero native** (spec Phase A) and is fully usable before push ships — good sequencing. Expected UX:

| Element | Status | Notes |
|---|---|---|
| Bell icon + unread badge in header | Table stakes | In spec. Badge hides at zero; show a count (or 9+) for unread. Badge should only reflect unread when items are markable and arrival is infrequent — true here. |
| Feed/list screen (NotificationsScreen) | Table stakes | In spec. Reverse-chronological, indexed `{uid, createdAt}`. |
| Tap → deep-link to the item | Table stakes | In spec; reuse existing `linking` config (`listing/:carId` → CarDetails). Each notification stores `data.deeplink`. |
| Mark-as-read on open (auto) + mark-all-read action | Table stakes | Standard global actions: Mark all read, Clear all. Tapping an item marks it read; provide an explicit "mark all read." |
| Unread vs. read visual distinction | Table stakes | Bold/dot for unread; muted for read. |
| Empty state | Table stakes | Friendly empty state that **doubles as onboarding** — e.g. "No notifications yet. Save a search or watch a car to get alerts" with CTAs to do exactly that. Turns the empty screen into the activation funnel. |
| Grouping (by day, or by type) | Differentiator | Group by day ("Today / Yesterday / Earlier") is the low-cost, high-value grouping. Category grouping (saved-search vs. watch) is nice but keep to ≤3–4 groups; not required for v1.2. |
| History retention | Decision needed (recommend table stakes) | Spec doesn't state a retention policy. Recommend: keep an in-app history window (e.g. 30–90 days) and/or cap rows per user, with a background prune. Unbounded growth bloats the feed query and Atlas free-tier storage. Low complexity; decide the number, prune in the digest cron. |
| Pull-to-refresh / pagination | Table stakes | Reuse cursor-pagination pattern already established (opaque base64 of `createdAt,_id`) for consistency. |
| Swipe-to-dismiss / delete a notification | Differentiator | Nice, not required v1.2. |
| Real-time update of badge while app open | Differentiator | Polling on foreground (AppState) is enough for v1.2; true realtime (websocket) is out of scope and not worth it at this scale. |

## Preferences & Permission UX

### Settings granularity
Apps with comprehensive preference controls see ~43% lower opt-out and ~31% higher engagement — so granularity directly serves the milestone goal.

| Control | Status | Notes |
|---|---|---|
| Master mute (pause all push) | Table stakes | One switch to silence everything without deleting subscriptions. In-app feed keeps recording. |
| Per-category toggles (Saved-search alerts / Watch alerts) | Table stakes | In spec ("per-category toggles"). Keep categories few (2–4). |
| Manage saved searches & watches (list, delete, edit cadence) | Table stakes | In spec (NotificationSettingsScreen). Users must be able to see and kill a subscription — orphaned alerts they can't find = rage opt-out. |
| Instant vs. daily per saved search | Table stakes | In spec. Default instant (see above). |
| Quiet hours (overnight suppression) | Table stakes (recommend promote) | Overnight push is the **#1 cited opt-out reason** and generates active resentment. Suppress non-urgent push during a quiet window; queue to morning or fold into digest. Use the existing **device-timezone→city** signal (no GPS) for a sensible default window. Medium complexity — but high payoff for "keep noise low." |
| Daily frequency cap (user-visible or silent) | Differentiator | The 2–3/day cap can be enforced silently; exposing it as a setting is optional. |
| In-app-only mode (notifications without push) | Table stakes (free) | This falls out of the architecture: a user who denies push still gets the full in-app center. Make sure the UI communicates "you'll still see these in the app." |
| Channel choice (email/SMS) | Anti-feature for v1.2 | Out of scope per spec (Twilio is OTP-only). Don't add. |

### Push permission UX (strongly evidence-backed)
| Practice | Status | Notes |
|---|---|---|
| **Never prompt on launch / during onboarding** | Table stakes | Firing on first launch is "the single biggest mistake." iOS allows the native prompt **once** — waste it and you've lost the user forever (only recoverable via Settings). |
| **Contextual trigger: first Watch / first Save-search** | Table stakes | In spec. User-triggered prompts hit ~89% opt-in vs. ~40–45% up-front on iOS. |
| **Soft pre-prompt before the native dialog** | Table stakes (recommend add) | A custom in-app primer ("Get alerted when the price drops?" + Allow / Not now) before calling the OS prompt lifts opt-in 2–3x and protects the one-shot native dialog. Only call the native prompt if the user taps Allow on the primer. Low complexity, high ROI. |
| Always offer "Not now" on the soft prompt | Table stakes | Lets you ask again later without burning the native prompt. |
| Re-engagement path if denied | Differentiator | If push is denied, the in-app center still works; optionally show a one-time "enable push in Settings" hint later. Don't nag. |

## Anti-Features (avoid)

| Anti-feature | Why avoid | Do instead |
|---|---|---|
| **Unfiltered "all new listings" firehose** | The classic spam trap; guarantees fatigue → opt-out, which kills the whole feature. | Every push is tied to a *user-created* subscription (saved search or watch). No broadcast-by-default. (Spec already implies this — keep it explicit.) |
| Marketing / broadcast / promo pushes | Out of scope per spec; also the category that drives 46% opt-out at just 2–5/week. | Transactional + subscription-only sends in v1.2. |
| Price-*increase* alerts on watched cars | Negative value to a buyer. | Direction-check the price hook: only on decrease. |
| Notifying on every edit (photos, description, minor field) | Pure noise; the thing dedup exists to suppress. | Notify only on the 4 locked lifecycle events; collapse the rest. |
| Notifying the actor about their own action | Seller gets pinged about their own price edit. | Spec guard: skip self. |
| Notifying about hidden/suspended/archived/deleted listings | Leaks moderation state; sends users to dead listings; violates the Phase 9 hide-hook contract. | All matching + sending passes through the hide-hook + moderation `status` (spec guard). |
| Daily-digest as the *default* cadence | Cars sell in hours; a digest-default product loses deals → users distrust alerts. | Instant default; daily is opt-in for broad searches. |
| Overnight push | #1 cited opt-out reason; generates resentment. | Quiet hours, queue to morning. |
| Re-prompting the native iOS permission dialog | iOS allows it once; re-asking is impossible and a denial is permanent. | Soft pre-prompt gates the native one. |
| Free-text / NLP saved searches | Large-platform investment (Cars.com Carson); matching engine cost balloons; out of proportion for v1.2. | Structured criteria only. |
| Seller-side notifications ("your listing got a watcher") | Out of scope per spec; different audience/value. | Domain supports it; defer as follow-on. |
| Unbounded notification history | Bloats feed query + free-tier storage. | Retention window + prune in the cron. |
| Shadow/silent suppression with no user control | Contradicts CarEx's transparency posture; drives distrust. | Visible settings: master mute + per-category + manage subscriptions. |

## Coverage Map (table stakes / differentiator / anti per category)

### Saved-Search Alerts
- **Table stakes:** make+model+price+year(±)+body criteria; one-tap "create alert from filters"; instant default; fire-once-per-match dedup; never-notify-actor; hide-hook respect; per-user daily cap (recommend promote).
- **Differentiator:** location/radius (blocked — no GPS), mileage range, "suggest daily for broad searches."
- **Anti:** unfiltered all-listings firehose; free-text/NLP search; digest-as-default.

### Watched-Item Alerts
- **Table stakes:** price-drop (decrease only), sold, booked — all instant; dedup repeated edits; correct car-id resolution.
- **Differentiator:** back-available (well-chosen for CarEx's booking model).
- **Anti:** price-increase alerts; new-photo/edit alerts.

### In-App Center
- **Table stakes:** bell+badge; feed; deep-link to item; mark-read + mark-all-read; unread/read styling; onboarding empty state; pagination/pull-refresh; history retention policy (recommend decide).
- **Differentiator:** day grouping; swipe-dismiss; live badge while open.
- **Anti:** unbounded history.

### Preferences & Permission UX
- **Table stakes:** master mute; per-category toggles; manage subscriptions; per-search cadence; quiet hours (recommend promote); in-app-only fallback; never-prompt-on-launch; contextual trigger; soft pre-prompt + "Not now."
- **Differentiator:** user-visible frequency cap; post-denial re-engagement hint.
- **Anti:** email/SMS channels; native re-prompting; shadow suppression.

## Regional note (KG / RU audience)
- **No user education needed for the primitives.** Avito/OLX (the dominant classifieds mental model in this market) already train users on "save favorites" + "saved search by criteria" + push on matches. CarEx's two primitives map 1:1.
- **i18n correctness over translation count.** RU-first/EN parity is locked; the regional risk is wording, not coverage — use KGS som (not ruble), local automotive terms (техпаспорт not ПТС, ГАИ not ДПС per audience memory), and the audience tolerates a sharper, less-corporate notification tone than US defaults.
- **Quiet-hours default from device timezone, not GPS.** CarEx's only location signal is device-timezone→city; reuse it to set a sane overnight quiet window per user rather than building location infra.
- **No regional throttling complexity.** Listing volume in a single regional market is modest, so the match-engine cost and daily-cap concerns are real-but-bounded — indexed criteria fields (spec) are sufficient; revisit only if volume grows.
- **Confidence:** LOW on Avito-Kyrgyzstan specifics (search didn't surface platform internals); MEDIUM-HIGH on the general Avito/OLX-family pattern, which is well-attested.

## Sources
- [How to get used car alerts — Flipify](https://www.flipifyapp.com/blog/how-to-get-used-car-alerts)
- [Best Facebook Marketplace Monitoring Tools 2026 — CarSnipe](https://carsnipe.com/blog/facebook-marketplace-monitoring-tools)
- [3-Minute Facebook Marketplace Car Alerts — CarSnipe](https://carsnipe.com/blog/best-app-facebook-marketplace-car-alerts)
- [AutoTempest email alerts](https://blog.autotempest.com/2021/07/12/autotempests-new-email-alerts-bring-a-nationwide-used-car-search-to-your-inbox)
- [My Autotrader help (daily/weekly alerts)](https://www.autotrader.com/help/my-autotrader)
- [Carson open-text search — Cars.com](https://www.carscommerce.inc/carson-open-text-search/)
- [How to get price drop alerts — Settlemate](https://www.settlemate.io/blog/how-to-get-price-drop-alerts)
- [eBay Alerts: price drops & rare listings — Swoopa](https://getswoopa.com/ebay-alerts/)
- [OLX — Wikipedia (OLX Group / Avito family)](https://en.wikipedia.org/wiki/OLX)
- [Notification Drawer design guidelines — PatternFly](https://www.patternfly.org/components/notification-drawer/design-guidelines/)
- [Notification Badge design guidelines — PatternFly](https://www.patternfly.org/components/notification-badge/design-guidelines/)
- [How to Build a Notification Center — Courier](https://www.courier.com/blog/how-to-build-a-notification-center-for-web-and-mobile-apps)
- [Notifications UI design — Setproduct](https://www.setproduct.com/blog/notifications-ui-design)
- [How to Improve Push Opt-In Rates — Plotline](https://www.plotline.so/blog/how-to-improve-push-notification-opt-in-rates)
- [iOS Push Permission Best Practices — Hurree](https://blog.hurree.co/ios-push-notification-permissions-best-practises)
- [Increase iOS Push Opt-in — OneSignal](https://onesignal.com/blog/how-to-create-more-compelling-opt-in-messages-for-ios-push/)
- [Why Users Opt Out of Push — Sashido](https://www.sashido.io/en/blog/push-notification-opt-outs-real-reasons-users-say-no)
- [Push Frequency Sweet Spot — Retenshun](https://retenshun.com/blog/push-notification-frequency-sweet-spot)
- [Reduce Notification Fatigue — Courier](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas)
- [Avito (classifieds, save favorites + notifications) — Google Play](https://play.google.com/store/apps/details?id=com.avito.android)
- [Top Shopping Apps Kyrgyzstan — Appfigures](https://appfigures.com/top-apps/google-play/kyrgyzstan/shopping)

**Confidence levels:** Car-deal speed / instant-vs-digest (MEDIUM, multiple consistent sources). Fatigue caps / quiet hours / opt-out drivers (MEDIUM-HIGH, multiple cross-agreeing sources). iOS contextual-prompt opt-in stats (MEDIUM-HIGH, multiple sources agree on direction and rough magnitude). In-app center UX (MEDIUM, design-system + vendor guidance). Regional KG specifics (LOW). All findings are WebSearch-derived (no Context7 — this is a UX/product-behavior question, not a library API question), so individual percentages should be treated as directional, not exact.
