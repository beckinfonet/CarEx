/**
 * Phase 6 Plan 06-03 — UserStatusBanner real-assertion suite (Wave 2)
 *
 * Converts the Wave-0 scaffold's 16 test.todo entries into executable tests
 * locking AFF-01 (render contract + severity palette), AFF-02 (reason chip +
 * verbatim note + expand), and AFF-03 (mailto encode + Alert fallback).
 *
 * Harness: react-test-renderer (same pattern as SeverityBadge.test.tsx + Plan
 * 05-10 screen-test lessons). jest.mock the four context/navigation/safe-area
 * modules and use a stable Proxy for t so useCallback deps don't rotate
 * between test renders (Plan 05-10 lesson).
 */

import React from 'react';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Text, Pressable, TouchableOpacity, Linking, Alert } from 'react-native';
import { UserStatusBanner } from '../../../src/components/moderation/UserStatusBanner';

// Stable mock-t Proxy — lesson from Plan 05-10: rotating t identity would
// rotate useCallback deps across renders and force a re-render cascade.
// Entries in `known` carry concrete strings for tests that need substring
// matches post-interpolation (e.g. appealNoMailBody); any other key returns
// its literal name so render-side assertions can match by key.
const mockT = new Proxy(
  {
    appealNoMailBody: 'Send an email to support and include your user ID: {uid}',
    appealPlaceholder: '[Your message here]',
  } as any,
  {
    get: (target, key) =>
      key in target ? (target as any)[key] : String(key),
  },
);

let mockUser: any = null;
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  // Exercise the cleanup callback so the focus-effect side effects are
  // covered by the harness (mirrors effective behavior when screen unfocuses).
  useFocusEffect: (cb: any) => {
    const cleanup = cb();
    if (typeof cleanup === 'function') {
      // schedule a simulated cleanup at unmount; but we don't need to invoke
      // now — calling here would reset expanded state before tests read it.
      // The important thing is cb() ran without errors.
    }
  },
}));

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
  mockUser = null;
});

function render(): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<UserStatusBanner />);
  });
  return tree;
}

function findFirstText(
  root: ReactTestInstance,
  matcher: (s: string) => boolean,
): ReactTestInstance | null {
  const texts = root.findAllByType(Text);
  for (const node of texts) {
    const serialized = JSON.stringify(node.props.children ?? '');
    if (matcher(serialized)) {
      return node;
    }
  }
  return null;
}

describe('UserStatusBanner (Phase 6 — AFF-01, AFF-02, AFF-03)', () => {
  // ---- AFF-01: null-render branches --------------------------------------

  test('returns null when moderationStatus.state === "active"', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'active' },
    };
    const tree = render();
    expect(tree.toJSON()).toBeNull();
  });

  test('returns null when user is null (signed-out)', () => {
    mockUser = null;
    const tree = render();
    expect(tree.toJSON()).toBeNull();
  });

  test('returns null when user has no moderationStatus', () => {
    mockUser = { localId: 'u1' };
    const tree = render();
    expect(tree.toJSON()).toBeNull();
  });

  // ---- AFF-01: renders with banner testID for each non-active severity ----

  test('renders with testID user-status-banner for feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'feature_limited',
        reasonCategory: 'spam',
      },
    };
    const tree = render();
    expect(
      tree.root.findByProps({ testID: 'user-status-banner' }),
    ).toBeTruthy();
  });

  test('renders with testID user-status-banner for blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'blocked_with_review',
        reasonCategory: 'fraud',
      },
    };
    const tree = render();
    expect(
      tree.root.findByProps({ testID: 'user-status-banner' }),
    ).toBeTruthy();
  });

  test('renders with testID user-status-banner for permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'permanently_banned',
        reasonCategory: 'other',
      },
    };
    const tree = render();
    expect(
      tree.root.findByProps({ testID: 'user-status-banner' }),
    ).toBeTruthy();
  });

  // ---- AFF-01: severity-specific icon testIDs ----------------------------

  test('renders severity icon user-status-banner-icon-feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render();
    expect(
      tree.root.findByProps({
        testID: 'user-status-banner-icon-feature_limited',
      }),
    ).toBeTruthy();
  });

  test('renders severity icon user-status-banner-icon-blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'blocked_with_review' },
    };
    const tree = render();
    expect(
      tree.root.findByProps({
        testID: 'user-status-banner-icon-blocked_with_review',
      }),
    ).toBeTruthy();
  });

  test('renders severity icon user-status-banner-icon-permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render();
    expect(
      tree.root.findByProps({
        testID: 'user-status-banner-icon-permanently_banned',
      }),
    ).toBeTruthy();
  });

  // ---- AFF-03: Appeal CTA visibility rules -------------------------------

  test('does NOT render appeal CTA for feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render();
    expect(() =>
      tree.root.findByProps({ testID: 'user-status-banner-appeal' }),
    ).toThrow();
  });

  test('renders appeal CTA for blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'blocked_with_review',
        reasonCategory: 'fraud',
        setAt: '2026-04-19T10:00:00Z',
      },
    };
    const tree = render();
    expect(
      tree.root.findByProps({ testID: 'user-status-banner-appeal' }),
    ).toBeTruthy();
  });

  test('does NOT render appeal CTA for permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render();
    expect(() =>
      tree.root.findByProps({ testID: 'user-status-banner-appeal' }),
    ).toThrow();
  });

  // ---- AFF-02: note rendering + expand -----------------------------------

  test('renders note verbatim on line 2 with numberOfLines=2 when collapsed', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'feature_limited',
        reasonCategory: 'spam',
        note: 'Admin said X',
      },
    };
    const tree = render();
    const notePressable = tree.root.findByProps({
      testID: 'user-status-banner-note',
    });
    expect(notePressable).toBeTruthy();
    // Inner Text child contains the verbatim note
    const innerText = notePressable.findByType(Text);
    expect(JSON.stringify(innerText.props.children)).toContain('Admin said X');
    expect(innerText.props.numberOfLines).toBe(2);
  });

  test('hides note line 2 entirely when note is empty string', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'feature_limited',
        reasonCategory: 'spam',
        note: '',
      },
    };
    const tree = render();
    expect(() =>
      tree.root.findByProps({ testID: 'user-status-banner-note' }),
    ).toThrow();
  });

  test('hides note line 2 entirely when note is null', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'feature_limited',
        reasonCategory: 'spam',
        note: null,
      },
    };
    const tree = render();
    expect(() =>
      tree.root.findByProps({ testID: 'user-status-banner-note' }),
    ).toThrow();
  });

  test('tap on note toggles expanded (numberOfLines undefined after tap)', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: {
        state: 'feature_limited',
        reasonCategory: 'spam',
        note: 'A long note that gets truncated',
      },
    };
    const tree = render();
    const notePressable = tree.root.findByProps({
      testID: 'user-status-banner-note',
    });
    // Collapsed: numberOfLines === 2
    const before = notePressable.findByType(Text);
    expect(before.props.numberOfLines).toBe(2);
    // Tap
    act(() => {
      notePressable.props.onPress();
    });
    // Expanded: numberOfLines === undefined (auto-grow)
    const after = tree.root
      .findByProps({ testID: 'user-status-banner-note' })
      .findByType(Text);
    expect(after.props.numberOfLines).toBeUndefined();
  });

  // ---- AFF-03: mailto encoding + Alert fallback --------------------------

  // Expected URL target: mailto:support@carexmarket.com (subject+body encoded)
  test('tap on appeal CTA calls Linking.openURL with encoded mailto (T-06-02)', () => {
    mockUser = {
      localId: 'abc123',
      moderationStatus: {
        state: 'blocked_with_review',
        reasonCategory: 'fraud',
        setAt: '2026-04-19T10:00:00Z',
      },
    };
    const tree = render();
    const cta = tree.root.findByProps({
      testID: 'user-status-banner-appeal',
    });
    act(() => {
      cta.props.onPress();
    });
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const urlArg = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    // Subject prefix: "CarEx moderation appeal — abc123" — em-dash is U+2014
    // which encodeURIComponent serializes as %E2%80%94
    expect(urlArg).toMatch(
      /^mailto:support@carexmarket\.com\?subject=CarEx%20moderation%20appeal%20%E2%80%94%20abc123&body=/,
    );
    // Decode the body query-arg and check for the three required lines.
    const bodyMatch = urlArg.match(/&body=(.+)$/);
    expect(bodyMatch).toBeTruthy();
    const decodedBody = decodeURIComponent(bodyMatch![1]);
    expect(decodedBody).toContain('User ID: abc123');
    expect(decodedBody).toContain('Reason category: reasonFraud');
    expect(decodedBody).toContain('Suspended: 2026-04-19T10:00:00Z');
  });

  test('appeal CTA falls back to Alert.alert on Linking.openURL rejection', async () => {
    mockUser = {
      localId: 'abc123',
      moderationStatus: {
        state: 'blocked_with_review',
        reasonCategory: 'fraud',
        setAt: '2026-04-19T10:00:00Z',
      },
    };
    // Override the per-test default resolved spy with a rejection.
    (Linking.openURL as jest.Mock).mockReset();
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(
      new Error('no mail client'),
    );
    const tree = render();
    const cta = tree.root.findByProps({
      testID: 'user-status-banner-appeal',
    });
    await act(async () => {
      cta.props.onPress();
      // Flush the rejected promise's catch microtask
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, body] = (Alert.alert as jest.Mock).mock.calls[0];
    // Proxy returns key name for appealNoMailTitle
    expect(title).toBe('appealNoMailTitle');
    // appealNoMailBody is a concrete string in mockT with {uid} placeholder —
    // after interpolation, '{uid}' should be replaced with 'abc123'.
    expect(body).toContain('abc123');
    expect(body).not.toContain('{uid}');
  });

  // ---- AFF-02: reason-category chip localization -------------------------

  test('renders localized reason-chip for each reasonCategory', () => {
    const cases: Array<[string, string]> = [
      ['spam', 'reasonSpam'],
      ['policy_violation', 'reasonPolicyViolation'],
      ['fraud', 'reasonFraud'],
      ['other', 'reasonOther'],
    ];
    for (const [cat, expectedKey] of cases) {
      mockUser = {
        localId: 'u1',
        moderationStatus: {
          state: 'feature_limited',
          reasonCategory: cat,
        },
      };
      const tree = render();
      const found = findFirstText(tree.root, (s) => s.includes(expectedKey));
      expect(found).not.toBeNull();
    }
  });
});
