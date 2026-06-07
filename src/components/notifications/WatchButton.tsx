import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { COLORS, SIZES } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import {
  NotificationService,
  NotificationEvent,
} from '../../services/notifications/NotificationService';

/**
 * WatchButton — the labeled bell "Watch" pill on CarDetailsScreen (NCEN-06,
 * NSUB-02/03/04, CTX D-01..D-04, UI-SPEC §Color/§Iconography).
 *
 * SIBLING DISCIPLINE (D-01, load-bearing): this is its OWN component, NOT a
 * Heart variant. Three independent disambiguators from the Favorite heart:
 *   - icon: `Bell` (never `Heart`)
 *   - color: accent BLUE (#3B82F6), never the favorite's red
 *   - shape: a labeled pill (icon + text), not a bare icon
 * Styling mirrors BottomBar's labeled pill (accent border/icon; active fill
 * rgba(59,130,246,0.1) === BottomBar.activeButton).
 *
 * ONE TAP (D-03): creates a watch subscription opting into ALL FOUR events
 * (price_drop / booked / sold / back_available) at INSTANT cadence — no
 * event-picker sheet. The button then flips to the active "Watching" state.
 *
 * WATCH KEY (NSUB-04 / D-04, LOAD-BEARING): the subscription carId resolves as
 *   car._id || car.id || carId
 * and is NEVER bare `car.id`. `car.id` can be undefined on some nav paths
 * (project memory car_id_field_unreliable — bare car.id caused a silent prod
 * booking-status bug), so the fallback order matters.
 */

// All four watch events (D-03). Exported so the test asserts the exact set.
export const WATCH_EVENTS: NotificationEvent[] = [
  'price_drop',
  'booked',
  'sold',
  'back_available',
];

interface WatchButtonProps {
  // The car object (may carry _id and/or id). Optional fields — the resolver
  // tolerates either being undefined.
  car?: { _id?: string; id?: string } | null;
  // The route-param carId fallback (always present on CarDetailsScreen).
  carId?: string;
}

const WatchButton = ({ car, carId }: WatchButtonProps) => {
  const { t } = useLanguage();
  const [watching, setWatching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // D-04 / NSUB-04 watch-key contract (grep-visible): car._id || car.id || carId
  // — NEVER bare car.id. Implemented with optional chaining on the car object.
  const watchKey = car?._id || car?.id || carId;

  const handlePress = async () => {
    if (submitting || watching) return;
    if (!watchKey) return;
    setSubmitting(true);
    try {
      await NotificationService.createSubscription({
        kind: 'watch',
        carId: watchKey,
        events: WATCH_EVENTS,
        cadence: 'instant',
      });
      setWatching(true);
    } catch (error) {
      // Subscription create failed — keep inactive so the user can retry.
      console.error('Failed to create watch subscription', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.pill, watching && styles.pillActive]}
      onPress={handlePress}
      disabled={submitting}
      accessibilityRole="button"
      accessibilityState={{ selected: watching, busy: submitting }}
      accessibilityLabel={watching ? t.watchCtaActive : t.watchCta}
      testID="watch-button"
    >
      {submitting ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : (
        <Bell size={20} color={COLORS.accent} />
      )}
      <Text style={styles.label}>
        {watching ? t.watchCtaActive : t.watchCta}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    minHeight: SIZES.minTapTarget, // 44px touch floor
    paddingVertical: SIZES.spacingSm + 2,
    paddingHorizontal: SIZES.spacingMd,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.accent, // accent border (matches BottomBar pill)
  },
  pillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // BottomBar.activeButton fill
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600', // Body strong (UI-SPEC typography)
    marginLeft: SIZES.spacingSm,
  },
});

export default WatchButton;
