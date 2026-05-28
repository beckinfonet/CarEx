# v2 Fonts

The v2 ("Editorial") design uses two Google Fonts: **Manrope** (display + body) and **JetBrains Mono** (numerics + specs). These `.ttf` files are required for v2 typography to render correctly. v1 ignores them — `useTypography()` returns `undefined` for `fontFamily` when the toggle is on v1, so RN falls back to the system font.

## Files to drop here

```
src/assets/fonts/
├── Manrope-Regular.ttf
├── Manrope-Medium.ttf
├── Manrope-SemiBold.ttf
├── Manrope-Bold.ttf
├── Manrope-ExtraBold.ttf
├── JetBrainsMono-Medium.ttf
├── JetBrainsMono-SemiBold.ttf
└── JetBrainsMono-Bold.ttf
```

## How to obtain

1. **Manrope** — https://fonts.google.com/specimen/Manrope → "Download family" (top right). Unzip and copy the static cuts above from the `static/` subdirectory into this folder.
2. **JetBrains Mono** — https://fonts.google.com/specimen/JetBrains+Mono → "Download family". Unzip and copy the static cuts above from the `static/` subdirectory into this folder.

The downloaded archives include many more cuts (italic, thin, etc.) — copy only the eight files listed.

## PostScript name verification

After dropping the files, open each in Font Book (macOS) and confirm the **PostScript name** column matches the file basename exactly (e.g., the PostScript name for `Manrope-Bold.ttf` should be `Manrope-Bold`). RN's `fontFamily` style strings match the PostScript name, not the file name. If any differ, file an issue — the codebase references `'Manrope-Bold'`, `'JetBrainsMono-Medium'`, etc.

## Linking into the native projects

Once the eight `.ttf` files are in place:

```bash
npx react-native-asset
```

This:
- iOS: adds `UIAppFonts` entries to `ios/carEx/Info.plist`, copies files into the Xcode project resources.
- Android: copies files to `android/app/src/main/assets/fonts/`.

Then clean-rebuild both platforms:

```bash
# iOS
rm -rf ios/build && npm run ios

# Android
npm run android:clean && npm run android
```

Verify fonts render by toggling the app to v2 (Settings → "Внешний вид" → "Новый (бета)") and checking that the Home headline and prices use Manrope / JetBrains Mono rather than the system font.
