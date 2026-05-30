import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { V2 } from './theme';
import type { PersonalityTier } from '../../../context/PersonalityContext';

export interface TierPickerSheetProps {
  visible: boolean;
  currentTier: PersonalityTier;
  /** First-line preview per tier in the active language. */
  previews: Record<PersonalityTier, string>;
  /** Localized row labels + sheet title. */
  labels: {
    title: string;
    wholesome: string;
    sarcastic: string;
    unhinged: string;
  };
  onSelect: (tier: PersonalityTier) => void;
  onDismiss: () => void;
}

const TIERS: PersonalityTier[] = ['wholesome', 'sarcastic', 'unhinged'];

export const TierPickerSheet: React.FC<TierPickerSheetProps> = ({
  visible, currentTier, previews, labels, onSelect, onDismiss,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        testID="tier-sheet-backdrop"
        style={styles.backdrop}
        onPress={onDismiss}
      />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.head}>
          <Text style={styles.title}>{labels.title}</Text>
          <TouchableOpacity onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.x}>×</Text>
          </TouchableOpacity>
        </View>

        {TIERS.map((tier) => {
          const selected = tier === currentTier;
          return (
            <TouchableOpacity
              key={tier}
              testID={`tier-row-${tier}`}
              onPress={() => onSelect(tier)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.dot, selected && styles.dotSelected]} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, selected && styles.rowNameSelected]}>
                  {labels[tier]}
                </Text>
                <Text style={styles.rowPreview}>«{previews[tier]}»</Text>
              </View>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 10, right: 10, bottom: 10,
    backgroundColor: '#0f1827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V2.border,
    padding: 16,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  x: { color: V2.textMuted, fontSize: 18, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: 'rgba(255,170,77,0.06)' },
  dot: {
    width: 16, height: 16, borderRadius: 999,
    borderWidth: 2, borderColor: '#2a3a55',
    marginTop: 2,
  },
  dotSelected: { borderColor: '#ffba66', backgroundColor: '#ffba66' },
  rowBody: { flex: 1 },
  rowName: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  rowNameSelected: { color: '#ffba66' },
  rowPreview: { color: V2.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  check: { color: '#ffba66', fontSize: 13, fontWeight: '800' },
});
