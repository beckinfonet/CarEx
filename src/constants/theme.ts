export const COLORS = {
  // --- Existing core (preserved verbatim — DO NOT change) ---
  background: '#0F1115', // Very dark blue-grey, sleek
  cardBackground: '#181B21', // Slightly lighter blue-grey
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF', // Cool grey
  textTertiary: '#6B7280',
  accent: '#3B82F6', // Corporate Blue (Business-like, Trustworthy)
  border: '#2A2F3A',
  searchBackground: '#232730',
  success: '#22C55E', // KEEP — existing call sites depend on this

  // --- Phase 5 additions (UI-SPEC §11) ---
  textTertiaryStrong: '#D1D5DB', // stronger neutral for reason chips
  successFg: '#4ADE80', // aligned with moderation.active.fg
  destructive: '#EF4444', // explicit token (was ad-hoc before)
  warning: '#F59E0B', // amber — superadmin, destructive warnings in modals

  // Severity palette — Phase 6 UserStatusBanner imports this verbatim
  moderation: {
    active: { bg: 'rgba(34, 197, 94, 0.15)', fg: '#4ADE80', border: '#4ADE80' },
    featureLimited: { bg: 'rgba(245, 158, 11, 0.15)', fg: '#FBBF24', border: '#FBBF24' },
    blockedReview: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#F87171', border: '#F87171' },
    permaBanned: { bg: 'rgba(156, 163, 175, 0.15)', fg: '#9CA3AF', border: '#6B7280' },
  },

  // Role badge palette
  role: {
    admin: { bg: 'rgba(245, 158, 11, 0.15)', fg: '#F59E0B' },
    broker: { bg: 'rgba(59, 130, 246, 0.15)', fg: '#3B82F6' },
    seller: { bg: 'rgba(6, 182, 212, 0.15)', fg: '#22D3EE' },
    logistics: { bg: 'rgba(167, 139, 250, 0.15)', fg: '#A78BFA' },
  },
};

export const SIZES = {
  // --- Existing (preserved verbatim) ---
  padding: 16,
  borderRadius: 12,
  iconSize: 24,

  // --- Phase 5 additions (UI-SPEC §11) ---
  spacingXs: 4,
  spacingSm: 8,
  spacingMd: 16, // alias for padding; use spacingMd in new code
  spacingLg: 24,
  spacingXl: 32,
  spacing2xl: 48,
  radiusSm: 8, // chips, inputs, buttons
  radiusMd: 12, // alias for borderRadius; cards
  radiusPill: 999, // badges
  minTapTarget: 44, // minimum touch zone
  badgeHeight: 22, // severity badge height
  chipHeight: 32, // filter chip height
  bottomSheetHandleWidth: 36,
  bottomSheetHandleHeight: 4,
};

export const TYPOGRAPHY = {
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 }, // badge labels
  label: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  labelStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 }, // primary row text
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  display: { fontSize: 28, fontWeight: '600' as const, lineHeight: 34 },
};
