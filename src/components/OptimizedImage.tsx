import React from 'react';
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';

type ResizeMode = 'contain' | 'cover' | 'stretch' | 'center';

type OptimizedImageProps = Omit<FastImageProps, 'source'> & {
  source: { uri: string } | ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
};

/**
 * Uses FastImage for remote URIs:
 * - Android: Fixes blank/black image display (Glide)
 * - iOS: Fixes EXIF orientation so vertical/horizontal photos display correctly (SDWebImage)
 * Falls back to standard Image for local assets (require()).
 */
export const OptimizedImage = ({ source, style, resizeMode = 'cover', ...rest }: OptimizedImageProps) => {
  const isRemoteUri = typeof source === 'object' && source !== null && 'uri' in source && typeof (source as { uri: string }).uri === 'string';

  if (isRemoteUri && (source as { uri: string }).uri) {
    return (
      <FastImage
        source={source as { uri: string; headers?: Record<string, string> }}
        style={style}
        resizeMode={resizeMode}
        {...rest}
      />
    );
  }

  return <Image source={source as ImageSourcePropType} style={style} resizeMode={resizeMode} />;
};
