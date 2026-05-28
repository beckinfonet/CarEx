// v2 ("Editorial") design tokens. Separate from src/constants/theme.ts so v1
// components continue using COLORS/SIZES unchanged. Gold tokens (gold,
// goldGlow) intentionally omitted — all gold ornaments are cut from this
// milestone (see spec §5 cut list). Reintroduce when the backend grows a
// `promoted` flag and the visual treatments come online.
export const V2 = {
  bg:        '#08090C',
  surface:   '#13151B',
  surfaceHi: '#1C1F28',
  surfaceLo: '#0E1015',
  border:    'rgba(255,255,255,0.06)',
  borderHi:  'rgba(255,255,255,0.14)',
  text:      '#F6F7FB',
  textMuted: 'rgba(246,247,251,0.62)',
  textFaint: 'rgba(246,247,251,0.38)',
  blue:      '#4DA3FF',
  blueDeep:  '#1C5FC4',
  blueGlow:  'rgba(77,163,255,0.42)',
  green:     '#67E8B6',
  red:       '#FF7A8E',
  favorite:  '#FF5D7A',
  radius: { hero: 24, big: 22, small: 16.5, shelf: 18, pill: 999 } as const,
} as const;
