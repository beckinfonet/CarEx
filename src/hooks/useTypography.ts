import { useUIVersion } from '../context/UIVersionContext';

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
  const { version } = useUIVersion();
  return {
    display: version === 'v2' ? 'Manrope'              : undefined,
    mono:    version === 'v2' ? 'JetBrainsMono-Medium' : undefined,
    weights: WEIGHTS,
  };
}
