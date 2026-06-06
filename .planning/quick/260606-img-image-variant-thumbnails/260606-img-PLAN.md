---
quick_id: 260606-img
slug: image-variant-thumbnails
type: quick (cross-repo)
created: 2026-06-06
repos:
  - carEx (mobile, this repo) — branch quick/image-variant-thumbnails
  - carEx-services (backend, sibling) — branch feature/image-variant-pipeline off origin/main
decision_basis: ".planning/debug/resolved/listing-images-blank-android.md — deferred 'Fix E' (server-side resize). User chose Option 1 (sharp variant pipeline), new-uploads-only, scope both repos."
must_haves:
  truths:
    - "New listing uploads generate a small thumbnail (~400px) + a full (~1600px) JPEG per image, both stored in S3 with Cache-Control immutable"
    - "Car doc carries a parallel thumbnailUrls:[String] aligned by index to imageUrls; old listings have none and fall back to imageUrls"
    - "Mobile list/feed cards render thumbnailUrls[0] (small); CarDetails gallery keeps rendering full imageUrls"
    - "Admin moderation Edit path and avatar upload are UNTOUCHED (multer-s3 upload + WR-01 cleanup invariants preserved)"
    - "CR-02 sanitizers (MIME allowlist, key sanitization, size/count limits) remain single-source, shared by both upload paths"
---

<objective>
Optimize listing images for mobile by generating sized variants server-side at upload
time (the deferred "Fix E"), so tiny feed cards stop downloading full-screen photos.
New uploads only — no backfill of existing full-res-only listings (mobile fallback
keeps them rendering).
</objective>

## Tasks

### Backend (carEx-services @ feature/image-variant-pipeline)

1. **Add `sharp`** to dependencies (`npm install sharp`).
2. **`src/uploads/carImages.js`** — keep the existing `upload` (multer-s3) + `s3`
   exports UNCHANGED (admin route depends on `.location`/`.key`). Extract shared
   sanitizers; add:
   - `uploadMemory` — multer with `memoryStorage()` + the same `fileFilter` + `limits`.
   - `processAndUploadCarImages(files, bodyType)` — sharp → `{full ~1600px q82, thumb ~400px q70}`
     JPEGs, `PutObjectCommand` to S3 with `ContentType image/jpeg` + `Cache-Control: public,
     max-age=31536000, immutable`. Collision-hardened keys. Per-file graceful fallback
     (sharp failure → upload original as full, reuse for thumb). Returns `[{full, thumb}]`.
3. **`src/models/Car.js`** — add `thumbnailUrls: [String]` after `imageUrls`.
4. **`server.js`** — `POST /api/cars` and `PUT /api/cars/:id`: swap `upload.array` →
   `uploadMemory.array`; replace `req.files.map(f=>f.location)` with the helper; persist
   `thumbnailUrls`. PUT rebuilds `thumbnailUrls` aligned to kept+new images.
5. **Test** — `__tests__/uploads/carImages.test.js`: real sharp on a generated buffer,
   mocked S3 `send`; assert 2 PUTs/image, `{full,thumb}` shape, thumb key suffix.

### Mobile (carEx @ quick/image-variant-thumbnails)

6. Redirect the card thumbnail derivation `image:` to prefer `thumbnailUrls[0]` (fallback
   `imageUrls[0]` → `imageUrl` → placeholder) in the 4 list/feed mapping spots:
   `src/hooks/useHomeListings.ts`, `src/screens/MyListingsScreen.tsx`,
   `src/screens/SellerListingsScreen.tsx`, `src/screens/FavoritesScreen.tsx`
   (+ CarDetails header fallback). Gallery (`CarDetailsScreen` `images = imageUrls`) stays full.

## Known scope boundaries
- Admin moderation Edit-added images get no thumbnail (rare path) → fall back to full. Acceptable.
- No backfill: existing listings serve full-res until re-edited. Per user decision.

## Verification
- Backend: `npm test` (carImages suite). Manual: upload a listing against **staging Mongo**
  (set `MONGODB_URI`; use a staging `AWS_BUCKET_NAME` if available) → confirm `thumbnailUrls`
  populated, thumb << full in bytes, cards render small variant, gallery renders full. iOS + Android.
- Backend ships to prod only on merge to carEx-services `main` (Railway). Mobile safe to ship any order.
</content>
</invoke>
