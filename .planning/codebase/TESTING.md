# Testing Patterns

**Analysis Date:** 2026-04-17

## Test Framework

**Runner:**
- Jest 29.6.3
- Preset: `react-native`
- Config: `jest.config.js` (minimal, 3 lines)
- TypeScript support via `@react-native/typescript-config`

**Assertion Library:**
- Jest built-in assertions (no additional library)
- `expect()` and matcher syntax

**Run Commands:**
```bash
npm test                # Run all tests
npm run start:reset     # Reset cache before running tests (if needed)
npm run lint            # Run ESLint (not tests, but part of CI)
```

## Test File Organization

**Location:**
- Centralized in `__tests__/` directory at project root
- Current structure: only one test file present

**Naming:**
- `App.test.tsx` - test file for App component

**Structure:**
```
carEx/
├── __tests__/
│   └── App.test.tsx          # Single existing test
├── src/
│   ├── screens/
│   ├── components/
│   ├── services/
│   └── ...
```

## Test Structure

**Suite Organization:**

```typescript
// From __tests__/App.test.tsx - existing pattern
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
```

**Pattern Observed:**
- Uses `react-test-renderer` for shallow/synchronous rendering
- Wraps render calls in `ReactTestRenderer.act()`
- No describe blocks used; single `test()` declarations
- No setup/teardown observed in current codebase

## Mocking

**Framework:** Jest built-in mocking (no additional library like `jest-mock-extended`)

**Patterns:**
- No active mocking infrastructure set up in codebase
- No mock files in `__mocks__/` directory
- Dependencies (axios, AsyncStorage, React Navigation) are not mocked in current test

**What to Mock:**
- API calls (axios): use `jest.mock('axios')` and provide mock implementations
- AsyncStorage: mock with `jest.mock('@react-native-async-storage/async-storage')`
- React Navigation hooks: mock `useNavigation`, `useRoute`, `useIsFocused`
- Context providers: wrap test in real provider or mock context

**What NOT to Mock:**
- React Native built-in components (View, Text, etc.) - let react-test-renderer handle
- Theme/COLORS constants - import real values for styling tests
- TypeScript types - don't mock, these disappear at runtime

## Fixtures and Factories

**Test Data:**
- Not established in current codebase
- Would need to create for screens/components that fetch data

**Location:**
- Recommendation: `__tests__/fixtures/` for mock data files
- Example structure: `__tests__/fixtures/cars.json`, `__tests__/fixtures/users.ts`

**Example Factory (not currently used):**
```typescript
// Hypothetical: __tests__/factories/carFactory.ts
export const createMockCar = (overrides = {}) => ({
  id: '123',
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  price: 15000,
  mileage: 50000,
  fuel: 'Gasoline',
  ...overrides,
});
```

## Coverage

**Requirements:** None enforced

**Current State:**
- No coverage threshold configured in `jest.config.js`
- No coverage reports generated
- Only 1 test file present for a 900+ component/service codebase

**View Coverage:**
```bash
npm test -- --coverage
# Would generate coverage report (not currently used)
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, utilities
- Approach: Test input → output without external dependencies
- Example needed for: `useVehicleCatalog()` hook, utility functions
- Not currently implemented

**Integration Tests:**
- Scope: Component + context + services interaction
- Approach: Render component with real providers, test data flow
- Example needed for: `HomeScreen` with `AuthProvider` + `LanguageProvider`
- Not currently implemented

**E2E Tests:**
- Framework: None configured
- Not applicable for React Native; would use Detox or similar
- Not currently implemented

## Current Test Status

**Existing Test:**
- File: `__tests__/App.test.tsx`
- Type: Smoke test (renders without crashing)
- Coverage: App component only
- Limitations: No assertions on rendered content, no interaction testing

**Critical Testing Gaps:**
1. **Screen Components:** HomeScreen, SellCarScreen, ProfileScreen not tested
2. **Components:** CarCard, FilterBar, etc. rendered but not validated
3. **Hooks:** useVehicleCatalog, useLanguage, useAuth not tested
4. **Services:** AuthService methods not mocked or tested
5. **Context:** AuthProvider, LanguageProvider initialization not verified
6. **Error Paths:** No tests for error handling or Alert.alert() calls
7. **User Interactions:** No touch/press event testing
8. **Data Flow:** No testing of filter logic, sort logic, API data transformation

## Recommended Test Structure (not currently implemented)

**Directory Layout:**
```
__tests__/
├── App.test.tsx                    # Existing smoke test
├── components/
│   ├── CarCard.test.tsx
│   └── FilterBar.test.tsx
├── screens/
│   ├── HomeScreen.test.tsx
│   └── SellCarScreen.test.tsx
├── hooks/
│   ├── useVehicleCatalog.test.ts
│   └── useLanguage.test.ts
├── services/
│   └── AuthService.test.ts
├── fixtures/
│   └── mockData.ts
└── setup.ts                        # Jest setup file
```

**Setup Pattern (recommended):**
```typescript
// __tests__/setup.ts
jest.mock('axios');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));
```

---

*Testing analysis: 2026-04-17*
