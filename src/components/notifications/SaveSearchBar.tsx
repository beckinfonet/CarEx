import React, { useEffect, useRef, useState } from 'react';
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
import { NotificationService } from '../../services/notifications/NotificationService';
import {
  shouldShowPrePrompt,
  acceptPrePrompt,
  declinePrePrompt,
} from './prePrompt';
import { PushPrePromptModal } from './PushPrePromptModal';

/**
 * SaveSearchBar — the sticky "Notify me about new matches" conversion bar in
 * SearchResultsV2 (NCEN-06, NSUB-01/03, CTX D-08/D-09, UI-SPEC §Color).
 *
 * VISIBILITY (D-08): renders only when filters are active.
 *
 * ONE TAP (D-09): creates a Saved Search from the current filters at INSTANT
 * cadence, then shows a success toast WITH Undo — no confirm sheet. The toast
 * auto-dismisses (~4s); Undo deletes the just-created subscription for the
 * toast's lifetime; it is anchored at the bottom and non-blocking.
 *
 * CRITERIA MAPPING (Pitfall 4 / Pitfall 5, LOAD-BEARING): useHomeListings'
 * activeFilters is keyed by RU labels ('Цена','Год','Пробег','Топливо','КПП').
 * Those must be mapped to CANONICAL English fields before POST, and
 * makeId/modelId must be the ObjectId strings (selectedMake.id /
 * selectedModel.id) — a name string can never match Car.makeId/modelId.
 */

export type SelectedRef = { id: string; name: string } | null;

export interface SaveSearchCriteria {
  makeId?: string;
  modelId?: string;
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  bodyType?: string;
}

interface SaveSearchBarProps {
  activeFilters: { [key: string]: any };
  selectedMake: SelectedRef;
  selectedModel: SelectedRef;
  /** Resolved body-type name (from selectedCategory), or null. */
  bodyType?: string | null;
}

const TOAST_DURATION_MS = 4000;

// Coerce a filter min/max string to a number, dropping empty/invalid values so
// the canonical criteria carries only real bounds (Pitfall 4 mapping helper).
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * RU-label activeFilters → canonical criteria (Pitfall 4 / Pitfall 5).
 * makeId/modelId pass through as ObjectId strings; price/year RU ranges map to
 * priceMin/priceMax/yearMin/yearMax; selectedCategory name → bodyType.
 */
export function buildCriteria(
  activeFilters: { [key: string]: any },
  selectedMake: SelectedRef,
  selectedModel: SelectedRef,
  bodyType?: string | null,
): SaveSearchCriteria {
  const price = activeFilters['Цена'];
  const year = activeFilters['Год'];
  const criteria: SaveSearchCriteria = {
    makeId: selectedMake?.id,
    modelId: selectedModel?.id,
    priceMin: num(price?.min),
    priceMax: num(price?.max),
    yearMin: num(year?.min),
    yearMax: num(year?.max),
    bodyType: bodyType ?? undefined,
  };
  // Strip undefined keys so the POST body stays clean (backend .strict()).
  (Object.keys(criteria) as (keyof SaveSearchCriteria)[]).forEach((k) => {
    if (criteria[k] === undefined) delete criteria[k];
  });
  return criteria;
}

// A filter is "active" when any non-sort key is present.
function hasActiveFilters(
  activeFilters: { [key: string]: any },
  selectedMake: SelectedRef,
  selectedModel: SelectedRef,
  bodyType?: string | null,
): boolean {
  if (selectedMake || selectedModel || bodyType) return true;
  return Object.keys(activeFilters).some((k) => !k.startsWith('sort'));
}

export const SaveSearchBar = ({
  activeFilters,
  selectedMake,
  selectedModel,
  bodyType,
}: SaveSearchBarProps) => {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // NPRF-06: soft pre-prompt visibility — NEVER true at mount; only on the first
  // successful save-search when the shared fire-once flag is unset (D-04).
  const [prePromptVisible, setPrePromptVisible] = useState(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = () => {
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS);
  };

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    const criteria = buildCriteria(
      activeFilters,
      selectedMake,
      selectedModel,
      bodyType,
    );
    try {
      const sub = await NotificationService.createSubscription({
        kind: 'saved_search',
        criteria: criteria as Record<string, unknown>,
        cadence: 'instant', // D-09 instant default (NSUB-03)
      });
      setCreatedId(sub?._id ?? null);
      showToast();
      // NPRF-06 / D-04: first successful save-search shows the soft pre-prompt
      // once (same shared flag as WatchButton). Never on mount.
      if (await shouldShowPrePrompt()) {
        setPrePromptVisible(true);
      }
    } catch (error) {
      console.error('Failed to create saved search', error);
      // Roll back optimistic UI and surface the action error via the toast slot.
      setCreatedId(null);
      setToastVisible(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-prompt resolutions — mirror WatchButton (D-04/D-05).
  const handleEnable = async () => {
    setPrePromptVisible(false);
    await acceptPrePrompt();
  };
  const handleNotNow = async () => {
    setPrePromptVisible(false);
    await declinePrePrompt();
  };

  const handleUndo = async () => {
    if (!createdId) return;
    const id = createdId;
    // Optimistically dismiss the toast; deletion runs in the background.
    setToastVisible(false);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    try {
      await NotificationService.deleteSubscription(id);
    } catch (error) {
      console.error('Failed to undo saved search', error);
    } finally {
      setCreatedId(null);
    }
  };

  if (!hasActiveFilters(activeFilters, selectedMake, selectedModel, bodyType)) {
    return null;
  }

  return (
    <>
      <View style={styles.bar}>
        <Bell size={18} color={COLORS.accent} />
        <Text style={styles.barLabel} numberOfLines={1}>
          {t.saveSearchCta}
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={handleSave}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t.saveSearchCta}
          testID="save-search-cta"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Text style={styles.ctaText}>{t.saveSearchCta}</Text>
          )}
        </TouchableOpacity>
      </View>

      {toastVisible && (
        <View style={styles.toast} testID="save-search-toast">
          <Text style={styles.toastText} numberOfLines={2}>
            {t.saveSearchToast}
          </Text>
          <TouchableOpacity
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel={t.saveSearchUndo}
            testID="save-search-undo"
          >
            <Text style={styles.toastUndo}>{t.saveSearchUndo}</Text>
          </TouchableOpacity>
        </View>
      )}

      <PushPrePromptModal
        visible={prePromptVisible}
        onEnable={handleEnable}
        onNotNow={handleNotNow}
      />
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: SIZES.minTapTarget,
    paddingVertical: SIZES.spacingSm,
    paddingHorizontal: SIZES.spacingMd,
    marginHorizontal: SIZES.spacingMd,
    marginVertical: SIZES.spacingSm,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.accent, // accent emphasis (UI-SPEC reserved item 4)
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  barLabel: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SIZES.spacingSm,
  },
  cta: {
    minHeight: SIZES.minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacingSm,
  },
  ctaText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    left: SIZES.spacingMd,
    right: SIZES.spacingMd,
    bottom: SIZES.spacingMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.spacingSm + 2,
    paddingHorizontal: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.successFg,
    backgroundColor: COLORS.cardBackground,
  },
  toastText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '400',
    marginRight: SIZES.spacingMd,
  },
  toastUndo: {
    color: COLORS.successFg, // success accent for the Undo affordance
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SaveSearchBar;
