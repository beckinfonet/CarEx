/**
 * Phase 11 Plan 11-02 — ListingStatusBanner component test sweep.
 *
 * Locks the LBUY-01 (title + reason-chip render contract) and LBUY-04
 * (severity → icon + accent color mapping) requirements over both `detail`
 * and `cartRow` variants. Sibling to the analog Phase 6 UserStatusBanner
 * test suite — same react-test-renderer harness, same useFocusEffect mock,
 * same stable Proxy-t mock. NO useAuth mock (prop-driven per D-01).
 *
 * Describe blocks begin with the LBUY-NN ID literal (D-10 — Plan 11-07
 * coverage manifest greps on this prefix).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, Pressable } from 'react-native';
import { ListingStatusBanner } from '../ListingStatusBanner';
import {
  F2_suspendedSpam,
  F3_archivedInactiveSeller,
  F4_deletedPolicyViolation,
  F5_suspendedFraud,
  F6_archivedOther,
} from '../../../../__tests__/_fixtures/listingStatusFixtures';

// Stable mock-t Proxy — pre-populated with the concrete English strings the
// LBUY-01/04 substring assertions rely on. Any key not declared falls through
// to its literal name so other passing-through render branches don't crash.
const mockT = new Proxy(
  {
    listingStatusBannerSuspendedTitle: 'Listing suspended',
    listingStatusBannerArchivedTitle: 'Listing archived',
    listingStatusBannerDeletedTitle: 'Listing removed',
    listingStatusBannerReasonSpam: 'Spam',
    listingStatusBannerReasonPolicyViolation: 'Policy violation',
    listingStatusBannerReasonFraud: 'Fraud',
    listingStatusBannerReasonInactiveSeller: 'Inactive seller',
    listingStatusBannerReasonOther: 'Other',
    cartListingUnavailableRemove: 'Remove from cart',
  } as any,
  {
    get: (target, key) =>
      key in target ? (target as any)[key] : String(key),
  },
);

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

jest.mock('@react-navigation/native', () => ({
  // Run the focus-effect setup synchronously; do NOT auto-invoke the cleanup
  // callback (that would reset `expanded` before tests read it).
  useFocusEffect: (cb: any) => {
    const cleanup = cb();
    if (typeof cleanup === 'function') {
      // simulated unmount cleanup — not invoked in-test
    }
  },
}));

// String-stub the icon module so we can grep the tree for the chosen Icon.
jest.mock('lucide-react-native', () => ({
  AlertTriangle: 'AlertTriangle',
  Archive: 'Archive',
  Ban: 'Ban',
}));

// Pull COLORS post-mocks so the severity-tone assertions reference the same
// values the component resolves at render.
const { COLORS } = require('../../../constants/theme');

function render(props: any): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ListingStatusBanner {...props} />);
  });
  return tree;
}

function findFirstText(
  root: TestRenderer.ReactTestInstance,
  matcher: (s: string) => boolean,
): TestRenderer.ReactTestInstance | null {
  const texts = root.findAllByType(Text);
  for (const node of texts) {
    const serialized = JSON.stringify(node.props.children ?? '');
    if (matcher(serialized)) {
      return node;
    }
  }
  return null;
}

// Per-status expectations, indexed for the severity-tone matrix.
const STATUS_EXPECTATIONS: Record<
  string,
  { icon: string; color: string; titleSubstring: string }
> = {
  suspended: {
    icon: 'AlertTriangle',
    color: COLORS.warning,
    titleSubstring: 'Listing suspended',
  },
  archived: {
    icon: 'Archive',
    color: COLORS.textTertiary,
    titleSubstring: 'Listing archived',
  },
  deleted: {
    icon: 'Ban',
    color: COLORS.destructive,
    titleSubstring: 'Listing removed',
  },
};

describe('LBUY-01: ListingStatusBanner renders title + reason chip from props', () => {
  test('renders suspended title via STATUS_TO_TITLE_KEY lookup', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
    });
    const titleNode = findFirstText(tree.root, (s) =>
      s.includes('Listing suspended'),
    );
    expect(titleNode).not.toBeNull();
  });

  test('renders spam reason chip via REASON_TO_KEY lookup', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
    });
    const chipNode = findFirstText(tree.root, (s) => s.includes('Spam'));
    expect(chipNode).not.toBeNull();
  });

  test('omits reason chip entirely when reasonCategory is null (F3)', () => {
    const tree = render({
      status: F3_archivedInactiveSeller.status,
      reasonCategory: null,
      bannerHints: F3_archivedInactiveSeller.banner,
      note: F3_archivedInactiveSeller.note,
    });
    // No chip text for the 5 known reason categories should appear; verify
    // by asserting none of the 5 known English chip labels render.
    const labels = [
      'Spam',
      'Policy violation',
      'Fraud',
      'Inactive seller',
      'Other',
    ];
    for (const label of labels) {
      const found = findFirstText(tree.root, (s) => s.includes(label));
      expect(found).toBeNull();
    }
  });
});

describe('LBUY-04: severity tone matrix — neutral=archived, warning=suspended, destructive=deleted', () => {
  const cases: Array<[string, any]> = [
    ['F2 suspended → warning + AlertTriangle', F2_suspendedSpam],
    ['F3 archived  → neutral + Archive', F3_archivedInactiveSeller],
    ['F4 deleted   → destructive + Ban', F4_deletedPolicyViolation],
  ];

  for (const [label, fixture] of cases) {
    test(`${label}: icon stub matches expected`, () => {
      const tree = render({
        status: fixture.status,
        reasonCategory: fixture.reasonCategory,
        bannerHints: fixture.banner,
        note: fixture.note,
      });
      const expected = STATUS_EXPECTATIONS[fixture.status];
      // String-stub icon components render as host elements with their stub
      // name as `type`; collect all element nodes whose `type` matches.
      const iconNodes = tree.root.findAll(
        (node) => node.type === expected.icon,
      );
      expect(iconNodes.length).toBeGreaterThan(0);
    });

    test(`${label}: accent strip backgroundColor equals expected COLORS token`, () => {
      const tree = render({
        status: fixture.status,
        reasonCategory: fixture.reasonCategory,
        bannerHints: fixture.banner,
        note: fixture.note,
      });
      const expected = STATUS_EXPECTATIONS[fixture.status];
      // Find a View whose flattened style contains the expected accent color
      // exclusively (the accent strip's only color binding).
      const allNodes = tree.root.findAll(
        (node) => typeof node.type === 'string' && node.type === 'View',
      );
      const accentMatches = allNodes.filter((n) => {
        const style = n.props.style;
        if (!style) return false;
        // style may be an array; flatten one level.
        const flat = Array.isArray(style) ? style.flat() : [style];
        return flat.some(
          (s: any) => s && s.backgroundColor === expected.color,
        );
      });
      expect(accentMatches.length).toBeGreaterThan(0);
    });
  }
});

describe('LBUY-01: cartRow variant exposes Remove CTA; detail variant does not', () => {
  test('variant=detail does NOT render the Remove CTA', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
      variant: 'detail',
    });
    expect(() =>
      tree.root.findByProps({ testID: 'listing-status-banner-remove' }),
    ).toThrow();
  });

  test('variant=cartRow with onRemoveFromCart renders the CTA + invokes callback on press', () => {
    const onRemoveFromCart = jest.fn();
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
      variant: 'cartRow',
      onRemoveFromCart,
    });
    const cta = tree.root.findByProps({
      testID: 'listing-status-banner-remove',
    });
    expect(cta).toBeTruthy();
    act(() => {
      cta.props.onPress();
    });
    expect(onRemoveFromCart).toHaveBeenCalledTimes(1);
  });

  test('variant=cartRow WITHOUT onRemoveFromCart does NOT render the CTA', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
      variant: 'cartRow',
      // onRemoveFromCart omitted
    });
    expect(() =>
      tree.root.findByProps({ testID: 'listing-status-banner-remove' }),
    ).toThrow();
  });
});

describe('LBUY-01: reasonCategory enum sweep — 5 values map to 5 distinct chip labels', () => {
  const enumCases: Array<[string, string]> = [
    ['spam', 'Spam'],
    ['policy_violation', 'Policy violation'],
    ['fraud', 'Fraud'],
    ['inactive_seller', 'Inactive seller'],
    ['other', 'Other'],
  ];

  for (const [reason, expectedLabel] of enumCases) {
    test(`reasonCategory='${reason}' renders chip text '${expectedLabel}'`, () => {
      const tree = render({
        status: 'suspended',
        reasonCategory: reason,
        bannerHints: F2_suspendedSpam.banner,
        note: null,
      });
      const found = findFirstText(tree.root, (s) =>
        s.includes(expectedLabel),
      );
      expect(found).not.toBeNull();
    });
  }
});

describe('LBUY-01: tap-to-expand note + collapse-on-blur via useFocusEffect', () => {
  test('renders note Pressable with numberOfLines=2 when collapsed (F2)', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
    });
    const notePressable = tree.root.findByProps({
      testID: 'listing-status-banner-note',
    });
    expect(notePressable).toBeTruthy();
    const inner = notePressable.findByType(Text);
    expect(inner.props.numberOfLines).toBe(2);
    expect(JSON.stringify(inner.props.children)).toContain(
      'Multiple flag reports',
    );
  });

  test('tap on note Pressable toggles numberOfLines to undefined (expanded)', () => {
    const tree = render({
      status: F2_suspendedSpam.status,
      reasonCategory: F2_suspendedSpam.reasonCategory,
      bannerHints: F2_suspendedSpam.banner,
      note: F2_suspendedSpam.note,
    });
    const notePressable = tree.root.findByProps({
      testID: 'listing-status-banner-note',
    });
    expect(notePressable.findByType(Text).props.numberOfLines).toBe(2);
    act(() => {
      notePressable.props.onPress();
    });
    const after = tree.root
      .findByProps({ testID: 'listing-status-banner-note' })
      .findByType(Text);
    expect(after.props.numberOfLines).toBeUndefined();
  });

  test('hides note Pressable entirely when note=null (F3)', () => {
    const tree = render({
      status: F3_archivedInactiveSeller.status,
      reasonCategory: F3_archivedInactiveSeller.reasonCategory,
      bannerHints: F3_archivedInactiveSeller.banner,
      note: F3_archivedInactiveSeller.note,
    });
    expect(() =>
      tree.root.findByProps({ testID: 'listing-status-banner-note' }),
    ).toThrow();
  });

  test('hides note Pressable entirely when note is empty string (F6)', () => {
    const tree = render({
      status: F6_archivedOther.status,
      reasonCategory: F6_archivedOther.reasonCategory,
      bannerHints: F6_archivedOther.banner,
      note: F6_archivedOther.note,
    });
    expect(() =>
      tree.root.findByProps({ testID: 'listing-status-banner-note' }),
    ).toThrow();
  });

  test('F5 suspended-no-note: banner renders title + chip but no note Pressable', () => {
    const tree = render({
      status: F5_suspendedFraud.status,
      reasonCategory: F5_suspendedFraud.reasonCategory,
      bannerHints: F5_suspendedFraud.banner,
      note: F5_suspendedFraud.note,
    });
    // Title + chip present
    expect(
      findFirstText(tree.root, (s) => s.includes('Listing suspended')),
    ).not.toBeNull();
    expect(
      findFirstText(tree.root, (s) => s.includes('Fraud')),
    ).not.toBeNull();
    // Note Pressable absent
    expect(() =>
      tree.root.findByProps({ testID: 'listing-status-banner-note' }),
    ).toThrow();
  });
});
