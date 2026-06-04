export interface TypographyFamilies {
  display: string | undefined;
  mono:    string | undefined;
  weights: {
    regular:  '400';
    medium:   '500';
    semibold: '600';
    bold:     '700';
    black:    '800';
  };
}

const WEIGHTS = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '800',
} as const;

export function useTypography(): TypographyFamilies {
  // V2 is the only UI; typography is hardcoded to the V2 font families.
  return {
    display: 'Manrope',
    mono:    'JetBrainsMono-Medium',
    weights: WEIGHTS,
  };
}
