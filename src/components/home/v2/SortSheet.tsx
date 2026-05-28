import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export type SortOption = 'relevance' | 'priceAsc' | 'priceDesc' | 'newest' | 'mileageAsc';

export interface SortSheetProps {
  visible: boolean;
  current: SortOption;
  labels: Record<SortOption, string>;
  onSelect: (opt: SortOption) => void;
  onClose: () => void;
}

const ORDER: SortOption[] = ['relevance', 'priceAsc', 'priceDesc', 'newest', 'mileageAsc'];

export const SortSheet: React.FC<SortSheetProps> = ({ visible, current, labels, onSelect, onClose }) => {
  const typo = useTypography();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {ORDER.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.row}
              onPress={() => { onSelect(opt); onClose(); }}
              activeOpacity={0.85}
            >
              <Text style={[
                styles.label,
                { fontFamily: typo.display, color: current === opt ? V2.blue : V2.text },
              ]}>
                {labels[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    {
    backgroundColor: V2.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingVertical: 12, paddingHorizontal: 18, paddingBottom: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: V2.border,
  },
  row:      { paddingVertical: 14 },
  label:    { fontSize: 16, fontWeight: '700' },
});
