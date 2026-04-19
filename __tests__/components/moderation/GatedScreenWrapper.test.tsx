/**
 * Phase 6 Plan 06-05 — GatedScreenWrapper real-assertion suite (Wave 2)
 *
 * Converts the Wave-0 scaffold's 13 placeholder entries into executable tests
 * locking the AFF-04 predicate contract:
 *   - pass-through when not gated (state === 'active' or capability not in
 *     restrictedFeatures)
 *   - frontend alias: apply_as_provider gates on EITHER request_broker_role
 *     OR request_logistics_role (RESEARCH §Capability Contract Verification)
 *   - all_writes sentinel: gates ALL capabilities when present in
 *     restrictedFeatures, regardless of the capability prop (RESEARCH
 *     §Pitfall 6; UI-SPEC §Component 3 sketch missed this branch)
 *   - gated render structure: outer testID + pointerEvents="none" inner
 *     wrapper + sibling FeatureGateOverlay
 *
 * Harness: react-test-renderer + stable Proxy mockT (Plan 05-10 lesson +
 * Plan 06-03/06-04 pattern). The pass-through tests render a plain child
 * `<View testID="child-marker" />` and assert it is present; the gated tests
 * assert both the wrapper testID AND the overlay dim testID are present.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { GatedScreenWrapper } from '../../../src/components/moderation/GatedScreenWrapper';

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

function render(capability: any, children: React.ReactNode) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <GatedScreenWrapper capability={capability}>{children}</GatedScreenWrapper>,
    );
  });
  return tree;
}

function setUser(state: string | undefined, restrictedFeatures: string[] = []) {
  mockUser = {
    localId: 'u1',
    moderationStatus: state ? { state, restrictedFeatures } : undefined,
  };
}

describe('GatedScreenWrapper (Phase 6 — AFF-04 — capability alias + all_writes sentinel)', () => {
  // ---- 1. Pass-through branches ------------------------------------------

  test('pass-through when state === "active"', () => {
    setUser('active', []);
    const tree = render('create_listing', <View testID="child-marker" />);
    expect(tree.root.findByProps({ testID: 'child-marker' })).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: 'gated-screen-wrapper-create_listing' }),
    ).toThrow();
  });

  test('pass-through when state === "feature_limited" but capability NOT in restrictedFeatures', () => {
    setUser('feature_limited', ['create_order']);
    const tree = render('create_listing', <View testID="child-marker" />);
    expect(tree.root.findByProps({ testID: 'child-marker' })).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: 'gated-screen-wrapper-create_listing' }),
    ).toThrow();
  });

  // ---- 2. Literal capability-key gating (feature_limited) ----------------

  test('gates when state === "feature_limited" AND restrictedFeatures includes "create_listing"', () => {
    setUser('feature_limited', ['create_listing']);
    const tree = render('create_listing', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-create_listing' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('gates when state === "feature_limited" AND restrictedFeatures includes "create_order"', () => {
    setUser('feature_limited', ['create_order']);
    const tree = render('create_order', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-create_order' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('gates when state === "feature_limited" AND restrictedFeatures includes "contact_seller"', () => {
    setUser('feature_limited', ['contact_seller']);
    const tree = render('contact_seller', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-contact_seller' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  // ---- 3. Alias branch — apply_as_provider (RESEARCH §Capability Contract) ----

  test('gates capability="apply_as_provider" when restrictedFeatures includes "request_broker_role" (frontend alias)', () => {
    setUser('feature_limited', ['request_broker_role']);
    const tree = render('apply_as_provider', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-apply_as_provider' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('gates capability="apply_as_provider" when restrictedFeatures includes "request_logistics_role" (frontend alias)', () => {
    setUser('feature_limited', ['request_logistics_role']);
    const tree = render('apply_as_provider', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-apply_as_provider' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('does NOT gate capability="apply_as_provider" when restrictedFeatures contains only "request_seller_role" — alias map is narrow', () => {
    // Locks CAPABILITY_ALIASES narrowness: seller-role is NOT in the alias map.
    // Any future refactor that silently expands the map will break this test.
    setUser('feature_limited', ['request_seller_role']);
    const tree = render('apply_as_provider', <View testID="child-marker" />);
    expect(tree.root.findByProps({ testID: 'child-marker' })).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: 'gated-screen-wrapper-apply_as_provider' }),
    ).toThrow();
  });

  // ---- 4. Sentinel branch — all_writes (RESEARCH §Pitfall 6) --------------

  test('gates when state === "blocked_with_review" AND restrictedFeatures === ["all_writes"] (sentinel path)', () => {
    setUser('blocked_with_review', ['all_writes']);
    const tree = render('create_listing', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-create_listing' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('gates when state === "permanently_banned" AND restrictedFeatures === ["all_writes"] (sentinel path)', () => {
    setUser('permanently_banned', ['all_writes']);
    const tree = render('contact_seller', <View testID="child-marker" />);
    expect(
      tree.root.findByProps({ testID: 'gated-screen-wrapper-contact_seller' }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('sentinel "all_writes" gates ALL 4 capabilities (loop coverage)', () => {
    const capabilities = [
      'create_listing',
      'create_order',
      'contact_seller',
      'apply_as_provider',
    ] as const;
    for (const cap of capabilities) {
      setUser('blocked_with_review', ['all_writes']);
      const tree = render(cap, <View testID="child-marker" />);
      expect(
        tree.root.findByProps({ testID: `gated-screen-wrapper-${cap}` }),
      ).toBeTruthy();
    }
  });

  // ---- 5. Render structure — pointerEvents + sibling overlay --------------

  // Helper: findByProps may match both the RN <View> React component AND the
  // underlying host View (both carry the forwarded testID prop). The host-
  // level instance is the one with the structural children we want to assert
  // on. Pick it by preferring the match whose type is the string 'View' (host),
  // falling back to the first match for older renderer versions that expose
  // only the composite.
  function findHostWrapper(root: any, testID: string) {
    const matches = root.findAllByProps({ testID });
    const host = matches.find(
      (m: any) => m.type === 'View' || typeof m.type === 'string',
    );
    return host ?? matches[matches.length - 1];
  }

  test('gated render wraps children in a View with pointerEvents="none"', () => {
    setUser('feature_limited', ['create_listing']);
    const tree = render('create_listing', <View testID="child-marker" />);
    const wrapper = findHostWrapper(
      tree.root,
      'gated-screen-wrapper-create_listing',
    );
    // Locate the inner View with pointerEvents="none" among the wrapper's
    // direct children, then confirm child-marker lives inside it.
    const innerPenNone = wrapper.children.find(
      (c: any) =>
        typeof c !== 'string' && c.props && c.props.pointerEvents === 'none',
    ) as any;
    expect(innerPenNone).toBeTruthy();
    expect(
      innerPenNone.findByProps({ testID: 'child-marker' }),
    ).toBeTruthy();
  });

  test('gated render: overlay is a SIBLING of pointerEvents="none" subtree, NOT a child', () => {
    setUser('feature_limited', ['create_listing']);
    const tree = render('create_listing', <View testID="child-marker" />);
    const wrapper = findHostWrapper(
      tree.root,
      'gated-screen-wrapper-create_listing',
    );
    // Direct children of the wrapper: one View (pointerEvents="none") + one
    // FeatureGateOverlay instance (which itself renders the overlay dim
    // testID as its outermost element). Length MUST be exactly 2.
    const directChildren = wrapper.children.filter(
      (c: any) => typeof c !== 'string',
    ) as any[];
    expect(directChildren.length).toBe(2);

    const innerPenNone = directChildren.find(
      (c: any) => c.props && c.props.pointerEvents === 'none',
    ) as any;
    expect(innerPenNone).toBeTruthy();

    // The overlay dim testID MUST NOT appear inside the pointerEvents="none"
    // subtree — otherwise the CTA would be rendered beneath a non-interactive
    // layer (T-06-03 regression).
    expect(() =>
      innerPenNone.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toThrow();

    // And it MUST appear as/under a sibling of that subtree.
    expect(
      tree.root.findByProps({ testID: 'feature-gate-overlay-dim' }),
    ).toBeTruthy();
  });

  test('testID for wrapper is exactly "gated-screen-wrapper-{capability}" for every capability', () => {
    const matrix: Array<[any, string]> = [
      ['create_listing', 'create_listing'],
      ['create_order', 'create_order'],
      ['contact_seller', 'contact_seller'],
      ['apply_as_provider', 'request_broker_role'],
    ];
    for (const [cap, restrictedKey] of matrix) {
      setUser('feature_limited', [restrictedKey]);
      const tree = render(cap, <View testID="child-marker" />);
      expect(
        tree.root.findByProps({ testID: `gated-screen-wrapper-${cap}` }),
      ).toBeTruthy();
    }
  });
});
