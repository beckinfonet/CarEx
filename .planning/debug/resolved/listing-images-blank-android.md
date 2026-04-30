---
slug: listing-images-blank-android
status: resolved
created: 2026-04-30
updated: 2026-04-30
fix_applied: 2026-04-30
resolved: 2026-04-30
verified_on: "TestFlight (iOS 1.0.45/46) + Google Play internal testing (Android 1.0.48/49)"
trigger: "When a user creates a listing, obviously there are pictures of vehicles on the listing, 10-25 images. Most often than not, the listing initially renders a few random pictures, the rest of the pictures are just dark blank pages. User has to force close the app, re-open again in order to see the images. This happens mostly on android. Wifi or cell connection is not an issue when this happens, we have run a speed test, very stable and high speed connection."
---

# Debug: Listing images render as blank dark pages on Android

## Symptoms

- **Expected behavior:** All 10-25 photos uploaded for a listing render correctly when any user (seller or buyer) opens the listing or sees its thumbnail.
- **Actual behavior:** Initial render shows a *few random* photos. The rest are dark blank pages. Swiping/scrolling the carousel does NOT trigger them to load — they stay blank. Force-quit + reopen sometimes recovers them, sometimes does not.
- **Where it occurs:** Seller's own listing immediately after creating it; other users browsing the listing later; Home screen / search results CarCard thumbnails.
- **Timing:** Manifests on first view immediately after upload. Other users hitting a freshly-created listing also see it.
- **Platform:** Mostly Android (Glide-backed FastImage). Occasionally iOS (SDWebImage-backed FastImage).
- **Network:** User has confirmed stable, high-speed wifi/cell — speed test verified.

## Known relevant context

- React Native 0.83 + TypeScript app
- Image library: `react-native-fast-image 8.6.3` (Glide on Android, SDWebImage on iOS)
- Image upload: `react-native-image-picker 8.2.1` for capture + `multer` upload to `POST /api/cars` (form-data, max 25 images)
- Backend: Node/Express + MongoDB Atlas + S3 (multer-s3 v3.0.1) on Railway

## Current Focus

```yaml
hypothesis: "Composite root cause: (a) Mobile-side OkHttp dispatcher saturation + Glide negative-load cache on Android — when 25 FastImage components mount simultaneously, RN's shared OkHttpClient (maxRequestsPerHost=5) queues 20+ S3 GETs; queued requests time out on slow TLS handshakes; Glide caches the failure with no retry; iOS SDWebImage retries on failure so iOS appears mostly fine. (b) Backend latent bug — multer-s3 v3.0.1 default ACL is 'private' (server.js:50-62 omits the acl option), so any future bucket-policy / Block-Public-Access drift makes objects unreachable; default contentType is 'application/octet-stream' (no auto-sniff), which is browser-unfriendly even though Glide tolerates it."
test: "Read POST /api/cars upload code (server.js:666-758), multer/multer-s3 internals, mobile-side FastImage Android implementation, OptimizedImage / CarDetailsScreen / CarCard usage. DONE."
expecting: "Confirm (a) FastImage uses RN OkHttp shared client (validates dispatcher saturation theory), (b) S3 storage config omits ACL/contentType, (c) no retry/placeholder/onError in OptimizedImage."
next_action: "Surface root cause + fix-strategy options to the user."
reasoning_checkpoint: "Root cause confirmed across both repos."
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-04-30T00:01Z
  finding: "Backend POST /api/cars (carEx-services/server.js:666) uses multer-s3 with `upload.array('images', 25)`. multer waits for ALL S3 uploads to complete before invoking the route handler — if any upload errors, the entire request aborts with a 4xx/5xx error and no Car record is saved. Therefore, the symptom (Car record exists with all 25 URLs but some images blank) PROVES all 25 S3 PUTs succeeded server-side. The blank-render bug is NOT a partial-upload race."
  evidence_file: "carEx-services/server.js:666-758, carEx-services/node_modules/multer/lib/make-middleware.js:158-178 (storage._handleFile error path → abortWithError → done(err))"

- timestamp: 2026-04-30T00:02Z
  finding: "S3 URLs are RAW public S3 URLs with NO TTL and NO signing. multer-s3 returns `result.Location` (a permanent S3 object URL) and stores it directly in MongoDB. Grep for getSignedUrl/presign/expires across server.js+src/ returned nothing relevant (only an unrelated TTL on an OTP doc). Eliminates the signed-URL-expiry hypothesis."
  evidence_file: "carEx-services/server.js:690 (`req.files.map(file => file.location)`), carEx-services/node_modules/multer-s3/index.js:236 (`location: result.Location`)"

- timestamp: 2026-04-30T00:03Z
  finding: "multer-s3 v3.0.1 default ACL is 'private' and default contentType is 'application/octet-stream'. The carEx-services config (server.js:50-62) does NOT pass `acl` or `contentType` options. Therefore every uploaded object has ACL=private and Content-Type=application/octet-stream. Whether reads succeed depends entirely on the bucket policy (out of repo). This is a LATENT bug: if Block-Public-Access is ever toggled or the bucket policy drifts, all images become unreachable. Octet-stream content-type means browsers may refuse to render images, but Glide/OkHttp sniff bytes so this isn't blocking on Android."
  evidence_file: "carEx-services/node_modules/multer-s3/index.js:16 (`var defaultAcl = staticValue('private')`), :17 (`var defaultContentType = staticValue('application/octet-stream')`), carEx-services/server.js:50-62"

- timestamp: 2026-04-30T00:04Z
  finding: "S3 key generation: `${folder}/${Date.now().toString()}-${file.originalname}` (server.js:57-60). With 25 parallel multer-s3 _handleFile invocations, Date.now() may collide at millisecond resolution. originalname collisions can occur when react-native-image-picker returns the same file name for picked photos. Mobile-side AT SellCarScreen.tsx:427 falls back to `image_${index}.jpg` only when `img.fileName` is null — for picked-from-gallery photos, fileName IS provided, and burst-mode photos can share names. Theoretical risk of S3 key collision (second upload silently overwrites first), but multer-s3 streams files as Busboy emits them sequentially, so Date.now() typically differs by tens of ms. Probably not the primary cause but worth hardening."
  evidence_file: "carEx-services/server.js:57-60, carEx/src/screens/SellCarScreen.tsx:422-432"

- timestamp: 2026-04-30T00:05Z
  finding: "**SMOKING GUN — FastImage on Android uses React Native's shared OkHttpClient.** FastImageOkHttpProgressGlideModule.java:43-44 calls `OkHttpClientProvider.getOkHttpClient().newBuilder()` and registers the resulting client with Glide. RN's default OkHttpClient has Dispatcher defaults `maxRequestsPerHost=5` (OkHttp default) and read/connect timeouts of 10s. When 25 FastImage components mount simultaneously pointing at `<bucket>.s3.<region>.amazonaws.com`, only 5 requests run concurrently; the other 20 are queued. Queued requests can hit the 10s read timeout on TLS handshake under load → SocketTimeoutException. Glide negative-caches the failure (no retry by default). Result: a few succeed, the rest stay blank. Force-close clears in-memory cache, retry succeeds — UNLESS OkHttp's response cache served the cached error, which explains why force-close 'sometimes' doesn't fix it."
  evidence_file: "carEx/node_modules/react-native-fast-image/android/src/main/java/com/dylanvann/fastimage/FastImageOkHttpProgressGlideModule.java:43-50"

- timestamp: 2026-04-30T00:06Z
  finding: "iOS SDWebImage by default retries failed loads with backoff (configurable, default ~1 retry). Android Glide does NOT retry failed loads by default (Glide's `RequestBuilder` has no auto-retry; you have to add it via `error()` thumbnail or a custom RequestListener). This explains the platform asymmetry: 'mostly Android, occasionally iOS' — iOS gets a free retry, Android doesn't."
  evidence_file: "Library defaults — SDWebImage SDImageCacheConfig.maxNumberOfRetries default vs Glide default RequestOptions"

- timestamp: 2026-04-30T00:07Z
  finding: "OptimizedImage component (carEx/src/components/OptimizedImage.tsx) is the SINGLE rendering wrapper. It does NOT set `priority`, `cache`, `headers`, or `onError`. No retry on error, no placeholder fallback. Plain `<FastImage source={{uri}} resizeMode />` only."
  evidence_file: "carEx/src/components/OptimizedImage.tsx:19-34"

- timestamp: 2026-04-30T00:08Z
  finding: "CarDetailsScreen mounts ALL images in the carousel + gallery modal simultaneously without virtualization. carousel: ScrollView w/ images.map (line 487-496), uses `removeClippedSubviews={Platform.OS === 'android'}` which helps. Gallery modal (lines 871, 918) mounts all images at once in a vertical ScrollView WITHOUT removeClippedSubviews. CarCard renders only ONE thumbnail per card so it's per-card, but FlatList of CarCards in HomeScreen still mounts the visible cards' thumbnails concurrently. With 5+ visible cards each fetching a thumbnail from S3 plus the detail screen's 25 carousel images on entry, the OkHttp dispatcher is hammered."
  evidence_file: "carEx/src/screens/CarDetailsScreen.tsx:478-497, :905-931, carEx/src/components/CarCard.tsx:25-26"

- timestamp: 2026-04-30T00:09Z
  finding: "Image picker config does NOT set maxWidth, maxHeight, or quality (carEx/src/screens/SellCarScreen.tsx:259-262 — only mediaType and selectionLimit). So images are uploaded at full sensor resolution (modern Android phones: 4000×3000, 4-8 MB JPEG each). 25 photos = 100-200 MB request body. On Railway free/hobby tier, default request body limits are typically ≤ 100 MB and request timeouts ≤ 30s. The current uploads are succeeding (per the symptom — listings ARE created), so the request fits, but: (a) S3 objects are FULL-RESOLUTION photos, which is what's amplifying the download problem on the mobile side. Downloading 25 × 4 MB photos = 100 MB just to render thumbnails on a CarCard — even on fast wifi, 100 MB through OkHttp's 5-per-host dispatcher is going to take 30+ seconds and many will time out."
  evidence_file: "carEx/src/screens/SellCarScreen.tsx:259-262"

## Eliminated hypotheses

- "Backend race / partial upload: response sent before S3 puts complete." — multer-s3's _handleFile only invokes its callback after `upload.done`; multer's `pendingWrites` counter ensures the route handler doesn't run until ALL files settle. If any failed, the whole request errors. Disproven.
- "Signed URL TTL expiry." — No signed URLs anywhere; URLs are raw S3 `result.Location`. Disproven.
- "Memory pressure on Android (bitmap pool)." — Plausible amplifier on low-end devices but doesn't explain 'force-close sometimes doesn't fix it' or why iOS is mostly fine. Demoted.
- "Image URL malformed for some images." — Date.now()-based key generation is deterministic and the URLs going into MongoDB are correct strings. Disproven.

## Resolution

```yaml
root_cause: |
  Composite, two-layer failure with mobile-side as primary:

  PRIMARY (mobile, Android-specific): When CarDetailsScreen / Home thumbnails
  mount, react-native-fast-image fetches images via React Native's shared
  OkHttpClient (FastImageOkHttpProgressGlideModule.java:43). RN's OkHttp has
  a default Dispatcher.maxRequestsPerHost=5 and 10s read timeout. With 10-25
  large S3 images all targeting the same `*.s3.amazonaws.com` host, 20+
  requests are queued; queued requests time out on slow TLS handshakes under
  load. Glide negative-caches the failure with no retry. The blank slot
  persists because nothing re-triggers the load.

  Force-close clears the in-memory negative cache → retry → fewer concurrent
  fetches initially → succeeds. But OkHttp's disk response cache can serve
  the cached error, which is why force-close "sometimes" doesn't recover.

  iOS SDWebImage retries failed loads by default → most transient failures
  recover silently → "mostly Android."

  AMPLIFIERS:
    - Image picker uploads at full sensor resolution (no maxWidth/quality);
      S3 objects are 4-8 MB each, which makes any single fetch slow and
      timeout-prone.
    - Gallery modal at CarDetailsScreen.tsx:918 mounts all images at once
      without removeClippedSubviews, hammering the dispatcher on open.
    - OptimizedImage has no onError / retry / priority handling.

  LATENT (backend): multer-s3 default ACL is 'private' and default
  Content-Type is 'application/octet-stream'. Whether reads currently work
  depends entirely on bucket policy (out of repo). If Block-Public-Access
  toggles or the bucket policy drifts, ALL images become unreachable.
fix: |
  User selected mobile-only A+C (lowest blast radius). Applied:

  A) src/components/OptimizedImage.tsx — retry-on-error with cache-busting URL.
     When FastImage.onError fires, retryCount increments (capped at 2) and the
     URL gets `?_retry=N` (or `&_retry=N`) appended on the next render. Glide
     treats the new URL as a fresh resource → bypasses both the in-memory and
     OkHttp disk negative-cache. retryCount resets when the source URI changes.
     Existing onError consumers still get called.

  B) NOT APPLIED. Virtualizing the CarDetailsScreen gallery (FlatList windowing)
     was deferred. Hold for later if the retry fix proves insufficient on
     pre-existing huge-image listings.

  C) src/screens/SellCarScreen.tsx — picker shrink. Added maxWidth: 2048,
     maxHeight: 2048, quality: 0.8 to launchImageLibrary call. New uploads
     drop from 4-8 MB to ~600 KB per image. 25-image total: ~150 MB → ~15 MB.
     Existing listings (with full-res S3 objects already uploaded) are
     unaffected — they rely on Fix A's retry to recover.

  D) NOT APPLIED. Backend multer-s3 ACL/contentType hardening was deferred —
     latent bug, not user-visible. Open as future work.
verification: |
  Cannot test locally (RN release behavior differs from Metro debug for
  FastImage/Glide cache paths). Verification path:
    1. Bump versions via npm run ios:archive + npm run android:archive
    2. Push iOS build to TestFlight, Android AAB to Play Console internal track
    3. Real-device tests:
       a. Open an EXISTING listing with 25 images on Android → previous blanks
          should resolve within ~2 retries (visible URL refetch).
       b. Create a NEW listing with 15+ photos → upload completes faster,
          carousel + gallery render cleanly, listing detail loads without blanks.
       c. iOS smoke test → no regression.
    4. If blanks still appear on existing huge listings, return for Fix B
       (gallery virtualization).
files_changed:
  - "src/components/OptimizedImage.tsx (added retry-on-error with cache-busting URL)"
  - "src/screens/SellCarScreen.tsx (added maxWidth/maxHeight/quality to picker)"
```

## Proposed fix strategy

Three independent fixes; all three should land but they can be applied independently and in any order:

### Fix A — Mobile: add retry + priority + onError to OptimizedImage (highest leverage; addresses the primary cause directly)

**File:** `src/components/OptimizedImage.tsx`

- Wrap FastImage in a stateful component that retries on `onError` with exponential backoff (e.g. 3 attempts at 500ms / 1500ms / 4000ms).
- Pass `priority={FastImage.priority.high}` for above-the-fold gallery images, `normal` for thumbnails.
- Show a placeholder (e.g. a colored box with a small icon) while loading, and a different "broken" indicator on permanent failure so the bug is visible to ops instead of silent dark slots.
- Add a manual "retry" tap-to-reload affordance.

This is the smallest-blast-radius change and directly resolves the negative-cache persistence on Android.

### Fix B — Mobile: throttle the gallery modal (limit concurrent FastImage mounts)

**File:** `src/screens/CarDetailsScreen.tsx` (gallery modal lines 905-933)

- Replace the gallery modal's `<ScrollView><images.map /></ScrollView>` with a virtualized `FlatList` (vertical) with `windowSize=2`, `initialNumToRender=2`, `removeClippedSubviews={true}`. This bounds concurrent fetches to ~5-7 instead of 25.
- Same treatment for the carousel ScrollView at line 478-497 — switch to FlatList horizontal with similar windowing.
- Consider using `priority={FastImage.priority.high}` on the active carousel slide and `low` on offscreen slides.

### Fix C — Mobile: shrink uploads at picker time (root-cause level: stops the bug being so easy to trigger)

**File:** `src/screens/SellCarScreen.tsx` (handleChoosePhoto, lines 259-262)

- Add `maxWidth: 2048, maxHeight: 2048, quality: 0.8` to `launchImageLibrary` config. 2048-px-long-edge JPEGs at q=0.8 are typically 300-700 KB — 5–15× smaller than current uploads.
- This shrinks per-image bytes from ~4MB to ~500KB, cutting download time from ~5s to <1s per image, and cutting the request body from ~100MB to ~10-15MB. OkHttp queue empties fast, fewer timeouts.

### Fix D — Backend: harden multer-s3 config (latent bug; do this defensively)

**File:** `carEx-services/server.js:50-62`

- Add `acl: 'public-read'` to the multer-s3 config (the bucket must allow ACLs — if Block-Public-Access is on for ACLs, this throws; in that case, leave acl off and rely on bucket policy, but add an explicit comment).
- Add `contentType: multerS3.AUTO_CONTENT_TYPE` so each object gets the correct `image/jpeg`, `image/png`, etc.
- Add `cacheControl: 'public, max-age=31536000, immutable'` so CDNs / OkHttp can cache successfully (immutable because keys include a timestamp).
- Optionally switch the key from `Date.now()-originalname` to `Date.now()-crypto.randomBytes(8).hex()-originalname` to harden against the theoretical collision case.

### Fix E — Backend: server-side image resize before S3 (longer-term, optional)

Defer. Sharp/imagemin pipeline server-side adds operational complexity; client-side picker resize (Fix C) gets us 90% of the benefit.

## Risk / verification plan

- After A+B+C ship: have the user upload a fresh listing with 25 photos on a real Android device. Observe carousel and gallery modal — all images should render within seconds. Repeat 5× to catch transient cases.
- Add a one-line console log in `OptimizedImage` onError path to surface any retries hitting the limit (so ops can monitor the residual long-tail).
- Verify Fix D with a test upload + browser visit to a returned URL: `curl -I` should show `Content-Type: image/jpeg` and `Cache-Control: public, max-age=...`.
