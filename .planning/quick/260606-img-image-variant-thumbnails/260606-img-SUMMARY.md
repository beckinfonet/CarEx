---
quick_id: 260606-img
slug: image-variant-thumbnails
status: complete
date: 2026-06-06
subsystem: images / uploads
cross_repo: true
commits:
  backend: 6fa0175   # carEx-services @ feature/image-variant-pipeline
  mobile: d33903a    # carEx @ quick/image-variant-thumbnails
requirements: [IMG-OPT-01]
---

# Quick Task 260606-img: Server-side image variant pipeline + mobile thumbnail consumption

Implemented the deferred **"Fix E"** (server-side image resize) from
`.planning/debug/resolved/listing-images-blank-android.md`. The root complaint —
feed/list cards downloading full-screen-size photos — is fixed by generating a
small thumbnail variant at upload time and rendering it on cards. User decisions:
**Option 1 (sharp variant pipeline)**, **new uploads only** (no backfill),
**scope both repos**.

## What Was Done

### Backend — carEx-services @ `feature/image-variant-pipeline` (off `origin/main`), commit `6fa0175`
- **`package.json`**: added `sharp@^0.33.5`.
- **`src/uploads/carImages.js`**:
  - Left the existing `multer-s3` `upload` export **unchanged** — the admin
    moderation Edit route and avatar upload depend on its `file.location`/`file.key`
    and WR-01 orphan-cleanup invariants. Zero blast radius on the moderation system.
  - Extracted the CR-02 sanitizers (`resolveFolder`, `imageFileFilter`,
    `UPLOAD_LIMITS`) so both paths stay single-source.
  - Added `uploadMemory` (memory storage, same fileFilter + limits) and
    `processAndUploadCarImages(files, bodyType)` — sharp resizes each upload into
    `full` (~1600px, q82) + `thumb` (~400px, q70) progressive JPEGs, uploaded via
    `PutObjectCommand` with `Cache-Control: public, max-age=31536000, immutable`.
    Collision-hardened keys (`Date.now` + 6 random bytes). Per-file graceful
    fallback: an undecodable source uploads the original once and points both
    variants at it, so one bad image never fails the whole listing.
- **`src/models/Car.js`**: added index-aligned `thumbnailUrls: [String]`.
- **`server.js`**: `POST /api/cars` + `PUT /api/cars/:id` now use `uploadMemory`
  and the helper, persisting `thumbnailUrls`. POST runs the helper **after**
  make/model validation (fewer orphaned S3 objects than the old multer-s3 path).
  PUT rebuilds `thumbnailUrls` aligned to kept + new images (kept images map back
  to their stored thumb, falling back to the full URL for pre-variant listings).
- **`__tests__/uploads/carImages.test.js`**: 6 tests (real sharp, mocked S3) —
  full+thumb generation, order/index alignment, no-files no-op, decode-failure
  fallback, sanitizer units. **6/6 passing.**

### Mobile — carEx @ `quick/image-variant-thumbnails`, commit `d33903a`
- Redirected the card `image` derivation to prefer `thumbnailUrls[0]`, falling
  back to `imageUrls[0]` → `imageUrl` → placeholder, in the four list/feed mapping
  spots (`useHomeListings`, `MyListingsScreen`, `SellerListingsScreen`,
  `FavoritesScreen`) and the `CarDetailsScreen` header fallback.
- **`CarDetailsScreen` gallery (`images = car.imageUrls`) intentionally left on
  the full variant.** Only one chokepoint per surface needed changing — the v2
  card components consume the already-mapped `image` field, so no card component
  was touched.

## Verification
- Backend: `npm test` → only the 2 pre-existing `ServiceOrder.providerSnapshot`
  failures remain (confirmed identical on clean `origin/main` via throwaway
  worktree — unrelated to this change). New carImages suite 6/6 green.
- Mobile: `tsc --noEmit` and `eslint` on the 5 changed files show **no new**
  errors — only pre-existing test-file tsc noise and pre-existing
  `exhaustive-deps`/inline-style findings on untouched lines.
- **Manual device test still pending** (see below).

## Not Done / Follow-ups
- **No backfill** (per user decision): existing full-res-only listings serve full
  images on cards until re-edited. Mobile fallback keeps them rendering.
- **Admin moderation Edit-added images get no thumbnail** (rare path) → mobile
  falls back to full. Acceptable; documented to keep the moderation transaction
  and its tests untouched.
- **Deploy:** backend reaches prod only when `feature/image-variant-pipeline`
  merges to carEx-services `main` (Railway). Recommend testing against the
  **staging** `MONGODB_URI` first; point `AWS_BUCKET_NAME` at a staging bucket if
  one exists, otherwise test objects land under `cars/` in the prod bucket.
- **Manual test:** upload a fresh listing → confirm `thumbnailUrls` populated,
  thumb bytes ≪ full, cards render thumb, gallery renders full (iOS + Android).
</content>
