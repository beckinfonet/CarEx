import React from 'react';
import Svg, {
  Defs, RadialGradient, Stop, ClipPath, Circle, G, Path,
} from 'react-native-svg';

export interface LocaleGlobeProps {
  /** Rendered square size in px. Default 16 (matches the 28px locale pill). */
  size?: number;
}

/**
 * LocaleGlobe — a colorful, FLAG-FREE globe used as the locale signifier.
 *
 * Deliberately abstract: a generic ocean + non-geographic landmasses. It must NOT
 * resemble any real country. A globe reads as "language/locale" universally; pair it
 * with the two-letter language code (RU / EN) in LangSwitchV2 for an unambiguous control.
 *
 * Decorative — mark the wrapping pressable as the accessible element and keep this
 * out of the a11y tree (the parent button carries the label).
 */
export const LocaleGlobe: React.FC<LocaleGlobeProps> = ({ size = 16 }) => {
  // Unique ids so multiple instances don't collide on the gradient / clip refs.
  const uid = React.useId().replace(/[:]/g, '');
  const oid = `oc${uid}`;
  const cid = `cl${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Defs>
        <RadialGradient id={oid} cx="38%" cy="32%" r="78%">
          <Stop offset="0%" stopColor="#63C6F2" />
          <Stop offset="100%" stopColor="#2C7BBE" />
        </RadialGradient>
        <ClipPath id={cid}>
          <Circle cx="12" cy="12" r="9.3" />
        </ClipPath>
      </Defs>

      {/* ocean */}
      <Circle cx="12" cy="12" r="9.3" fill={`url(#${oid})`} />

      {/* abstract continents — non-geographic, clipped to the sphere */}
      <G clipPath={`url(#${cid})`}>
        <Path d="M4 7.5c2.4-1.2 4.6.2 5.4 1.6.8 1.5-.4 3.2-2.3 3.1-2.2-.1-4.5-2.9-3.1-4.7z" fill="#56BE82" />
        <Path d="M13.4 11c1.7-.7 3.7.6 3.6 2.3-.1 1.8-2.4 3-4 1.9-1.4-1-1.1-3.6.4-4.2z" fill="#56BE82" />
        <Path d="M8.6 15.4c1.1-.2 2.3.8 1.9 2.1-.5 1.4-2.7 1.3-3.3 0-.5-1 .3-1.9 1.4-2.1z" fill="#4DAE78" />
        <Path d="M17.5 6.6c.9-.2 1.8.7 1.4 1.7-.4 1-1.9 1-2.4 0-.4-.8.2-1.5 1-1.7z" fill="#56BE82" />
      </G>

      {/* meridian + equator grid */}
      <G stroke="rgba(255,255,255,0.32)" strokeWidth={0.65} fill="none">
        <Path d="M12 2.7a13 13 0 0 0 0 18.6M12 2.7a13 13 0 0 1 0 18.6M2.7 12h18.6" />
      </G>

      {/* rim */}
      <Circle cx="12" cy="12" r="9.3" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={0.9} />
    </Svg>
  );
};
