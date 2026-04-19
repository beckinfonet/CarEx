/**
 * Phase 6 Plan 06-04 — FeatureGateOverlay real-assertion suite (Wave 2)
 *
 * Converts the Wave-0 scaffold's 10 placeholder entries into executable tests
 * locking AFF-04 (dim layer + card + severity palette + icon + capability-
 * key-driven copy lookup + feature_limited-only CTA visibility).
 *
 * Harness: react-test-renderer + stable Proxy mockT (Plan 05-10 lesson +
 * Plan 06-03 pattern). Proxy returns the key name for every key lookup so
 * render-side assertions can match on literal key strings — exactly what
 * the capability-key copy matrix needs (test 11 / 12).
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { FeatureGateOverlay } from '../../../src/components/moderation/FeatureGateOverlay';

// Stable Proxy: any key lookup returns the literal key name. Hoist-safe name
// prefix `mock*` satisfies babel-plugin-jest-hoist allowlist so jest.mock
// can reference it without "out of scope" errors.
const mockT = new Proxy({} as any, {
  get: (_target, key) => String(key),
});

let mockUser: any = null;
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));

afterEach(() => {
  mockUser = null;
});

function render(capability: any = 'create_listing') {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <FeatureGateOverlay capability={capability} />,
    );
  });
  return tree;
}

// Flatten RN style prop (array | object | falsy) into a single object for
// property-specific assertions (backgroundColor / borderLeftColor).
function flattenStyle(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, any>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return style as Record<string, any>;
}

describe('FeatureGateOverlay (Phase 6 — AFF-04)', () => {
  // ---- 1. null-render branches -------------------------------------------

  test('returns null when state === "active"', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'active' },
    };
    const tree = render('create_listing');
    expect(tree.toJSON()).toBeNull();
  });

  test('returns null when user is null', () => {
    mockUser = null;
    const tree = render('create_listing');
    expect(tree.toJSON()).toBeNull();
  });

  // ---- 2. dim + card present for each non-active severity ----------------

  test('renders dim + card for feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render('create_listing');
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-card' }),
    ).toBeTruthy();
  });

  test('renders dim + card for blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'blocked_with_review' },
    };
    const tree = render('create_listing');
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-card' }),
    ).toBeTruthy();
  });

  test('renders dim + card for permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render('create_listing');
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-card' }),
    ).toBeTruthy();
  });

  // ---- 3. dim layer backgroundColor is the exact theme-derived rgba -------

  test('dim layer backgroundColor is rgba(15, 17, 21, 0.7)', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render('create_listing');
    const dim = tree.root.findByProps({
      testID: 'feature-gate-overlay-dim',
    });
    const merged = flattenStyle(dim.props.style);
    expect(merged.backgroundColor).toBe('rgba(15, 17, 21, 0.7)');
  });

  // ---- 4. card borderLeftColor matches palette.border per severity -------

  const BORDER_BY_SEVERITY: Array<[string, string]> = [
    ['feature_limited', '#FBBF24'],
    ['blocked_with_review', '#F87171'],
    ['permanently_banned', '#6B7280'],
  ];

  test.each(BORDER_BY_SEVERITY)(
    'card borderLeftColor matches palette.border for %s',
    (state, expectedBorder) => {
      mockUser = {
        localId: 'u1',
        moderationStatus: { state },
      };
      const tree = render('create_listing');
      const card = tree.root.findByProps({
        testID: 'feature-gate-overlay-card',
      });
      const merged = flattenStyle(card.props.style);
      expect(merged.borderLeftColor).toBe(expectedBorder);
      // borderLeftWidth is 4 by source contract — extra safety to prevent a
      // regression where the accent bar silently widens/narrows.
      expect(merged.borderLeftWidth).toBe(4);
    },
  );

  // ---- 5. severity-correct icon ------------------------------------------

  test('uses AlertTriangle for feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render('create_listing');
    expect(tree.root.findByType(AlertTriangle)).toBeTruthy();
  });

  test('uses ShieldAlert for blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'blocked_with_review' },
    };
    const tree = render('create_listing');
    expect(tree.root.findByType(ShieldAlert)).toBeTruthy();
  });

  test('uses Ban for permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render('create_listing');
    expect(tree.root.findByType(Ban)).toBeTruthy();
  });

  // ---- 6. Capability-key driven copy lookup (D-05) ------------------------

  test('title+body keys — capability=create_listing, severity=feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render('create_listing');
    const card = tree.root.findByProps({
      testID: 'feature-gate-overlay-card',
    });
    // accessibilityLabel = `${title}. ${body}` — Proxy mockT returns the
    // literal key name, so the label is the concatenation of the two keys.
    expect(card.props.accessibilityLabel).toBe(
      'gateCreateListingFeatureLimitedTitle. gateCreateListingFeatureLimitedBody',
    );
  });

  test('title key — capability=apply_as_provider, severity=permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render('apply_as_provider');
    const card = tree.root.findByProps({
      testID: 'feature-gate-overlay-card',
    });
    // Severity key-part for permanently_banned is 'Banned' (NOT the state
    // name 'PermanentlyBanned') — locks the SEVERITY_TO_KEY_PART mapping.
    expect(card.props.accessibilityLabel).toContain(
      'gateApplyProviderBannedTitle',
    );
    expect(card.props.accessibilityLabel).toContain(
      'gateApplyProviderBannedBody',
    );
  });

  test('title key — capability=contact_seller, severity=blocked_with_review', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'blocked_with_review' },
    };
    const tree = render('contact_seller');
    const card = tree.root.findByProps({
      testID: 'feature-gate-overlay-card',
    });
    // blocked_with_review → 'Blocked' key part (NOT 'BlockedWithReview').
    expect(card.props.accessibilityLabel).toContain(
      'gateContactSellerBlockedTitle',
    );
  });

  // ---- 7. CTA visibility — feature_limited ONLY (D-06) -------------------

  test('renders Restore-profile CTA for feature_limited', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'feature_limited' },
    };
    const tree = render('create_listing');
    const cta = tree.root.findByProps({
      testID: 'feature-gate-overlay-cta',
    });
    expect(cta).toBeTruthy();
    // CTA label uses t.restoreProfile (Proxy returns the literal key name).
    expect(cta.props.accessibilityLabel).toBe('restoreProfile');
  });

  test('does NOT render CTA for blocked_with_review (banner owns appeal per D-06)', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'blocked_with_review' },
    };
    const tree = render('create_listing');
    expect(() =>
      tree.root.findByProps({ testID: 'feature-gate-overlay-cta' }),
    ).toThrow();
  });

  test('does NOT render CTA for permanently_banned', () => {
    mockUser = {
      localId: 'u1',
      moderationStatus: { state: 'permanently_banned' },
    };
    const tree = render('create_listing');
    expect(() =>
      tree.root.findByProps({ testID: 'feature-gate-overlay-cta' }),
    ).toThrow();
  });
});
