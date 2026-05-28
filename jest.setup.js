/**
 * Jest setup — mocks native modules that aren't registered in the JS test env.
 *
 * Required because RN 0.83 ships TurboModule-enforced natives (gesture-handler,
 * reanimated, screens, svg, fast-image, stripe) that throw at module load time
 * inside Jest. Each mock below mirrors the library's official Jest guidance.
 *
 * Added in Plan 04-06 to unblock Test 4 (end-to-end App render) and Test 5
 * (existing __tests__/App.test.tsx regression sentinel). No behavior change to
 * runtime code.
 */

/* eslint-disable no-undef */

// react-native-reanimated — self-contained stub. (The library's own
// `react-native-reanimated/mock` entrypoint uses ESM, which conflicts with
// Jest's CommonJS require() in this project's setup. The stub below covers
// every API the codebase currently uses across moderation banners + v2
// FeedLoader + v2 V2InviteBanner.)
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const noop = () => {};
  const ident = (v) => v;
  const View_ = (props) => React.createElement(View, props, props.children);
  View_.displayName = 'Animated.View';
  const sharedValue = (initial) => ({ value: initial });
  return {
    __esModule: true,
    default: { View: View_, createAnimatedComponent: (C) => C },
    View: View_,
    createAnimatedComponent: (C) => C,
    useSharedValue: (initial) => sharedValue(initial),
    useAnimatedStyle: () => ({}),
    useAnimatedRef: () => ({ current: null }),
    withTiming: (toValue, _opts, callback) => {
      if (typeof callback === 'function') callback(true);
      return toValue;
    },
    withSpring:  (toValue) => toValue,
    withRepeat:  (animation) => animation,
    withDelay:   (_delay, animation) => animation,
    runOnJS:     (fn) => fn,
    runOnUI:     (fn) => fn,
    Easing:      { linear: ident, inOut: ident, out: ident, in: ident, ease: ident },
    interpolate: (v) => v,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  };
});

// react-native-screens — stub to no-op components.
jest.mock('react-native-screens', () => {
  const React = require('react');
  const passthrough = ({ children }) => React.createElement(React.Fragment, null, children);
  return {
    enableScreens: () => {},
    enableFreeze: () => {},
    Screen: passthrough,
    ScreenContainer: passthrough,
    ScreenStack: passthrough,
    ScreenStackHeaderConfig: passthrough,
    NativeScreen: passthrough,
    NativeScreenContainer: passthrough,
    NativeScreenNavigationContainer: passthrough,
    FullWindowOverlay: passthrough,
  };
});

// react-native-svg — replace with empty stubs so icon libraries don't crash.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const stub = (name) => {
    const C = (props) => React.createElement(name, props, props.children);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Circle: stub('Circle'),
    Ellipse: stub('Ellipse'),
    G: stub('G'),
    Text: stub('Text'),
    TSpan: stub('TSpan'),
    TextPath: stub('TextPath'),
    Path: stub('Path'),
    Polygon: stub('Polygon'),
    Polyline: stub('Polyline'),
    Line: stub('Line'),
    Rect: stub('Rect'),
    Use: stub('Use'),
    Image: stub('Image'),
    Symbol: stub('Symbol'),
    Defs: stub('Defs'),
    LinearGradient: stub('LinearGradient'),
    RadialGradient: stub('RadialGradient'),
    Stop: stub('Stop'),
    ClipPath: stub('ClipPath'),
    Pattern: stub('Pattern'),
    Mask: stub('Mask'),
    Marker: stub('Marker'),
    ForeignObject: stub('ForeignObject'),
  };
});

// lucide-react-native — every icon becomes a passthrough stub.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const Icon = (props) => React.createElement('Icon', props);
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return Icon;
      },
    },
  );
});

// react-native-fast-image — stub with Image-like component shape.
jest.mock('react-native-fast-image', () => {
  const React = require('react');
  const FastImage = (props) => React.createElement('FastImage', props);
  FastImage.resizeMode = { contain: 'contain', cover: 'cover', stretch: 'stretch', center: 'center' };
  FastImage.priority = { low: 'low', normal: 'normal', high: 'high' };
  FastImage.cacheControl = { immutable: 'immutable', web: 'web', cacheOnly: 'cacheOnly' };
  FastImage.preload = jest.fn();
  return { __esModule: true, default: FastImage };
});

// @stripe/stripe-react-native — StripeProvider + hook stubs.
jest.mock('@stripe/stripe-react-native', () => {
  const React = require('react');
  const StripeProvider = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  const noop = () => null;
  const noopHook = () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
    confirmPaymentSheetPayment: jest.fn(),
  });
  return {
    __esModule: true,
    StripeProvider,
    useStripe: noopHook,
    usePaymentSheet: noopHook,
    CardField: noop,
    CardForm: noop,
  };
});

// @likashefqet/react-native-image-zoom — stub the zoom wrapper.
jest.mock('@likashefqet/react-native-image-zoom', () => {
  const React = require('react');
  const ImageZoom = (props) => React.createElement('ImageZoom', props, props.children);
  return { __esModule: true, default: ImageZoom, ImageZoom };
});

// @react-native-community/netinfo — default to connected.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  },
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// @react-native-async-storage/async-storage — use the library's official mock.
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-image-picker — stub launch functions.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// react-native-linear-gradient — stub to a passthrough View so v2 components
// that wrap content in <LinearGradient> can render in tests.
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = (props) => React.createElement(View, props, props.children);
  LinearGradient.displayName = 'LinearGradient';
  return { __esModule: true, default: LinearGradient, LinearGradient };
});

// react-native-safe-area-context — lightweight passthrough + zero insets.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 0, height: 0 };
  const SafeAreaInsetsContext = React.createContext(insets);
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaConsumer: ({ children }) => children(insets),
    SafeAreaView: ({ children, ...rest }) =>
      React.createElement('SafeAreaView', rest, children),
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});
