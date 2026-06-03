---
phase: quick-260602-svv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/home/v2/SmallFeedCard.tsx
  - src/components/home/v2/HeroCard.tsx
  - src/components/home/v2/ShelfCard.tsx
  - src/components/home/v2/BigFeedCard.tsx
  - src/components/home/v2/ProfileAvatarButton.tsx
autonomous: true
requirements: [V2-PERF-IMG-01]
user_setup: []

must_haves:
  truths:
    - "V2 car photos load from FastImage disk/memory cache (decode-once) instead of re-decoding plain RN Image bitmaps on every scroll-back"
    - "All 5 V2 card components render images through OptimizedImage, gaining Android blank-image retry and the fetch-priority queue"
    - "Hero carousel image fetches at high priority so the visible slide isn't starved behind offscreen card fetches"
    - "No layout, style, or structural changes — only the image element and its import swapped"
  artifacts:
    - path: "src/components/home/v2/SmallFeedCard.tsx"
      provides: "Main feed card using OptimizedImage"
      contains: "OptimizedImage"
    - path: "src/components/home/v2/HeroCard.tsx"
      provides: "Carousel hero card using OptimizedImage with priority"
      contains: "OptimizedImage"
    - path: "src/components/home/v2/ShelfCard.tsx"
      provides: "Horizontal shelf card using OptimizedImage"
      contains: "OptimizedImage"
    - path: "src/components/home/v2/BigFeedCard.tsx"
      provides: "Promoted big feed card using OptimizedImage"
      contains: "OptimizedImage"
    - path: "src/components/home/v2/ProfileAvatarButton.tsx"
      provides: "Header avatar using OptimizedImage"
      contains: "OptimizedImage"
  key_links:
    - from: "src/components/home/v2/*.tsx"
      to: "src/components/OptimizedImage.tsx"
      via: "import OptimizedImage from ../../OptimizedImage"
      pattern: "from '\\.\\./\\.\\./OptimizedImage'"
---

<objective>
Fix the V2 Home redesign photo lag / scroll stutter (reported on all devices, iOS + Android).

Root cause (already diagnosed — do not re-diagnose): the V2 Home card components render every car photo with plain React Native `<Image source={{ uri }}>` instead of the project's existing FastImage wrapper `OptimizedImage` (src/components/OptimizedImage.tsx). Plain `Image` has no disk/memory cache, re-decodes full-res S3 originals on the UI thread on every re-render/scroll-back, and lacks OptimizedImage's Android blank-image retry + fetch-priority queue. The v1 path (CarCard.tsx) already uses OptimizedImage and does not stutter.

The fix: swap plain `<Image>` -> `<OptimizedImage>` in the 5 V2 card components, preserving every existing prop (`style`, `resizeMode="cover"`) and all layout/structure. Add `priority="high"` to the hero carousel image only.

Purpose: Eliminate scroll stutter and slow photo loads on the V2 Home screen by reusing the already-installed, already-wrapped FastImage caching path.
Output: 5 modified V2 card components, each importing and rendering OptimizedImage. No new dependencies, no backend changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- OptimizedImage is a drop-in replacement for <Image source={{uri}}>. -->
<!-- Extracted from src/components/OptimizedImage.tsx — use directly, no exploration needed. -->

From src/components/OptimizedImage.tsx:
```typescript
type OptimizedImageProps = Omit<FastImageProps, 'source'> & {
  source: { uri: string } | ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  priority?: Priority; // 'low' | 'normal' | 'high'; defaults to FastImage.priority.normal
};
export const OptimizedImage = (props: OptimizedImageProps) => JSX.Element;
```
- Named export (not default): `import { OptimizedImage } from '../../OptimizedImage';`
- `priority` accepts the string literals `'high' | 'normal' | 'low'` directly (the `Priority` type from react-native-fast-image). No need to import FastImage constants in callers.
- Same call signature already used by v1: `<OptimizedImage source={{ uri: data.image }} style={styles.image} resizeMode="cover" />` (see src/components/CarCard.tsx line 26).
</interfaces>

<reference>
<!-- v1 reference, already shipped and working -->
@src/components/CarCard.tsx

<!-- Carousel context for the hero priority decision -->
@src/components/home/v2/HeroRotator.tsx
</reference>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap plain Image -> OptimizedImage in the four V2 car-photo cards</name>
  <files>src/components/home/v2/SmallFeedCard.tsx, src/components/home/v2/ShelfCard.tsx, src/components/home/v2/BigFeedCard.tsx, src/components/home/v2/HeroCard.tsx</files>
  <action>
In each of the four files, replace the plain car-photo `<Image source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />` element with `<OptimizedImage source={{ uri: car.image }} style={styles.photo} resizeMode="cover" />`. Keep the exact same `style` reference (`styles.photo`) and keep `resizeMode="cover"`. Do NOT touch layout, the surrounding `View`/`LinearGradient`/overlay structure, or any StyleSheet entry.

Add the import `import { OptimizedImage } from '../../OptimizedImage';` to each file (verified relative depth: these files live in src/components/home/v2/, OptimizedImage is at src/components/OptimizedImage.tsx → `../../OptimizedImage`). Place it alongside the other component imports.

Remove `Image` from the `react-native` named import in each file ONLY if `Image` is no longer referenced anywhere else in that file — in all four of these files the car photo is the only `Image` usage, so drop `Image` from the `import { ... } from 'react-native'` line to keep lint clean (no unused import). Keep `View`, `Text`, `TouchableOpacity`, `StyleSheet`, etc. as-is.

For HeroCard.tsx specifically (the carousel slide): set `priority="high"` on the OptimizedImage. DECISION — static high priority, not per-slide dynamic: OptimizedImage's doc comment recommends 'high' for the visible slide and 'low' for offscreen, but HeroRotator (src/components/home/v2/HeroRotator.tsx) does not pass each card its own list index — it passes `pageIndex` (= the rotator's current `index`) to every card, so a card cannot cleanly tell whether IT is the active slide without new prop plumbing. Per the planning brief, static `priority="high"` on the hero image is the accepted fallback. The hero carousel mounts only a few slides and the visible one is what matters most for perceived speed, so high priority is correct here. Do NOT add new props to HeroCard or HeroRotator. ShelfCard, SmallFeedCard, and BigFeedCard get NO priority prop (the 'normal' default is correct for feed/shelf cards).
  </action>
  <verify>
    <automated>grep -rL "from '\.\./\.\./OptimizedImage'" src/components/home/v2/SmallFeedCard.tsx src/components/home/v2/ShelfCard.tsx src/components/home/v2/BigFeedCard.tsx src/components/home/v2/HeroCard.tsx | grep -c . ; test "$(grep -rl 'Image source={{ uri: car.image }}' src/components/home/v2/SmallFeedCard.tsx src/components/home/v2/ShelfCard.tsx src/components/home/v2/BigFeedCard.tsx src/components/home/v2/HeroCard.tsx | grep -v OptimizedImage | wc -l | tr -d ' ')" = "0" && echo NO_PLAIN_IMAGE_REMAINS</automated>
  </verify>
  <done>All four files import OptimizedImage from '../../OptimizedImage', render OptimizedImage for the car photo with unchanged style + resizeMode="cover", HeroCard passes priority="high", and no plain `<Image source={{ uri: car.image }}>` remains in these four files.</done>
</task>

<task type="auto">
  <name>Task 2: Swap plain Image -> OptimizedImage for the V2 header avatar</name>
  <files>src/components/home/v2/ProfileAvatarButton.tsx</files>
  <action>
Replace the avatar `<Image source={{ uri: user.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />` with `<OptimizedImage source={{ uri: user.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />`. Keep the inline style object and `resizeMode="cover"` exactly as-is. Do NOT add a priority prop (normal default is fine for a single avatar).

Add `import { OptimizedImage } from '../../OptimizedImage';` alongside the existing imports. Remove `Image` from the `import { ... } from 'react-native'` line since the avatar is the only `Image` usage in this file (keep `StyleSheet`, `TouchableOpacity`, `ViewStyle`, `StyleProp`).
  </action>
  <verify>
    <automated>grep -q "from '\.\./\.\./OptimizedImage'" src/components/home/v2/ProfileAvatarButton.tsx && grep -q "OptimizedImage source={{ uri: user.avatarUrl }}" src/components/home/v2/ProfileAvatarButton.tsx && ! grep -q "Image source={{ uri: user.avatarUrl }}" src/components/home/v2/ProfileAvatarButton.tsx && echo AVATAR_SWAPPED</automated>
  </verify>
  <done>ProfileAvatarButton imports OptimizedImage and renders it for the avatar with the same inline style and resizeMode="cover"; no plain `<Image source={{ uri: user.avatarUrl }}>` remains.</done>
</task>

<task type="auto">
  <name>Task 3: Lint + typecheck the swapped components</name>
  <files>(no edits — verification only; fix any lint/type errors introduced by Tasks 1-2)</files>
  <action>
Run the project's lint and typecheck across the changed files. Fix only issues introduced by the image swap (e.g. a leftover unused `Image` import, or a `Priority` type mismatch if any). Do NOT refactor unrelated code or address pre-existing warnings elsewhere in the repo. If `npx tsc --noEmit` surfaces pre-existing errors unrelated to these 5 files, note them in the SUMMARY but do not fix them — confirm the 5 changed files themselves are clean.
  </action>
  <verify>
    <automated>npm run lint 2>&1 | tail -20 ; npx tsc --noEmit 2>&1 | grep -E 'src/components/home/v2/(SmallFeedCard|HeroCard|ShelfCard|BigFeedCard|ProfileAvatarButton)\.tsx' | grep -c . | grep -q '^0$' && echo TYPECHECK_CLEAN_FOR_CHANGED_FILES</automated>
  </verify>
  <done>`npm run lint` passes with no new errors in the 5 V2 files; `npx tsc --noEmit` reports zero errors for the 5 changed files.</done>
</task>

</tasks>

<verification>
- All 5 V2 files import OptimizedImage from '../../OptimizedImage':
  `grep -L "from '../../OptimizedImage'" src/components/home/v2/{SmallFeedCard,HeroCard,ShelfCard,BigFeedCard,ProfileAvatarButton}.tsx` returns nothing.
- No remaining plain car-photo Image in the 5 files:
  `grep -rn "Image source={{ uri:" src/components/home/v2/{SmallFeedCard,HeroCard,ShelfCard,BigFeedCard,ProfileAvatarButton}.tsx | grep -v Optimized` returns nothing.
- `npm run lint` passes.
- `npx tsc --noEmit` shows no errors for the 5 changed files.
- Device-level scroll smoothness / photo load speed: the USER will verify manually before/after. There is no automated perf test — do not invent one.
</verification>

<success_criteria>
- The 5 V2 card components render car/avatar photos through OptimizedImage (FastImage caching + decode-once + Android retry + priority queue).
- HeroCard image fetches at priority="high"; other cards use the normal default.
- Zero layout/style/structural changes; `resizeMode="cover"` preserved everywhere it appeared.
- Lint and typecheck clean for the changed files; no new dependencies introduced.
</success_criteria>

<follow_up>
Out of scope for this fix (note only, do NOT implement): backend serves full-resolution S3 originals. Adding a resized/CDN thumbnail variant for the small cards (124px photoWrap) would be a strong secondary perf win but requires backend work in carEx-services. Capture as a future backend task.
</follow_up>

<output>
After completion, create `.planning/quick/260602-svv-fix-v2-redesign-photo-lag-swap-plain-ima/260602-svv-SUMMARY.md`
</output>
