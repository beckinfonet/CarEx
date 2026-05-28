# v2 Fonts

The v2 ("Editorial") design uses two Google Fonts: **Manrope** (display + body) and **JetBrains Mono** (numerics + specs). All eight `.ttf` files below are committed to this directory and linked into both native projects — no manual setup needed for v2 typography to render. v1 ignores them: `useTypography()` returns `undefined` for `fontFamily` when the toggle is on v1, so RN falls back to the system font.

## Shipped fonts

```
src/assets/fonts/
├── Manrope-Regular.ttf       (PostScript: Manrope-Regular,    weight 400)
├── Manrope-Medium.ttf        (PostScript: Manrope-Medium,     weight 500)
├── Manrope-SemiBold.ttf      (PostScript: Manrope-SemiBold,   weight 600)
├── Manrope-Bold.ttf          (PostScript: Manrope-Bold,       weight 700)
├── Manrope-ExtraBold.ttf     (PostScript: Manrope-ExtraBold,  weight 800)
├── JetBrainsMono-Medium.ttf
├── JetBrainsMono-SemiBold.ttf
└── JetBrainsMono-Bold.ttf
```

Both families ship under SIL Open Font License 1.1.

## Source

- **Manrope** — Google Fonts static cuts (gwfh.mranftl.com mirror, Manrope v20). Name-table rewritten so PostScript name + family name match the canonical `Manrope-*` form (the gwfh output uses `ManropeExtraLight-*` because Google's static instances inherit the variable-font default weight). The rewrite preserves glyph data byte-identical — only nameID 1/2/4/6/16/17 plus `OS/2.usWeightClass` were modified.
- **JetBrains Mono** — direct from https://github.com/JetBrains/JetBrainsMono `fonts/ttf/` on master.

## Re-running `react-native-asset`

If you ever add or remove fonts here, re-run:

```bash
npx react-native-asset
```

This refreshes:
- `ios/carEx/Info.plist` `UIAppFonts` entries
- `ios/carEx.xcodeproj/project.pbxproj` Resources group
- `android/app/src/main/assets/fonts/` copies
- `ios/link-assets-manifest.json` + `android/link-assets-manifest.json` (do commit these — they track linked state for the next run)

Then clean-rebuild both platforms once:

```bash
# iOS
rm -rf ios/build && cd ios && pod install && cd .. && npm run ios

# Android
npm run android:clean && npm run android
```

## Verification

Toggle the app to v2 (Settings → "Внешний вид" → "Новый (бета)") and check that the Home headline ("Найдём ваше идеальное авто.") renders in Manrope and prices ($7,500 etc.) render in JetBrains Mono.
