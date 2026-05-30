---
slug: android-photo-load-lag
status: fix_applied
trigger: "android users report some lag when opening the photos. Photos load and render, but the experience is the same as when internet connection is bad. iOS did not report that issue."
created: 2026-05-29
updated: 2026-05-29
---

# Debug Session: android-photo-load-lag

## Symptoms

- **Expected behavior:** Photos open snappily on Android — same as iOS — when viewing a car's gallery or the full-screen zoom viewer.
- **Actual behavior:** Photos are slow to first appear: blank/placeholder for a beat, then pop in — feels like a slow network download even on good connections. Images do eventually load and render correctly.
- **Error messages:** None reported.
- **Timeline:** Recent regression. Photo opening used to feel smooth on Android; it degraded after a recent app update/change.
- **Reproduction:** Open a car's image gallery on the CarDetails screen and/or tap a photo to open the full-screen zoom viewer. Android only — iOS does not exhibit the issue.

## Platform scoping

- Android: affected (slow-to-appear)
- iOS: NOT affected

## Current Focus

- hypothesis: "Latency-to-first-appear on Android is caused by OkHttp dispatcher saturation: CarDetailsScreen mounts ALL gallery/zoom images at once (no virtualization), so 10-25 S3 GETs queue behind RN's shared OkHttpClient limit of 5 requests/host. The relevant slide can't even start fetching until earlier-queued offscreen images drain. This is the deferred 'Fix B' (gallery virtualization) from the prior listing-images-blank-android session — the shipped 'Fix A' (retry-on-error) and 'Fix C' (upload shrink) addressed permanent blanks but not concurrency latency, and Fix C only helps NEW uploads. iOS uses SDWebImage with different concurrency defaults, so it is unaffected."
- next_action: "Surface root cause + fix options to user."
- reasoning_checkpoint: "Root cause confirmed against current code + prior session prior art."
- test: "Read OptimizedImage.tsx, CarDetailsScreen image-mount sites, prior debug session, FastImage Android internals, confirm no priority/virtualization mitigation exists. DONE."
- expecting: "Confirm all images mount simultaneously, no FastImage priority set, no FlatList windowing on carousel/zoom/gallery, prior Fix B explicitly deferred."

## Evidence

- timestamp: 2026-05-29T00:01Z
  finding: "Prior debug session listing-images-blank-android (commit 359d768, resolved 52111c3) diagnosed the SAME underlying Android mechanism: react-native-fast-image rides RN's shared OkHttpClient (FastImageOkHttpProgressGlideModule.java:43) with default Dispatcher.maxRequestsPerHost=5 + 10s timeouts. With 10-25 images targeting the same *.s3.amazonaws.com host, 20+ GETs queue. That session's symptom was PERMANENT blanks; the current symptom is LATENCY (blank-then-pop). Same cause, different surface."
  evidence_file: ".planning/debug/listing-images-blank-android.md (full prior root-cause), git show 359d768"

- timestamp: 2026-05-29T00:02Z
  finding: "Prior fix shipped THREE parts but deferred two. Applied: Fix A (OptimizedImage.tsx retry-on-error with ?_retry=N cache-busting URL) + Fix C (SellCarScreen picker maxWidth/maxHeight 2048, quality 0.8). DEFERRED: Fix B (gallery virtualization / FlatList windowing to bound concurrent FastImage mounts) and Fix D (backend multer-s3 ACL/contentType). The commit message explicitly says 'Gallery virtualization (Fix B) ... deferred — to revisit if blanks persist.'"
  evidence_file: "git show 359d768 (commit body), src/components/OptimizedImage.tsx:13-57, src/screens/SellCarScreen.tsx:259-262"

- timestamp: 2026-05-29T00:03Z
  finding: "CarDetailsScreen mounts ALL images simultaneously at three sites with NO virtualization: (1) hero carousel — horizontal ScrollView with images.map at line 612-621; (2) full-screen zoom viewer — horizontal ScrollView with images.map wrapping <Zoomable><OptimizedImage> at line 1075-1090; (3) gallery grid modal — vertical ScrollView with images.map at line 1122-1134. Sites (1) and (2) use removeClippedSubviews on Android (helps offscreen unmount AFTER layout) but site (3) does NOT. None use FlatList windowing (windowSize/initialNumToRender). All N OptimizedImage children mount on screen open, firing N concurrent S3 GETs into the 5-per-host OkHttp queue."
  evidence_file: "src/screens/CarDetailsScreen.tsx:602-636 (carousel), :1065-1091 (zoom), :1117-1135 (gallery grid)"

- timestamp: 2026-05-29T00:04Z
  finding: "No FastImage priority/preload/cacheControl tuning anywhere in src (grep for priority|preload|cacheControl across *.ts/*.tsx returned nothing). OptimizedImage passes no priority, so every image is FastImage.priority.normal — there is no way for the currently-viewed slide to jump the OkHttp queue ahead of offscreen images. The active zoom image waits behind whatever queued first."
  evidence_file: "grep priority|preload|cacheControl --include=*.tsx src/ (no matches), src/components/OptimizedImage.tsx:46-52"

- timestamp: 2026-05-29T00:05Z
  finding: "Fix A's retry mechanism is a latency AMPLIFIER for the current symptom. On a queued request that hits the 10s OkHttp read timeout, OptimizedImage.onError fires, increments retryCount, and re-renders with ?_retry=1 — a brand-new URL that Glide treats as a fresh resource, bypassing all cache and going to the BACK of the same saturated queue. Under dispatcher saturation this converts a permanent-blank into a slow-blank-then-pop (exactly the reported feel) but can add a full timeout cycle before the image appears. Two retries = up to ~20s added latency on the worst slots."
  evidence_file: "src/components/OptimizedImage.tsx:30-52 (retryCount + cache-busting URL)"

- timestamp: 2026-05-29T00:06Z
  finding: "Platform asymmetry confirmed by library defaults: iOS FastImage uses SDWebImage (independent download queue with higher default concurrency and built-in retry), NOT RN's OkHttpClient. So the 5-per-host bottleneck and the retry-requeue amplification are Android-only. This matches 'iOS NOT affected'."
  evidence_file: "Prior session evidence 2026-04-30T00:05Z/00:06Z, react-native-fast-image Android FastImageOkHttpProgressGlideModule.java vs iOS SDWebImage backend"

- timestamp: 2026-05-29T00:07Z
  finding: "Regression timeline matches. Fix A landed in 359d768 (2026-04-30) and shipped in subsequent version bumps. Before Fix A, Android had no onError retry — images either loaded or stayed permanently blank (the OLD bug). After Fix A, the same saturated slots now retry-then-eventually-appear, changing the felt symptom from 'blank forever' to 'slow to appear / feels like bad connection' = the recent regression the user describes."
  evidence_file: "git log 359d768..HEAD version bumps, commit dates"

## Eliminated

- "Network / connection quality" — user confirms good connection; iOS on same network is fine. The bottleneck is client-side request concurrency, not bandwidth.
- "react-native-image-zoom (Zoomable) overhead" — Zoomable only wraps an already-mounted OptimizedImage; the latency is in the image FETCH (blank placeholder beat), not in gesture/render. Zoom viewer is affected because it mounts all N images, same as the carousel.
- "EXIF/decode cost" — symptom is 'slow to first appear like a download', not decode jank; matches a network-queue stall, not CPU decode.
- "Backend / S3 slowness" — would affect iOS equally. iOS is unaffected, so the differentiator is the Android OkHttp dispatcher, not the server.

## Resolution

- root_cause: |
    Android-only photo-open latency is caused by OkHttp dispatcher saturation in the
    CarDetailsScreen image surfaces. react-native-fast-image on Android fetches through
    React Native's shared OkHttpClient, which defaults to maxRequestsPerHost=5. The
    hero carousel (line 612), full-screen zoom viewer (line 1075), and gallery grid
    (line 1122) each mount ALL of a listing's 10-25 images at once with NO virtualization
    and NO FastImage priority. So opening the gallery fires 10-25 concurrent GETs at the
    same S3 host; only 5 run at a time and the rest queue. The image the user is actually
    looking at cannot jump the queue (no priority set), so it waits behind offscreen
    images — producing the blank-placeholder-then-pop "feels like a bad connection" delay.

    This is the gallery-virtualization fix ("Fix B") that was explicitly DEFERRED in the
    prior listing-images-blank-android session (commit 359d768). That session shipped
    Fix A (retry-on-error with cache-busting URL) and Fix C (shrink NEW uploads). Fix A
    actually converted the old "blank forever" symptom into the current "slow-then-appear"
    symptom — on a timed-out queued request it re-queues a fresh ?_retry=N URL at the back
    of the same saturated queue, adding up to a full 10s timeout cycle before the image
    shows. Fix C only helps newly-uploaded listings; existing full-resolution listings
    still pay full per-image download cost. iOS is unaffected because FastImage there uses
    SDWebImage with a separate, higher-concurrency download queue.
  fix: |
    APPLIED 2026-05-29 — quick-win subset (B1 + B3); B2 virtualization deliberately
    deferred (overlaps with B1's benefit; higher regression risk — revisit only if
    device testing shows residual latency).

    B1 (FastImage priority): OptimizedImage now accepts a `priority` prop and injects
    it into the FastImage source. CarDetailsScreen's `imagePriority(index)` helper maps
    proximity to the active slide → priority: active = high, immediate neighbour = normal,
    rest = low. Wired into the hero carousel (CarDetailsScreen.tsx:619) and the
    full-screen zoom viewer (:1083). The image the user is viewing now jumps ahead of
    offscreen fetches in the OkHttp queue.

    B3 (retry de-amplification): OptimizedImage's onError retry now waits RETRY_DELAY_MS
    (600ms) before re-rendering the cache-busted ?_retry=N URL, instead of immediately
    re-queuing onto a saturated queue. Timer is cleared on unmount and on uri change.
    Preserves the original blank-fix (still retries up to MAX_RETRIES) without the
    stampede that converted "blank-forever" into "slow-then-pop".

    NOT applied (held as follow-ups):
    B2) Virtualize the three surfaces to FlatList windowing (windowSize=2,
        initialNumToRender=2). Bounds total concurrent fetches; revisit if needed.
    D)  Backend multer-s3 cacheControl/contentType hardening (still open from prior session).

    Original recommendation (in leverage order):
    B1) Add FastImage priority to OptimizedImage and pass priority.high for the
        active/visible slide, priority.low for offscreen — lets the viewed image
        jump the OkHttp queue. Smallest change, directly targets the felt latency.
    B2) Virtualize the three image surfaces: convert the carousel (line 612),
        zoom viewer (line 1075), and gallery grid (line 1122) from ScrollView+map
        to FlatList with windowSize=2, initialNumToRender=2, removeClippedSubviews.
        Bounds concurrent fetches to ~5-7 instead of 10-25.
    B3) (optional) Cap retry amplification: skip the ?_retry requeue on timeout-class
        errors, or only retry the visible slide, so retries don't pile onto the queue.
    D) (deferred, backend) multer-s3 cacheControl/contentType hardening — still open
        from prior session; improves CDN/OkHttp cacheability but not the core latency.
  verification: |
    Release-build real-device test on Android (FastImage/Glide behavior differs in
    Metro debug):
      1. Open an EXISTING listing with 20+ images. With priority+virtualization, the
         visible carousel slide and the first zoom image should appear within ~1s,
         not after a multi-second blank.
      2. Swipe rapidly through the carousel/zoom — each new slide should fetch promptly
         (it's now high-priority + few competing concurrent requests).
      3. iOS smoke test — confirm no regression.
      4. Confirm offscreen images still eventually load (windowing must not strand them).
  files_changed:
    - src/components/OptimizedImage.tsx (added `priority` prop + injected into FastImage source; delayed/staggered retry via RETRY_DELAY_MS with unmount-safe timer)
    - src/screens/CarDetailsScreen.tsx (FastImage import; imagePriority() helper; priority passed at carousel :619 and zoom viewer :1083)
  verification_status: |
    PENDING manual device test. Lint clean on both changed files (pre-existing
    CarDetailsScreen warnings/errors unchanged). tsc: no new errors (only pre-existing
    test-file errors). CarDetailsScreen jest suites fail identically on clean HEAD
    (FavoritesProvider harness issue) — not caused by this change. FastImage priority
    behaviour cannot be validated in Metro/jest; needs a real-device Android RELEASE build
    per the verification steps above.
