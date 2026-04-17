# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**
- Components: PascalCase, e.g. `CarCard.tsx`, `HomeScreen.tsx`, `PasswordTextInput.tsx`
- Hooks: camelCase with `use` prefix, e.g. `useVehicleCatalog.ts`, `useLanguage`, `useAuth`
- Screens: PascalCase with `Screen` suffix, e.g. `HomeScreen.tsx`, `SellCarScreen.tsx`, `ProfileScreen.tsx`
- Services: PascalCase with `Service` suffix, e.g. `AuthService.ts`
- Utilities: camelCase, e.g. `makeLogos.ts`, `passwordPolicy.ts`
- Constants: directories uppercase, e.g. `constants/theme.ts`, `constants/translations.ts`
- Types: directories dedicated, e.g. `types/navigation.ts`

**Functions:**
- React components: PascalCase, exported as named or default exports from their file
- Hook functions: camelCase with `use` prefix, returns object/value
- Utility functions: camelCase
- Event handlers: camelCase with `handle` prefix, e.g. `handleCarPress()`, `handleFilterPress()`, `handleSubmit()`
- Callbacks: camelCase with `on` prefix in props, e.g. `onPress`, `onChange`, `onSelect`

**Variables:**
- State variables: camelCase, e.g. `selectedMake`, `loading`, `filteredCars`, `activeFilters`
- Boolean flags: camelCase, e.g. `isEditMode`, `isFocused`, `isPhoneVerified`
- Constants: UPPER_SNAKE_CASE, e.g. `COLORS`, `SIZES`, `API_KEY`, `AUTH_URL`

**Types:**
- Interface names: PascalCase, e.g. `CarProps`, `AuthContextType`, `VehicleMake`, `PasswordTextInputProps`
- Type aliases: PascalCase, e.g. `Language = 'RU' | 'EN'`
- Exported interfaces in component files: narrow scope to the component using them

## Code Style

**Formatting:**
- Prettier preset: React Native defaults
  - Single quotes: `'true'` (singleQuote: true)
  - Arrow function parens: avoid when single param (arrowParens: 'avoid')
  - Trailing comma: all (trailingComma: 'all')
  - Tab width: 2 spaces (default)

**Linting:**
- ESLint config: `@react-native` preset only
- Config file: `.eslintrc.js` in project root
- No custom rules; follows React Native community standards
- Run with: `npm run lint`

**File Structure:**
- One default export per component file (screens/components)
- Named exports allowed for screens and hooks when re-exported
- StyleSheet definitions inline at bottom of component file
- Memoized components when props are stable: `React.memo()`, e.g. `CarCard` uses memo for perf optimization

## Import Organization

**Order:**
1. React and React Native built-ins (`import React`, `import { View, Text, ... }`)
2. Third-party libraries (`axios`, `@react-navigation`, `lucide-react-native`)
3. Services and utilities (`../services/AuthService`, `../utils/makeLogos`)
4. Constants and theme (`../constants/theme`, `../constants/config`)
5. Context and hooks (`../context/LanguageContext`, `../hooks/useVehicleCatalog`)
6. Components (`../components/CarCard`)
7. Types (`../types/navigation`)

**Path Aliases:**
- None configured; relative imports used throughout
- Paths structured by feature: screens, components, services, context, hooks, constants, types, utils
- Example from `HomeScreen.tsx`: `import { COLORS, SIZES } from '../constants/theme';`

## Error Handling

**Patterns:**

1. **Try/Catch with User-Facing Alerts:**
   ```typescript
   // From HomeScreen.tsx, fetchCars()
   try {
     const response = await axios.get(`${API_URL}/api/cars`);
     setCars(apiCars);
   } catch (error) {
     console.error('Failed to fetch cars:', error);
     Alert.alert('Error', 'Failed to load cars from server.');
   } finally {
     setLoading(false);
   }
   ```

2. **Service Layer Error Extraction:**
   ```typescript
   // From AuthService.ts, signIn()
   catch (error) {
     throw error.response ? error.response.data.error : error;
   }
   ```

3. **Context Throw Pattern (Hook Safety):**
   ```typescript
   // From LanguageContext.tsx, useLanguage()
   export const useLanguage = () => {
     const context = useContext(LanguageContext);
     if (!context) {
       throw new Error('useLanguage must be used within a LanguageProvider');
     }
     return context;
   };
   ```

4. **Debug + Console Logging:**
   - Use `console.error()` for debugging failed API calls and errors
   - Example: `console.error('Failed to fetch cars:', error);`

5. **Alert for User-Facing Errors:**
   - Use `Alert.alert(title, message)` for displaying errors to users
   - Network errors, validation failures, auth issues all surface via Alert

## Logging

**Framework:** `console` only (no logging library)

**Patterns:**
- `console.error()` for errors and debug information
- Applied sparingly; typically in catch blocks or when debugging
- Example: `console.error('Failed to fetch makes:', e);` in `useVehicleCatalog.ts`

## Comments

**When to Comment:**
- Function purpose if not self-evident from signature
- Complex logic or workarounds (e.g., model name matching in `HomeScreen.tsx`)
- Commented-out code blocks kept during development (e.g., deprecated styles in `HomeScreen.tsx`)

**JSDoc/TSDoc:**
- Not consistently used; minimal documentation patterns observed
- Used minimally for type exports and service methods

## Function Design

**Size:**
- Functions range from small handlers (< 20 lines) to larger screen components (900+ lines)
- Complex screens like `SellCarScreen.tsx` exceed 1000 lines; no aggressive splitting observed
- Inline handlers favored over extracted utilities in some cases

**Parameters:**
- Destructuring used for complex props: `({ data }: { data: CarProps })`
- Named parameters with object destructuring for clarity
- Typing: full TypeScript; all parameters and returns typed

**Return Values:**
- Components return JSX
- Hooks return objects with named properties or arrays
- Service methods return Promise-wrapped data or throw errors
- Memoized components return memo-wrapped JSX

## Module Design

**Exports:**
- Components: default or named export (no re-export pattern observed)
- Hooks: named exports, e.g. `export function useVehicleCatalog()`
- Services: object export with methods, e.g. `export const AuthService = { ... }`
- Contexts: Provider component (default) + hook (named), e.g. `LanguageProvider` + `useLanguage()`
- Constants: named exports, e.g. `export const COLORS = { ... }`

**Barrel Files:**
- Not used; imports directly from component files
- Example: `import { CarCard } from '../components/CarCard';` not from `../components/index.ts`

## Context + Hook Pattern

**Rule:** Every Context provider must expose a matching `use*` hook that:
1. Validates context exists with `useContext()`
2. Throws error if used outside provider
3. Returns fully typed context value

**Examples:**
- `AuthProvider` → `useAuth()` (throws: "useAuth must be used within an AuthProvider")
- `LanguageProvider` → `useLanguage()` (throws: "useLanguage must be used within a LanguageProvider")
- `CartContext` follows same pattern

## StyleSheet & Theming

**Pattern:**
- `StyleSheet.create()` defined inline at bottom of each component file
- Theme colors sourced from `src/constants/theme.ts`: `COLORS` and `SIZES`
- All color references use `COLORS.*` constants, never hardcoded hex values (except neutrals like `#000`)
- Spacing uses `SIZES.padding` (16) as baseline
- Border radius: `SIZES.borderRadius` (12)

**Example from CarCard.tsx:**
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
  },
  // ...
});
```

## Internationalization (i18n)

**Framework:** Custom context-based approach in `src/context/LanguageContext.tsx`

**Pattern:**
- Import `useLanguage()` hook in any component needing translations
- Access strings via `const { t } = useLanguage();` then `t.keyName`
- Translation keys defined in `src/constants/translations.ts`
- Supported languages: 'RU' (Russian, default) and 'EN' (English)
- Example from `HomeScreen.tsx`: `<Text>{t.noCars}</Text>`

---

*Convention analysis: 2026-04-17*
