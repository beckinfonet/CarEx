/**
 * Phase 6 Plan 06-05 — GatedScreenWrapper
 *
 * Predicate wrapper that decides whether to render a gated screen's children
 * verbatim, or to wrap them in a non-interactive subtree rendered as a sibling
 * of FeatureGateOverlay. Implements TWO branches that UI-SPEC's §Component 3
 * implementation sketch omits:
 *
 *   1. CAPABILITY_ALIASES — frontend alias map. apply_as_provider is a UI-only
 *      capability that resolves to EITHER backend STATUS_POLICY key for broker
 *      OR logistics role requests (RESEARCH §Capability Contract Verification
 *      Path 1). Literal backend capabilities (create_listing, create_order,
 *      contact_seller) alias to themselves — one-element arrays — so the
 *      predicate below is a single Array.some(...) shape regardless of the
 *      capability.
 *
 *   2. Sentinel SENTINEL — Phase 1 DATA-01 / D-12 set restrictedFeatures for
 *      blocked_with_review and permanently_banned users to a single-element
 *      sentinel array (NOT a fully-enumerated list). A naive
 *      restricted.includes('create_listing') returns false for those users
 *      even though the feature IS blocked. RESEARCH §Pitfall 6 documents the
 *      bug; this component encodes the fix.
 *
 * T-06-03 mitigation (elevation of privilege via gate bypass) is a two-
 * component contract:
 *   - This wrapper applies a touch-disabled subtree around the gated screen
 *     content so touches never reach its interactive surface.
 *   - FeatureGateOverlay (Plan 06-04) renders as a SIBLING of that subtree
 *     with pointerEvents="box-none" on its dim layer so the Restore CTA
 *     remains tap-interactive.
 *
 * Backend authorization remains authoritative per Phase 3 ENF-01 — this
 * component is UX only.
 */

import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { FeatureGateOverlay, type CapabilityKey } from './FeatureGateOverlay';

// Frontend alias: apply_as_provider is a UI-only capability that resolves to EITHER
// backend STATUS_POLICY key for broker OR logistics role requests.
// RESEARCH §Capability Contract Verification Path 1 (recommended resolution).
const CAPABILITY_ALIASES: Record<CapabilityKey, string[]> = {
  create_listing:    ['create_listing'],
  create_order:      ['create_order'],
  contact_seller:    ['contact_seller'],
  apply_as_provider: ['request_broker_role', 'request_logistics_role'],
};

interface Props {
  capability: CapabilityKey;
  children: React.ReactNode;
}

export const GatedScreenWrapper: React.FC<Props> = ({ capability, children }) => {
  const { user } = useAuth();
  const state: string = user?.moderationStatus?.state ?? 'active';
  const restricted: string[] = user?.moderationStatus?.restrictedFeatures ?? [];

  const backendKeys = CAPABILITY_ALIASES[capability];
  // Sentinel path gates ALL capabilities (blocked_with_review + permanently_banned).
  // RESEARCH §Pitfall 6 — UI-SPEC's sketch missed this branch.
  const sentinelGated = restricted.includes('all_writes');
  // Feature-limited: specific backend capability key(s) from the alias map.
  const keyGated = backendKeys.some(k => restricted.includes(k));
  const isGated = state !== 'active' && (sentinelGated || keyGated);

  if (!isGated) {
    return <>{children}</>;
  }

  return (
    <View style={{ flex: 1 }} testID={`gated-screen-wrapper-${capability}`}>
      <View style={{ flex: 1 }} pointerEvents="none">{children}</View>
      <FeatureGateOverlay capability={capability} />
    </View>
  );
};

// Re-export CapabilityKey so screens that import the wrapper can also grab the
// type from the same module (avoids cross-file import juggling for consumers).
export type { CapabilityKey };
