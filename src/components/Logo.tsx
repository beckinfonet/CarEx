import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

export const Logo = ({ size = 1024, color = COLORS.accent }) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024">
    {/* Background - Optional, usually handled by the container or app icon generator */}
    {/* <Rect width="1024" height="1024" fill={color} rx="200" /> */}
    
    {/* Car Body */}
    <Path 
      d="M256 512 L320 384 H704 L768 512 V704 H704 V768 H640 V704 H384 V768 H320 V704 H256 V512 Z" 
      fill="none" 
      stroke={color} 
      strokeWidth="60" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    {/* Window Line */}
    <Path 
      d="M320 512 H704" 
      stroke={color} 
      strokeWidth="40" 
      strokeLinecap="round" 
    />
    {/* Wheels */}
    <Circle cx="352" cy="640" r="55" fill={color} />
    <Circle cx="672" cy="640" r="55" fill={color} />
  </Svg>
);

