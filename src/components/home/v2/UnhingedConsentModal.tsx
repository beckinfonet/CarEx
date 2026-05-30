import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { V2 } from './theme';

export interface UnhingedConsentModalProps {
  visible: boolean;
  labels: {
    title: string;
    body: string;
    accept: string;
    cancel: string;
  };
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Quick 260530-bdq — first-time consent gate for the UNHINGED personality
 * tier. Modal opens on the first picker selection or cycle-tap that would
 * land on UNHINGED; the tier does NOT change until the user presses Accept.
 *
 * Backdrop taps and Android system back both call `onCancel`. Visual language
 * matches `TierPickerSheet` (dark navy card, accent-orange primary button).
 */
export const UnhingedConsentModal: React.FC<UnhingedConsentModalProps> = ({
  visible, labels, onAccept, onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        testID="unhinged-consent-backdrop"
        style={styles.backdrop}
        onPress={onCancel}
      />
      <View style={styles.center} pointerEvents="box-none">
        <View
          testID="unhinged-consent-modal"
          accessibilityViewIsModal
          role="dialog"
          accessibilityLabel={labels.title}
          style={styles.card}
        >
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.body}>{labels.body}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              testID="unhinged-consent-cancel"
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={labels.cancel}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelText}>{labels.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="unhinged-consent-accept"
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel={labels.accept}
              style={[styles.button, styles.acceptButton]}
            >
              <Text style={styles.acceptText}>{labels.accept}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0f1827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: V2.border,
    padding: 20,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    color: V2.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  body: {
    color: V2.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: V2.radius.small,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: V2.borderHi,
  },
  cancelText: {
    color: V2.text,
    fontSize: 13,
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: '#ffba66',
  },
  acceptText: {
    color: '#0f1827',
    fontSize: 13,
    fontWeight: '800',
  },
});
