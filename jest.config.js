const path = require('path');

// Preset already sets its own setupFiles; resolve absolute paths so the worktree
// (which doesn't carry its own node_modules) still finds the library setups.
const rnSetup = require.resolve('react-native/jest/setup.js');
const gestureHandlerSetup = require.resolve(
  'react-native-gesture-handler/jestSetup.js',
);

module.exports = {
  preset: 'react-native',
  setupFiles: [
    rnSetup,
    gestureHandlerSetup,
    path.join(__dirname, 'jest.setup.js'),
  ],
  // Extend the RN preset's transformIgnorePatterns so Jest also transforms
  // @react-navigation/* and @stripe/stripe-react-native which ship ESM in their
  // `lib/module` builds.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@stripe/stripe-react-native|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-svg|lucide-react-native|react-native-fast-image|react-native-safe-area-context|@likashefqet)/)',
  ],
};
