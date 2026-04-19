/**
 * Phase 6 — Wave 0 scaffold
 *
 * Scaffold for src/components/moderation/FeatureGateOverlay.tsx (not yet created).
 * Every `test.todo` below corresponds to a locked behavior in
 * .planning/phases/06-affected-user-ux-security-review/06-UI-SPEC.md §Component 2.
 *
 * Wave 2+ plans MUST replace each test.todo with a real assertion before
 * declaring completion. The import below intentionally points at a path
 * that does not resolve yet — scaffold wiring.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FeatureGateOverlay } from '../../../src/components/moderation/FeatureGateOverlay';

// Skeletal mocks — scaffolds do not run assertions yet; they only need to compile.
jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: {} }),
}));

describe('FeatureGateOverlay (Phase 6 — AFF-04)', () => {
  test.todo('returns null when user.moderationStatus.state === "active"');
  test.todo('renders dim layer (feature-gate-overlay-dim) with backgroundColor rgba(15, 17, 21, 0.7)');
  test.todo('renders overlay card (feature-gate-overlay-card) with borderLeftWidth 4 and borderLeftColor matching severity palette');
  test.todo('uses AlertTriangle icon for feature_limited severity');
  test.todo('uses ShieldAlert icon for blocked_with_review severity');
  test.todo('uses Ban icon for permanently_banned severity');
  test.todo('looks up title + body from t[gate{Capability}{Severity}Title/Body] — capability-key driven copy per D-05');
  test.todo('renders Restore-profile CTA (feature-gate-overlay-cta) ONLY when severity === "feature_limited"');
  test.todo('does NOT render any CTA when severity === "blocked_with_review" (banner owns the appeal CTA per D-06)');
  test.todo('does NOT render any CTA when severity === "permanently_banned"');
});
