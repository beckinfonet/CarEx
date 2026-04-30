import React, { useCallback, useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';

type ResizeMode = 'contain' | 'cover' | 'stretch' | 'center';

type OptimizedImageProps = Omit<FastImageProps, 'source'> & {
  source: { uri: string } | ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
};

const MAX_RETRIES = 2;

/**
 * Uses FastImage for remote URIs:
 * - Android: Fixes blank/black image display (Glide)
 * - iOS: Fixes EXIF orientation so vertical/horizontal photos display correctly (SDWebImage)
 * Falls back to standard Image for local assets (require()).
 *
 * On Android, FastImage piggybacks on RN's shared OkHttpClient (5 reqs/host) and Glide
 * negative-caches load failures with no auto-retry. When 10-25 photos mount at once,
 * queued requests time out and stay blank forever. We retry on error with a cache-busting
 * query param so Glide treats the retry as a fresh resource.
 */
export const OptimizedImage = ({ source, style, resizeMode = 'cover', onError, ...rest }: OptimizedImageProps) => {
  const isRemoteUri = typeof source === 'object' && source !== null && 'uri' in source && typeof (source as { uri: string }).uri === 'string';
  const baseUri = isRemoteUri ? (source as { uri: string }).uri : null;

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setRetryCount(0);
  }, [baseUri]);

  const handleError = useCallback(() => {
    setRetryCount((prev) => (prev < MAX_RETRIES ? prev + 1 : prev));
    if (onError) onError();
  }, [onError]);

  if (isRemoteUri && baseUri) {
    const sep = baseUri.includes('?') ? '&' : '?';
    const uri = retryCount > 0 ? `${baseUri}${sep}_retry=${retryCount}` : baseUri;
    const remoteSource = { ...(source as { uri: string }), uri };
    return (
      <FastImage
        {...rest}
        source={remoteSource}
        style={style}
        resizeMode={resizeMode}
        onError={handleError}
      />
    );
  }

  return <Image source={source as ImageSourcePropType} style={style} resizeMode={resizeMode} />;
};
