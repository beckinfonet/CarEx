/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Phase 13 (NPUSH-06): register the background/quit message handler at MODULE
// SCOPE, BEFORE AppRegistry.registerComponent. For a background or quit data
// message the OS spins up the JS context with NO React tree, so this handler
// must live outside the component tree. Keep it MINIMAL / headless — no display
// or route work here. Tap routing (foreground/background/quit) happens inside
// the React tree via getInitialNotification / onNotificationOpenedApp / onMessage
// in App.tsx, which read data.deeplink and navigate through the linking whitelist.
messaging().setBackgroundMessageHandler(async () => {
  // Headless: nothing to do here for Phase 13. The OS displays the notification
  // from the FCM `notification` payload; tap handling is wired in App.tsx.
});

AppRegistry.registerComponent(appName, () => App);
