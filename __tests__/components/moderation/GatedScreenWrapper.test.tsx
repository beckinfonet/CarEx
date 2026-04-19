/**
 * Phase 6 — Wave 0 scaffold
 *
 * Scaffold for src/components/moderation/GatedScreenWrapper.tsx (not yet created).
 * Every `test.todo` below corresponds to a locked behavior in
 * .planning/phases/06-affected-user-ux-security-review/06-UI-SPEC.md §Component 3
 * and 06-PATTERNS.md §GatedScreenWrapper (CAPABILITY_ALIASES + all_writes predicate).
 *
 * CRITICAL: this scaffold locks both the `apply_as_provider` frontend alias
 * (resolves to `request_broker_role` ∪ `request_logistics_role`) AND the
 * `all_writes` sentinel branch. UI-SPEC's implementation sketch omits both —
 * RESEARCH §Capability Contract Verification + §Pitfall 6 document the corrections.
 * Wave 2+ implementers MUST satisfy these test.todos; copying UI-SPEC's sketch
 * verbatim will fail the alias and sentinel branches.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GatedScreenWrapper } from '../../../src/components/moderation/GatedScreenWrapper';

// Skeletal mocks — scaffolds do not run assertions yet; they only need to compile.
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: {} }),
}));

describe('GatedScreenWrapper (Phase 6 — AFF-04 — capability alias + all_writes sentinel)', () => {
  // Pass-through when not gated
  test.todo('returns children unchanged when state === "active"');
  test.todo('returns children unchanged when state === "feature_limited" but capability not in restrictedFeatures');

  // feature_limited — specific capability key path
  test.todo('gates when state === "feature_limited" and restrictedFeatures includes "create_listing" for capability="create_listing"');
  test.todo('gates when state === "feature_limited" and restrictedFeatures includes "create_order" for capability="create_order"');
  test.todo('gates when state === "feature_limited" and restrictedFeatures includes "contact_seller" for capability="contact_seller"');

  // apply_as_provider FRONTEND ALIAS — critical finding (RESEARCH §Capability Contract Verification)
  test.todo('gates capability="apply_as_provider" when restrictedFeatures includes "request_broker_role" (frontend alias)');
  test.todo('gates capability="apply_as_provider" when restrictedFeatures includes "request_logistics_role" (frontend alias)');
  test.todo('does NOT gate capability="apply_as_provider" when restrictedFeatures contains only unrelated keys (e.g. ["request_seller_role"]) — alias map is exactly {request_broker_role, request_logistics_role}');

  // all_writes sentinel branch — critical finding (RESEARCH §Pitfall 6)
  test.todo('gates ALL capabilities when state === "blocked_with_review" and restrictedFeatures === ["all_writes"] (sentinel path)');
  test.todo('gates ALL capabilities when state === "permanently_banned" and restrictedFeatures === ["all_writes"] (sentinel path)');

  // Render structure
  test.todo('wraps children in View with pointerEvents="none" when gated');
  test.todo('renders <FeatureGateOverlay capability={capability} /> as a sibling (not a child) of the pointerEvents=none subtree');
  test.todo('sets testID="gated-screen-wrapper-{capability}" on the outer wrapper View when gated');
});
