---
phase: quick-260602-vdv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/LatestCarousel.tsx
  - src/screens/ProviderOrdersScreen.tsx
  - src/screens/MyOrdersScreen.tsx
  - src/screens/ServiceCartScreen.tsx
  - src/screens/AdminModerationScreen.tsx
autonomous: true
requirements: [QUICK-260602-vdv]

must_haves:
  truths:
    - "Every remaining REMOTE car/listing thumbnail in scope renders via OptimizedImage (FastImage cache + Android retry)."
    - "The LatestCarousel image (highest-impact, a carousel) renders via OptimizedImage with priority='high'."
    - "No local/picked-image source was migrated — SellCarScreen.tsx:779 is byte-unchanged."
    - "No avatar/local-asset Image usage was migrated."
    - "No file lost its react-native Image import while still referencing <Image elsewhere."
  artifacts:
    - path: src/components/LatestCarousel.tsx
      provides: "Carousel image with priority='high'"
      contains: "priority=\"high\""
    - path: src/screens/ProviderOrdersScreen.tsx
      provides: "Car thumbnail via OptimizedImage (avatar stays plain Image)"
      contains: "OptimizedImage"
    - path: src/screens/MyOrdersScreen.tsx
      provides: "Car thumbnail via OptimizedImage"
      contains: "OptimizedImage"
    - path: src/screens/ServiceCartScreen.tsx
      provides: "Car thumbnail via OptimizedImage"
      contains: "OptimizedImage"
    - path: src/screens/AdminModerationScreen.tsx
      provides: "Listing thumbnail via OptimizedImage"
      contains: "OptimizedImage"
  key_links:
    - from: "screen/component thumbnail JSX"
      to: "src/components/OptimizedImage.tsx (named export OptimizedImage)"
      via: "import + element swap"
      pattern: "OptimizedImage source"
---

<objective>
Migrate the remaining REMOTE-image renders that still use plain React Native plain Image (uri source) over to the project's OptimizedImage (FastImage wrapper), giving them disk/memory cache, decode-once, Android blank-image retry, and fetch-priority support. This is a follow-up to quick task 260602-svv which migrated the 5 V2 Home cards. Root cause is already diagnosed (backend serves full-res S3 originals; caching is the win) — do NOT re-diagnose.

Purpose: Cut redundant full-res S3 refetches/decodes on thumbnail-heavy screens and the latest-listings carousel, and pick up the Android blank-image retry behavior, with zero layout or behavior change.

Output: 5 files edited. Plain remote thumbnails swapped to OptimizedImage; the LatestCarousel image gets priority="high".
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/components/OptimizedImage.tsx
@src/components/CarCard.tsx

<interfaces>
OptimizedImage public API — extracted from src/components/OptimizedImage.tsx. Use directly, no exploration needed.

Named export (NOT default). Signature:
- OptimizedImage(props): JSX.Element
- props.source: { uri: string } | ImageSourcePropType
- props.style?: StyleProp<ImageStyle>
- props.resizeMode?: 'contain' | 'cover' | 'stretch' | 'center'  (DEFAULTS to 'cover')
- props.priority?: 'low' | 'normal' | 'high'  (DEFAULTS to 'normal')
- plus any other FastImageProps via spread.

Behavioral notes that matter for this task:
- For a remote uri source it renders FastImage; for local assets it falls back to plain Image. Passing a remote uri is the correct path.
- resizeMode DEFAULTS to 'cover'. Plain RN Image also defaults to 'cover'. So a plain Image with NO resizeMode prop is behavior-equivalent to OptimizedImage with NO resizeMode prop. Do NOT add a resizeMode that wasn't there before.

v1 reference usage (src/components/CarCard.tsx:26): OptimizedImage with source uri data.image, style styles.image, resizeMode="cover".

Import paths:
- From a file in src/components/  ->  import { OptimizedImage } from './OptimizedImage';
- From a file in src/screens/     ->  import { OptimizedImage } from '../components/OptimizedImage';
Verify the relative path resolves from each file's actual location.
</interfaces>

<scope_guards>
HARD CONSTRAINTS — violating any of these is a defect:

1. ONLY swap sources that are REMOTE (http/https network URLs). Read each call site and confirm the source is a remote URL (a backend/S3 URL field like imageUrl / firstPhotoUrl / car.image) before swapping.

2. DO NOT swap local/picked-image sources. Specifically LEAVE src/screens/SellCarScreen.tsx:779 (img.uri — a locally-picked file:// image from react-native-image-picker) as plain Image. SellCarScreen.tsx must NOT appear in your diff.

3. SKIP avatar / logo / flag / local require() asset Image usages. Two known remote AVATARS are intentionally OUT of scope and must stay plain Image:
   - src/screens/ProviderOrdersScreen.tsx:129 (item.buyerAvatar) — buyer avatar, KEEP plain.
   - src/screens/CarDetailsScreen.tsx:776 (sellerAvatarUrl) — seller avatar, KEEP plain.

4. Preserve EVERY existing prop (style, and resizeMode IF present) and ALL layout/JSX structure. Only swap the element tag + add the import. If the original Image had NO resizeMode, add NONE (OptimizedImage defaults to 'cover', matching RN's default — they are equivalent).

5. Remove Image from a file's react-native import ONLY if <Image is no longer referenced ANYWHERE in that file after your edit. This is the main correctness risk. Per-file rule (verified from current tree):
   - ProviderOrdersScreen.tsx — KEEP Image import (line 129 avatar still uses it).
   - MyOrdersScreen.tsx — REMOVE Image from import (line 123 is the only <Image).
   - ServiceCartScreen.tsx — REMOVE Image from import (line 217 is the only <Image).
   - AdminModerationScreen.tsx — REMOVE Image from import (line 687 is the only <Image).
   Always re-grep <Image in the file AFTER editing to confirm before deciding to remove the import.

6. Do NOT touch or stage working-tree changes to android/version.properties or ios/carEx.xcodeproj/project.pbxproj.
</scope_guards>

<already_done>
IMPORTANT — the working tree has DRIFTED from the approximate line numbers in the task brief. Verified current state (re-confirm by reading each file, but these are accurate as of planning):

- src/components/LatestCarousel.tsx — ALREADY uses OptimizedImage (line ~92) and does NOT import Image. It only LACKS priority. -> Task 1 just adds priority="high". Do NOT add an import; it already imports OptimizedImage from './OptimizedImage'.
- src/screens/CarDetailsScreen.tsx — the thumbnail rows (~lines 1095, 1141) are ALREADY OptimizedImage with priority={imagePriority(index)}. The only remaining plain Image is line 776 (seller avatar) which is OUT of scope. -> CarDetailsScreen needs NO changes and must NOT appear in your diff.
</already_done>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add priority="high" to the LatestCarousel image</name>
  <files>src/components/LatestCarousel.tsx</files>
  <action>
    Read src/components/LatestCarousel.tsx first to confirm current JSX. The image at ~line 92 already renders via OptimizedImage (this file was migrated in 260602-svv) and imports OptimizedImage from './OptimizedImage'. The ONLY change: add priority="high" to that OptimizedImage element, preserving the existing source (uri car.image), style (styles.cardImage), and resizeMode="cover" props exactly.

    Decision (matches the HeroCard decision in 260602-svv): use a STATIC priority="high" for the carousel image rather than per-slide active priority. Rationale: this is a horizontal ScrollView (not FlatList) that re-renders all slides on scroll; recomputing per-slide priority on every scroll frame buys little and adds churn. activeIndex state exists but driving priority off it is not trivial here (the map has no index arg and would need restructuring). Keep it static high — the carousel is the highest-impact surface and a high-priority static fetch is the proven, simple choice.

    Do NOT add or remove any import (OptimizedImage is already imported; Image is not imported in this file). Do NOT change any style or layout.
  </action>
  <verify>
    <automated>test "$(grep -c 'priority=\"high\"' src/components/LatestCarousel.tsx)" = "1" && grep -q OptimizedImage src/components/LatestCarousel.tsx && echo OK</automated>
  </verify>
  <done>LatestCarousel image renders via OptimizedImage with priority="high"; all other props (source, style, resizeMode) unchanged; no import changes.</done>
</task>

<task type="auto">
  <name>Task 2: Swap remote car/listing thumbnails to OptimizedImage in 4 screens (per-file Image-import safety check)</name>
  <files>src/screens/ProviderOrdersScreen.tsx, src/screens/MyOrdersScreen.tsx, src/screens/ServiceCartScreen.tsx, src/screens/AdminModerationScreen.tsx</files>
  <action>
    For EACH of the four screens below: (a) read the file to confirm the exact current JSX and line number (the tree may differ from these approximate numbers), (b) add import OptimizedImage from '../components/OptimizedImage' near the other imports IF not already present, (c) swap ONLY the specified remote thumbnail Image element to OptimizedImage preserving every prop verbatim (source, style, and resizeMode only if it was present — none of these currently set resizeMode, so add none), (d) re-grep <Image in the file and apply the import-removal rule.

    1) src/screens/ProviderOrdersScreen.tsx (~line 146, item.carSnapshot.imageUrl — car thumbnail). Swap this ONE element to OptimizedImage. LEAVE line ~129 (item.buyerAvatar) as plain Image — it is an avatar (scope guard 3). Therefore KEEP Image in the react-native import (scope guard 5). After editing, grep -c '<Image' on this file must still return 1 (the avatar).

    2) src/screens/MyOrdersScreen.tsx (~line 123, item.carSnapshot.imageUrl — car thumbnail). This is the ONLY <Image in the file. Swap it, then REMOVE Image from the react-native import block (it sits on its own line `  Image,` at ~line 12). After editing, grep -c '<Image' must return 0.

    3) src/screens/ServiceCartScreen.tsx (~line 217, car.imageUrl — car thumbnail). ONLY <Image in the file. Swap it, then REMOVE Image from the react-native import (~line 9 `  Image,`). After editing, grep -c '<Image' must return 0.

    4) src/screens/AdminModerationScreen.tsx (~line 687, item.firstPhotoUrl — listing thumbnail). ONLY <Image in the file. Swap it, then REMOVE Image from the react-native import (~line 14 `  Image,`). After editing, grep -c '<Image' must return 0.

    Confirm each source is a remote backend/S3 URL field before swapping (imageUrl / firstPhotoUrl — all remote). Do NOT touch SellCarScreen.tsx or CarDetailsScreen.tsx. Do NOT add resizeMode to any element. Follow existing import ordering/style conventions in each file (relative imports grouped with other component imports).
  </action>
  <verify>
    <automated>set -e; test "$(grep -c 'OptimizedImage source' src/screens/ProviderOrdersScreen.tsx)" = "1"; test "$(grep -c '<Image' src/screens/ProviderOrdersScreen.tsx)" = "1"; test "$(grep -c 'OptimizedImage source' src/screens/MyOrdersScreen.tsx)" = "1"; test "$(grep -c '<Image' src/screens/MyOrdersScreen.tsx)" = "0"; test "$(grep -c '^  Image,' src/screens/MyOrdersScreen.tsx)" = "0"; test "$(grep -c 'OptimizedImage source' src/screens/ServiceCartScreen.tsx)" = "1"; test "$(grep -c '<Image' src/screens/ServiceCartScreen.tsx)" = "0"; test "$(grep -c '^  Image,' src/screens/ServiceCartScreen.tsx)" = "0"; test "$(grep -c 'OptimizedImage source' src/screens/AdminModerationScreen.tsx)" = "1"; test "$(grep -c '<Image' src/screens/AdminModerationScreen.tsx)" = "0"; test "$(grep -c '^  Image,' src/screens/AdminModerationScreen.tsx)" = "0"; echo ALL_OK</automated>
  </verify>
  <done>The 4 in-scope remote thumbnails render via OptimizedImage; ProviderOrdersScreen keeps its Image import (avatar) while the other 3 screens have Image removed from their react-native import; SellCarScreen.tsx and CarDetailsScreen.tsx untouched.</done>
</task>

</tasks>

<verification>
Run after both tasks complete. The repo has ~89 pre-existing, unrelated TypeScript errors — IGNORE those; only NEW errors in the 5 changed files matter.

1. Lint — no NEW errors in changed files:
   npm run lint 2>&1 | grep -E 'LatestCarousel|ProviderOrdersScreen|MyOrdersScreen|ServiceCartScreen|AdminModerationScreen'
   Expect: no error lines attributable to the swaps (an unused-Image warning would indicate a missed import removal — fix it).

2. Type-check — no NEW errors for the changed files:
   npx tsc --noEmit 2>&1 | grep -E 'LatestCarousel|ProviderOrdersScreen|MyOrdersScreen|ServiceCartScreen|AdminModerationScreen'
   Expect: empty output. If a line appears, confirm it is one of the ~89 pre-existing errors against a clean baseline; otherwise fix.

3. Scope guard — local picked image + avatars untouched:
   git diff --name-only | grep SellCarScreen   -> MUST be empty (SellCarScreen NOT in diff).
   git diff --name-only | grep CarDetailsScreen -> MUST be empty (CarDetailsScreen NOT in diff).
   grep -n 'img.uri' src/screens/SellCarScreen.tsx -> still present, unchanged.

4. Working-tree native files not staged:
   git diff --cached --name-only | grep -E 'version.properties|project.pbxproj' -> MUST be empty.

5. Device perf is verified MANUALLY by the user. Do NOT invent an automated perf test.
</verification>

<success_criteria>
- LatestCarousel image renders via OptimizedImage with priority="high".
- ProviderOrdersScreen, MyOrdersScreen, ServiceCartScreen, AdminModerationScreen each render their in-scope remote thumbnail via OptimizedImage.
- Image import removed from MyOrdersScreen, ServiceCartScreen, AdminModerationScreen; KEPT in ProviderOrdersScreen (avatar still uses it).
- SellCarScreen.tsx:779 and CarDetailsScreen.tsx unchanged (not in diff).
- android/version.properties and ios/.../project.pbxproj not staged.
- npm run lint and npx tsc --noEmit show no NEW errors for the 5 changed files.
</success_criteria>

<output>
After completion, create .planning/quick/260602-vdv-migrate-remaining-non-v2-remote-image-re/260602-vdv-SUMMARY.md recording: files changed, which thumbnails were swapped, the per-file Image-import decision (kept vs removed), and explicit confirmation that SellCarScreen + both avatars + CarDetailsScreen were intentionally left untouched.
</output>
