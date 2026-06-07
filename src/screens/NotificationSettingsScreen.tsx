import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  AppState,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import messaging from '@react-native-firebase/messaging';
import { ArrowLeft, Search, Car, Trash2, BellOff, Bell } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';
import { useNotifications } from '../context/NotificationContext';
import { Subscription } from '../services/notifications/NotificationService';
import { RootStackParamList } from '../types/navigation';

/**
 * NotificationSettingsScreen — preferences + subscription management
 * (NPRF-01/02/03/04, NSUB-03). Overwrites the 12-06 placeholder.
 *
 * Order per CTX D-11:
 *   1. Master mute (Switch) — reversible, no confirm (NPRF-01).
 *   2. Per-category toggles (Switch) — saved-search / watch (NPRF-01).
 *   3. Quiet-hours controls — default 22:00–08:00 (D-16); PLUMBING ONLY,
 *      persisted to notificationPrefs.quietHours; NOT enforced (Phase 14) (NPRF-03).
 *   4. Daily-cap control — default 3 (D-16); PLUMBING ONLY, persisted to
 *      notificationPrefs.dailyCap; NOT enforced (Phase 14) (NPRF-04).
 *   5. "My saved searches" list — each row: criteria summary + cadence selector
 *      (Instant selected accent / Daily DISABLED "Раз в день — скоро" with the
 *      daily-disabled hint on tap, D-10/NSUB-03) + inline delete (Alert.alert
 *      destructive confirm, D-11).
 *   6. "My watched cars" list — each row: car + per-event toggle summary (D-03)
 *      + inline delete (Alert.alert confirm, D-11).
 *
 * Persistence: mute / category / quiet-hours / daily-cap write to
 * User.notificationPrefs via the user-profile update path
 * (AuthService.updateBackendUser — these are profile fields; MOB-01 only forbids
 * notification ROUTER calls on AuthService). Subscription list/edit/delete go
 * through useNotifications (NotificationService).
 *
 * Quiet-hours + daily-cap are PERSISTED but NOT ENFORCED in Phase 12; the Daily
 * cadence is SHOWN-BUT-DISABLED (delivery is Phase 14). Daily MUST NOT be
 * selectable (D-10) — tapping it surfaces the coming-soon hint.
 */

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotificationSettings'>;

// Plumbing defaults (D-16). Persisted to notificationPrefs; NOT enforced in P12.
const DEFAULT_QUIET_START = '22:00';
const DEFAULT_QUIET_END = '08:00';
const DEFAULT_DAILY_CAP = 3;
const DAILY_CAP_OPTIONS = [1, 3, 5, 10];

interface NotificationPrefs {
  muteAll?: boolean;
  savedSearchEnabled?: boolean;
  watchEnabled?: boolean;
  quietHours?: { start?: string; end?: string };
  dailyCap?: number;
}

function summarizeCriteria(criteria?: Record<string, unknown>): string {
  if (!criteria) return '';
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v != null && v !== '') parts.push(String(v));
  };
  push(criteria.makeId ?? criteria.make);
  push(criteria.modelId ?? criteria.model);
  if (criteria.priceMin != null || criteria.priceMax != null) {
    push(`${criteria.priceMin ?? ''}–${criteria.priceMax ?? ''}`);
  }
  if (criteria.yearMin != null || criteria.yearMax != null) {
    push(`${criteria.yearMin ?? ''}–${criteria.yearMax ?? ''}`);
  }
  push(criteria.bodyType);
  return parts.join(' · ');
}

const NotificationSettingsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const { user, refreshUser } = useAuth();
  const { listSubscriptions, updateSubscription, deleteSubscription } =
    useNotifications();

  // --- Preference state, seeded from user.notificationPrefs (D-16 defaults). ---
  const prefs: NotificationPrefs = (user?.notificationPrefs as NotificationPrefs) || {};
  const [muteAll, setMuteAll] = useState<boolean>(prefs.muteAll ?? false);
  const [savedSearchEnabled, setSavedSearchEnabled] = useState<boolean>(
    prefs.savedSearchEnabled ?? true,
  );
  const [watchEnabled, setWatchEnabled] = useState<boolean>(
    prefs.watchEnabled ?? true,
  );
  const [quietStart] = useState<string>(prefs.quietHours?.start ?? DEFAULT_QUIET_START);
  const [quietEnd] = useState<string>(prefs.quietHours?.end ?? DEFAULT_QUIET_END);
  const [dailyCap, setDailyCap] = useState<number>(prefs.dailyCap ?? DEFAULT_DAILY_CAP);

  // --- Subscription lists. ---
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState<boolean>(true);

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const subs = await listSubscriptions();
      setSubscriptions(Array.isArray(subs) ? subs : []);
    } catch (e) {
      // Non-blocking: keep the screen mounted, surface the action-error line.
      console.error('Failed to load subscriptions', e);
    } finally {
      setLoadingSubs(false);
    }
  }, [listSubscriptions]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  // --- Denied-permission recovery (D-09/D-10/D-11). Live OS push permission. ---
  // null = unknown/not-yet-read; true = AUTHORIZED|PROVISIONAL; false = off.
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);

  const refreshPushPermission = useCallback(async () => {
    try {
      const status = await messaging().hasPermission();
      // D-11: AUTHORIZED or PROVISIONAL both count as "on".
      setPushEnabled(
        status === messaging.AuthorizationStatus.AUTHORIZED ||
          status === messaging.AuthorizationStatus.PROVISIONAL,
      );
    } catch (e) {
      // Never block the screen; treat an unreadable status as "off" so the
      // recovery affordance stays available (no dead-end, NPRF-07).
      console.error('Failed to read push permission status', e);
      setPushEnabled(false);
    }
  }, []);

  // Read live status on mount (mirrors loadSubs precedent) AND re-read whenever
  // the app returns to the foreground — so coming back from OS Settings, where
  // the user may have just toggled the permission, refreshes the row (D-10).
  useEffect(() => {
    refreshPushPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPushPermission();
    });
    return () => sub.remove();
  }, [refreshPushPermission]);

  // Re-read on screen focus too (returning from another screen). useNavigation's
  // addListener is the focus precedent; guarded so it no-ops if unavailable.
  const focusBoundRef = useRef(false);
  useEffect(() => {
    if (focusBoundRef.current) return;
    const addListener = (navigation as unknown as { addListener?: Function })
      .addListener;
    if (typeof addListener === 'function') {
      focusBoundRef.current = true;
      const unsub = addListener.call(navigation, 'focus', () => {
        refreshPushPermission();
      });
      return () => {
        focusBoundRef.current = false;
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [navigation, refreshPushPermission]);

  // D-10: the app CANNOT re-trigger the native dialog after a deny, so the
  // recovery affordance deep-links to OS Settings. D-09: this surface lives ONLY
  // here — there is no nagging banner in the feed.
  const onPressRecovery = useCallback(() => {
    Linking.openSettings().catch((e) => {
      console.error('Failed to open OS settings', e);
    });
  }, []);

  // Persist a notificationPrefs patch to the User profile (plumbing). Optimistic
  // local merge so the UI stays responsive; rolls back on failure.
  const persistPrefs = useCallback(
    async (patch: NotificationPrefs) => {
      if (!user?.localId) return;
      const merged = { ...prefs, ...patch };
      try {
        await AuthService.updateBackendUser(user.localId, {
          notificationPrefs: merged,
        });
        // Re-merge the canonical backend user (incl. updated prefs) into context.
        refreshUser?.();
      } catch (e) {
        console.error('Failed to persist notification prefs', e);
        Alert.alert('', t.subscriptionActionError);
      }
    },
    [user, prefs, refreshUser, t],
  );

  const onToggleMute = useCallback(
    (value: boolean) => {
      setMuteAll(value);
      persistPrefs({ muteAll: value });
    },
    [persistPrefs],
  );

  const onToggleSavedSearch = useCallback(
    (value: boolean) => {
      setSavedSearchEnabled(value);
      persistPrefs({ savedSearchEnabled: value });
    },
    [persistPrefs],
  );

  const onToggleWatch = useCallback(
    (value: boolean) => {
      setWatchEnabled(value);
      persistPrefs({ watchEnabled: value });
    },
    [persistPrefs],
  );

  const onSelectDailyCap = useCallback(
    (cap: number) => {
      setDailyCap(cap);
      persistPrefs({ dailyCap: cap });
    },
    [persistPrefs],
  );

  // D-10: Daily is DISABLED. Pressing it surfaces the coming-soon hint and NEVER
  // sets cadence 'daily'. This is the load-bearing Daily-disabled guard.
  const onPressDaily = useCallback(() => {
    Alert.alert('', t.dailyDisabledHint);
  }, [t]);

  const onDeleteSavedSearch = useCallback(
    (sub: Subscription) => {
      Alert.alert(t.deleteSavedSearchTitle, t.deleteSavedSearchBody, [
        { text: t.notificationCancel, style: 'cancel' },
        {
          text: t.deleteSavedSearchConfirm,
          style: 'destructive',
          onPress: async () => {
            // Optimistic removal; reload on failure.
            setSubscriptions((prev) => prev.filter((s) => s._id !== sub._id));
            try {
              await deleteSubscription(sub._id);
            } catch (e) {
              console.error('Failed to delete saved search', e);
              Alert.alert('', t.subscriptionActionError);
              loadSubs();
            }
          },
        },
      ]);
    },
    [t, deleteSubscription, loadSubs],
  );

  const onDeleteWatch = useCallback(
    (sub: Subscription) => {
      Alert.alert(t.deleteWatchedCarTitle, t.deleteWatchedCarBody, [
        { text: t.notificationCancel, style: 'cancel' },
        {
          text: t.deleteWatchedCarConfirm,
          style: 'destructive',
          onPress: async () => {
            setSubscriptions((prev) => prev.filter((s) => s._id !== sub._id));
            try {
              await deleteSubscription(sub._id);
            } catch (e) {
              console.error('Failed to delete watch', e);
              Alert.alert('', t.subscriptionActionError);
              loadSubs();
            }
          },
        },
      ]);
    },
    [t, deleteSubscription, loadSubs],
  );

  const savedSearches = subscriptions.filter((s) => s.kind === 'saved_search');
  const watchedCars = subscriptions.filter((s) => s.kind === 'watch');

  const renderCadenceSelector = (sub: Subscription) => (
    <View style={styles.cadenceRow}>
      {/* Instant — the selected, accent option. */}
      <TouchableOpacity
        testID={`cadence-instant-${sub._id}`}
        style={[styles.cadenceChip, styles.cadenceChipSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        // Already instant; tapping is a no-op (instant is the only live cadence).
        onPress={() => {}}
      >
        <Text style={styles.cadenceTextSelected}>{t.cadenceInstant}</Text>
      </TouchableOpacity>

      {/* Daily — DISABLED / non-selectable (D-10). Tap surfaces coming-soon hint;
          NEVER calls updateSubscription with cadence 'daily'. */}
      <TouchableOpacity
        testID={`cadence-daily-${sub._id}`}
        style={[styles.cadenceChip, styles.cadenceChipDisabled]}
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        onPress={onPressDaily}
      >
        <Text style={styles.cadenceTextDisabled}>{t.cadenceDailyComingSoon}</Text>
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{t.notificationSettings}</Text>
        <View style={{ width: SIZES.minTapTarget }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {/* 0. Push permission status + recovery (NPRF-06/07, D-09/D-10/D-11).
            Reads live OS status; when OFF, the row is tappable and deep-links to
            OS Settings (the app can't re-trigger the native dialog post-deny).
            This recovery surface exists ONLY here — never in the feed (D-09). */}
        {pushEnabled !== null && (
          <View style={styles.group}>
            <TouchableOpacity
              style={styles.toggleRow}
              testID="push-permission-row"
              disabled={pushEnabled}
              onPress={pushEnabled ? undefined : onPressRecovery}
              accessibilityRole="button"
              accessibilityState={{ disabled: pushEnabled }}
              accessibilityLabel={
                pushEnabled ? t.pushStatusOn : t.pushEnableInSettings
              }
            >
              <View style={styles.pushStatusLabelWrap}>
                {pushEnabled ? (
                  <Bell size={20} color={COLORS.accent} />
                ) : (
                  <BellOff size={20} color={COLORS.textSecondary} />
                )}
                <Text style={styles.pushStatusLabel}>
                  {pushEnabled ? t.pushStatusOn : t.pushStatusOff}
                </Text>
              </View>
              {!pushEnabled && (
                <Text style={styles.pushStatusAction}>
                  {t.pushEnableInSettings}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Master mute (NPRF-01) — reversible, no confirm. */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t.muteAllNotifications}</Text>
            <Switch
              value={muteAll}
              onValueChange={onToggleMute}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
            />
          </View>
        </View>

        {/* 2. Per-category toggles (NPRF-01). */}
        <View style={styles.group}>
          <View style={[styles.toggleRow, styles.rowDivider]}>
            <Text style={styles.toggleLabel}>{t.categorySavedSearches}</Text>
            <Switch
              value={savedSearchEnabled}
              disabled={muteAll}
              onValueChange={onToggleSavedSearch}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t.categoryWatchedCars}</Text>
            <Switch
              value={watchEnabled}
              disabled={muteAll}
              onValueChange={onToggleWatch}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
            />
          </View>
        </View>

        {/* 3. Quiet-hours (NPRF-03) — PLUMBING ONLY, persisted, NOT enforced. */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Quiet hours</Text>
            <Text style={styles.plumbingValue}>
              {quietStart}–{quietEnd}
            </Text>
          </View>
        </View>

        {/* 4. Daily cap (NPRF-04) — PLUMBING ONLY, persisted, NOT enforced. */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Daily cap</Text>
            <View style={styles.capRow}>
              {DAILY_CAP_OPTIONS.map((cap) => (
                <TouchableOpacity
                  key={cap}
                  style={[
                    styles.capChip,
                    dailyCap === cap && styles.capChipSelected,
                  ]}
                  onPress={() => onSelectDailyCap(cap)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dailyCap === cap }}
                >
                  <Text
                    style={[
                      styles.capChipText,
                      dailyCap === cap && styles.capChipTextSelected,
                    ]}
                  >
                    {cap}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 5. My saved searches (NSUB-03 / D-10 cadence + D-11 delete). */}
        <Text style={styles.sectionHeader}>{t.savedSearchesListHeader}</Text>
        <View style={styles.group}>
          {loadingSubs ? (
            <ActivityIndicator color={COLORS.accent} style={styles.loader} />
          ) : savedSearches.length === 0 ? (
            <Text style={styles.emptyRow}>{t.notificationsEmptyBody}</Text>
          ) : (
            savedSearches.map((sub, idx) => (
              <View
                key={sub._id}
                style={[
                  styles.subRow,
                  idx < savedSearches.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={styles.subRowHeader}>
                  <Search size={20} color={COLORS.textSecondary} />
                  <Text style={styles.subSummary} numberOfLines={1}>
                    {summarizeCriteria(sub.criteria) || t.savedSearchesListHeader}
                  </Text>
                  <TouchableOpacity
                    testID={`delete-${sub._id}`}
                    style={styles.deleteButton}
                    onPress={() => onDeleteSavedSearch(sub)}
                    accessibilityRole="button"
                  >
                    <Trash2 size={20} color={COLORS.destructive} />
                  </TouchableOpacity>
                </View>
                {renderCadenceSelector(sub)}
              </View>
            ))
          )}
        </View>

        {/* 6. My watched cars (D-03 per-event + D-11 delete). */}
        <Text style={styles.sectionHeader}>{t.watchedCarsListHeader}</Text>
        <View style={styles.group}>
          {loadingSubs ? (
            <ActivityIndicator color={COLORS.accent} style={styles.loader} />
          ) : watchedCars.length === 0 ? (
            <Text style={styles.emptyRow}>{t.notificationsEmptyBody}</Text>
          ) : (
            watchedCars.map((sub, idx) => (
              <View
                key={sub._id}
                style={[
                  styles.subRow,
                  idx < watchedCars.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={styles.subRowHeader}>
                  <Car size={20} color={COLORS.textSecondary} />
                  <Text style={styles.subSummary} numberOfLines={1}>
                    {sub.carId || t.watchedCarsListHeader}
                  </Text>
                  <TouchableOpacity
                    testID={`delete-${sub._id}`}
                    style={styles.deleteButton}
                    onPress={() => onDeleteWatch(sub)}
                    accessibilityRole="button"
                  >
                    <Trash2 size={20} color={COLORS.destructive} />
                  </TouchableOpacity>
                </View>
                {/* Per-event toggle summary (D-03): watch opts into all 4 events. */}
                <Text style={styles.watchEvents}>
                  {(sub.events && sub.events.length > 0
                    ? sub.events
                    : ['price_drop', 'booked', 'sold', 'back_available']
                  ).join(' · ')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentInner: {
    padding: SIZES.spacingMd,
    paddingBottom: SIZES.spacing2xl,
  },
  group: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.spacingLg,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacingMd,
    minHeight: SIZES.minTapTarget,
    paddingVertical: SIZES.spacingSm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SIZES.spacingMd,
  },
  plumbingValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  pushStatusLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SIZES.spacingMd,
  },
  pushStatusLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    marginLeft: SIZES.spacingSm,
  },
  pushStatusAction: {
    ...TYPOGRAPHY.body,
    color: COLORS.accent,
    fontWeight: '600',
  },
  capRow: {
    flexDirection: 'row',
    gap: SIZES.spacingSm,
  },
  capChip: {
    minWidth: SIZES.minTapTarget,
    minHeight: SIZES.minTapTarget,
    paddingHorizontal: SIZES.spacingSm,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  capChipText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  capChipTextSelected: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  sectionHeader: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    marginBottom: SIZES.spacingSm,
  },
  loader: {
    paddingVertical: SIZES.spacingLg,
  },
  emptyRow: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    padding: SIZES.spacingMd,
  },
  subRow: {
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
  },
  subRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZES.minTapTarget,
  },
  subSummary: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    flex: 1,
    marginLeft: SIZES.spacingSm,
  },
  deleteButton: {
    width: SIZES.minTapTarget,
    height: SIZES.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadenceRow: {
    flexDirection: 'row',
    gap: SIZES.spacingSm,
    marginTop: SIZES.spacingSm,
  },
  cadenceChip: {
    minHeight: SIZES.minTapTarget,
    paddingHorizontal: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadenceChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  cadenceChipDisabled: {
    borderColor: COLORS.border,
    opacity: 0.6,
  },
  cadenceTextSelected: {
    ...TYPOGRAPHY.body,
    color: COLORS.accent,
    fontWeight: '600',
  },
  cadenceTextDisabled: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiary,
  },
  watchEvents: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SIZES.spacingXs,
  },
});

export default NotificationSettingsScreen;
