import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { MoreMenu } from './MoreMenu';
import { User, Truck, Menu, Home, PlusCircle } from 'lucide-react-native';
import { RootStackParamList } from '../types/navigation';
import { useNotifications } from '../context/NotificationContext';
import { NotificationBadge } from './notifications/NotificationBadge';

interface BottomBarProps {
  t: any;
}

export const BottomBar = ({ t }: BottomBarProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [menuVisible, setMenuVisible] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={[styles.button, styles.sideButton]} onPress={() => navigation.navigate('Home', { clearFilters: true })}>
          <Home size={20} color={COLORS.textPrimary} />
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">{t.home}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.centerButton]} onPress={() => navigation.navigate('SellCar')}>
          <PlusCircle size={20} color={COLORS.accent} />
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">{t.sellCar}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.sideButton]}
          onPress={() => setMenuVisible(true)}
        >
          <Menu size={20} color={COLORS.textPrimary} />
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">{t.more}</Text>
          <NotificationBadge
            count={unreadCount}
            mode="dot"
            style={styles.notificationDot}
          />
        </TouchableOpacity>
      </View>
      <MoreMenu visible={menuVisible} onClose={() => setMenuVisible(false)} t={t} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.accent,
    minWidth: 0,
  },
  sideButton: {
    flex: 1,
  },
  centerButton: {
    flex: 1.5,
  },
  activeButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Blue transparent
  },
  icon: {
    marginRight: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 10,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    flexShrink: 1,
  },
});

