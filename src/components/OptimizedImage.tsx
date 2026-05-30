import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from 'react-native';
import FastImage, { FastImageProps, Priority } from 'react-native-fast-image';

type ResizeMode = 'contain' | 'cover' | 'stretch' | 'center';

type OptimizedImageProps = Omit<FastImageProps, 'source'> & {
  source: { uri: string } | ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  /**
   * FastImage fetch priority. Drives Glide's request ordering on Android so the
   * image the user is actually looking at can jump ahead of offscreen images in
   * the shared OkHttpClient queue (5 reqs/host). Defaults to 'normal'.
   */
  priority?: Priority;
};

const MAX_RETRIES = 2;
// Stagger retries instead of immediately re-queuing. An instant retry slams a
// fresh cache-busted URL onto the back of an already-saturated OkHttp queue,
// amplifying latency under load. A short backoff lets in-flight requests drain
// first so the retry has a free slot.
const RETRY_DELAY_MS = 600;

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
 *
 * Callers that mount many images at once (galleries, carousels) should pass `priority`:
 * 'high' for the visible slide, 'low' for offscreen images, so the viewed image isn't
 * starved behind offscreen fetches.
 */
export const OptimizedImage = ({ source, style, resizeMode = 'cover', priority = FastImage.priority.normal, onError, ...rest }: OptimizedImageProps) => {
  const isRemoteUri = typeof source === 'object' && source !== null && 'uri' in source && typeof (source as { uri: string }).uri === 'string';
  const baseUri = isRemoteUri ? (source as { uri: string }).uri : null;

  const [retryCount, setRetryCount] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRetryCount(0);
  }, [baseUri]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const handleError = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setRetryCount((prev) => (prev < MAX_RETRIES ? prev + 1 : prev));
    }, RETRY_DELAY_MS);
    if (onError) onError();
  }, [onError]);

  if (isRemoteUri && baseUri) {
    const sep = baseUri.includes('?') ? '&' : '?';
    const uri = retryCount > 0 ? `${baseUri}${sep}_retry=${retryCount}` : baseUri;
    const remoteSource = { ...(source as { uri: string }), uri, priority };
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
