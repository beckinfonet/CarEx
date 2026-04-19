/**
 * Phase 6 — Wave 0 scaffold
 *
 * Scaffold for src/components/moderation/UserStatusBanner.tsx (not yet created).
 * Every `test.todo` below corresponds to a locked behavior in
 * .planning/phases/06-affected-user-ux-security-review/06-UI-SPEC.md
 * (§Component 1 + §testID Manifest + §Appeal CTA behavior).
 *
 * Wave 2+ plans MUST replace each test.todo with a real assertion before
 * declaring completion. The import below intentionally points at a path
 * that does not resolve yet — this scaffold is a compile-time wiring
 * check as well as a behavior contract. The file is syntactically valid
 * so `jest --listTests` surfaces it from Wave 0 onward.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UserStatusBanner } from '../../../src/components/moderation/UserStatusBanner';

// Skeletal mocks — scaffolds do not run assertions yet; they only need to compile.
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: {} }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (_cb: () => void) => undefined,
}));

describe('UserStatusBanner (Phase 6 — AFF-01, AFF-02, AFF-03)', () => {
  // AFF-01 — non-dismissable render-when-non-active
  test.todo('returns null when user.moderationStatus.state === "active"');
  test.todo('returns null when user is undefined (signed-out)');
  test.todo('renders with testID user-status-banner when state === "feature_limited"');
  test.todo('renders with testID user-status-banner when state === "blocked_with_review"');
  test.todo('renders with testID user-status-banner when state === "permanently_banned"');

  // AFF-01 — severity palette + icon picks from UI-SPEC
  test.todo('uses palette featureLimited bg + border + AlertTriangle icon when state === "feature_limited"');
  test.todo('uses palette blockedReview bg + border + ShieldAlert icon when state === "blocked_with_review"');
  test.todo('uses palette permaBanned bg + border + Ban icon when state === "permanently_banned"');

  // AFF-02 — reason category + verbatim note
  test.todo('renders localized reason-category chip text for each reasonCategory key (spam/policy_violation/fraud/other)');
  test.todo('renders note verbatim on line 2, numberOfLines=2 when collapsed');
  test.todo('tapping line-2 note Pressable fires LayoutAnimation.configureNext then toggles expanded state (numberOfLines undefined when expanded)');
  test.todo('hides line 2 entirely when note is null or empty string');

  // AFF-03 — Appeal CTA visibility + mailto build
  test.todo('renders Appeal CTA (user-status-banner-appeal) ONLY when state === "blocked_with_review"');
  test.todo('does NOT render Appeal CTA when state === "feature_limited" or "permanently_banned"');
  test.todo('tapping Appeal CTA calls Linking.openURL with mailto:support@carexmarket.com, subject "CarEx moderation appeal — {localId}", and body containing User ID / Reason category / Suspended (setAt) lines encoded via encodeURIComponent');
  test.todo('Linking.openURL.catch fires Alert.alert with appealNoMailTitle + appealNoMailBody (containing uid) + single OK button on mailto failure');
});
