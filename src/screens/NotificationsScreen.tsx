import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BellOff } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationFeedItem } from '../components/notifications/NotificationFeedItem';
import { NotificationItem } from '../services/notifications/NotificationService';
import { RootStackParamList } from '../types/navigation';

/**
 * NotificationsScreen — the in-app notification center (NCEN-02/03/04/05,
 * NPRF-07). Overwrites the 12-06 placeholder.
 *
 * Feed: reverse-chronological, cursor-paginated (NCEN-02). The context already
 * returns items newest-first; `onEndReached` appends the next cursor page via
 * `loadMore`, `RefreshControl` re-fetches the first page via `refresh`.
 *
 * Tap → markRead THEN deeplink routing (NCEN-03/04). The resolver below maps a
 * SERVER-BUILT `data.deeplink` string to a typed navigation call through a
 * TWO-PREFIX WHITELIST only (T-12-08-01): never evals arbitrary targets.
 *
 * Empty state (NCEN-05): `BellOff` + onboarding copy guiding first-timers to
 * create subscriptions on CarDetails / search results (creation does not happen
 * here). Feed-load failure shows a non-blocking pull-to-refresh error line and
 * keeps the list mounted — NPRF-07 never dead-ends.
 */

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Numeric saved-search criteria keys coerced to Number when present.
const NUMERIC_FILTER_KEYS = [
  'priceMin',
  'priceMax',
  'yearMin',
  'yearMax',
];
const STRING_FILTER_KEYS = ['makeId', 'modelId', 'bodyType'];

/**
 * Minimal query-string parser (`a=1&b=2` → `{ a: '1', b: '2' }`). Avoids any
 * reliance on the RN runtime's partial `URLSearchParams` typing/availability;
 * values are URI-decoded, empty/keyless pairs skipped.
 */
function parseQueryString(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query) return out;
  query.split('&').forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawVal = eq >= 0 ? pair.slice(eq + 1) : '';
    if (!rawKey) return;
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
    } catch {
      out[rawKey] = rawVal;
    }
  });
  return out;
}

/**
 * Resolve a server-built `carex://...` deeplink to a typed navigation call.
 *
 * Whitelist (T-12-08-01) — only two prefixes route; anything else no-ops:
 *   - carex://listing/:carId  → CarDetails  (WATCH events)
 *   - carex://search?<crit>   → SearchResults (NEW_MATCH saved-search hits)
 *
 * Legacy fallback: a bare `data.carId` (no deeplink) routes to CarDetails.
 * Never crashes on an unknown/malformed target.
 */
export function routeNotification(
  notification: NotificationItem,
  navigate: Nav['navigate'],
): void {
  const deeplink =
    typeof notification.data?.deeplink === 'string'
      ? notification.data.deeplink
      : undefined;

  if (deeplink) {
    // --- WATCH: carex://listing/:carId → CarDetails ---
    const listingMatch = deeplink.match(/^carex:\/\/listing\/([^/?#]+)/);
    if (listingMatch) {
      navigate('CarDetails', { carId: decodeURIComponent(listingMatch[1]) });
      return;
    }

    // --- NEW_MATCH: carex://search?<criteria> → SearchResults(filters) ---
    if (deeplink.startsWith('carex://search')) {
      const qIndex = deeplink.indexOf('?');
      const query = qIndex >= 0 ? deeplink.slice(qIndex + 1) : '';
      const params = parseQueryString(query);

      const initialFilters: { [key: string]: any } = {};
      STRING_FILTER_KEYS.forEach((key) => {
        const v = params[key];
        if (v != null && v !== '') {
          initialFilters[key] = v;
        }
      });
      NUMERIC_FILTER_KEYS.forEach((key) => {
        const v = params[key];
        if (v != null && v !== '') {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            initialFilters[key] = n;
          }
        }
      });

      const initialQuery = params.initialQuery || '';

      navigate('SearchResults', {
        initialQuery,
        ...(Object.keys(initialFilters).length > 0 ? { initialFilters } : {}),
      });
      return;
    }

    // --- UNLOCK: carex://my-requests → MyRequests ---
    if (
      deeplink.startsWith('carex://my-requests') ||
      deeplink.includes('/my-requests')
    ) {
      navigate('MyRequests');
      return;
    }

    // Unknown prefix — do not crash, do not navigate (T-12-08-01).
    return;
  }

  // Legacy fallback: bare carId on the data payload routes to CarDetails.
  const legacyCarId = notification.data?.carId;
  if (typeof legacyCarId === 'string' && legacyCarId) {
    navigate('CarDetails', { carId: legacyCarId });
  }
}

const NotificationsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const {
    feed,
    loading,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    unreadCount,
  } = useNotifications();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePress = useCallback(
    (notification: NotificationItem) => {
      // markRead BEFORE navigate (NCEN-04): the row is consumed on open.
      if (!notification.read) {
        markRead(notification._id);
      }
      routeNotification(notification, navigation.navigate);
    },
    [markRead, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationFeedItem notification={item} onPress={handlePress} t={t} />
    ),
    [handlePress, t],
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <BellOff size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyHeading}>{t.notificationsEmptyHeading}</Text>
      <Text style={styles.emptyBody}>{t.notificationsEmptyBody}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.notifications}</Text>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={() => markAllRead()}
          disabled={unreadCount === 0}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.markAllText,
              unreadCount === 0 && styles.markAllTextDisabled,
            ]}
          >
            {t.markAllRead}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          feed.length === 0 ? styles.emptyContent : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => refresh()}
            tintColor={COLORS.accent}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: SIZES.minTapTarget,
    height: SIZES.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -SIZES.spacingSm,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: SIZES.spacingSm,
  },
  markAllButton: {
    minHeight: SIZES.minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacingSm,
  },
  markAllText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accent,
    fontWeight: '600',
  },
  markAllTextDisabled: {
    color: COLORS.textTertiary,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacingXl,
    paddingVertical: SIZES.spacing2xl,
  },
  emptyHeading: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SIZES.spacingLg,
  },
  emptyBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.spacingSm,
  },
});

export default NotificationsScreen;
