import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Home, Plus, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';
import { RootStackParamList } from '../../../types/navigation';

export interface EditorialDockProps {
  /** Localized labels. */
  homeLabel: string;
  sellLabel: string;
  moreLabel: string;
  onMorePress: () => void;
}

export const EditorialDock: React.FC<EditorialDockProps> = ({ homeLabel, sellLabel, moreLabel, onMorePress }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const typo = useTypography();
  const [active, setActive] = useState<'home' | 'more'>('home');

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(8,9,12,0)', 'rgba(8,9,12,1)']}
        locations={[0, 0.6]}
        style={styles.fade}
        pointerEvents="none"
      />
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActive('home'); navigation.navigate('Home', { clearFilters: true }); }}
        >
          <Home size={20} color={active === 'home' ? V2.blue : V2.textMuted} strokeWidth={active === 'home' ? 2.2 : 1.7} />
          <Text style={[styles.navLabel, { fontFamily: typo.display, color: active === 'home' ? V2.blue : V2.textMuted, fontWeight: active === 'home' ? '700' : '600' }]}>{homeLabel}</Text>
        </TouchableOpacity>
        <View style={styles.fabSlot}>
          <TouchableOpacity onPress={() => navigation.navigate('SellCar')} style={styles.fab}>
            <LinearGradient
              colors={[V2.blue, V2.blueDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Plus size={26} color="#04101f" strokeWidth={2.6} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.fabLabel, { fontFamily: typo.display }]}>{sellLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => { setActive('more'); onMorePress(); }}
        >
          <Menu size={20} color={active === 'more' ? V2.blue : V2.textMuted} strokeWidth={active === 'more' ? 2.2 : 1.7} />
          <Text style={[styles.navLabel, { fontFamily: typo.display, color: active === 'more' ? V2.blue : V2.textMuted, fontWeight: active === 'more' ? '700' : '600' }]}>{moreLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 28,
  },
  fade: { position: 'absolute', top: -40, left: 0, right: 0, height: 40 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    height: 64,
    backgroundColor: V2.surface,
    borderRadius: 28,
    borderWidth: 1, borderColor: V2.border,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 2,
  },
  navLabel: { fontSize: 10, letterSpacing: -0.1 },
  fabSlot:  { width: 80, alignItems: 'center', justifyContent: 'center' },
  fab:      { position: 'absolute', top: -8, alignItems: 'center', justifyContent: 'center' },
  fabGradient: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: V2.bg,
    shadowColor: V2.blue, shadowOpacity: 0.42, shadowRadius: 26, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  fabLabel: { fontSize: 10, color: V2.text, fontWeight: '700', marginTop: 30 },
});
