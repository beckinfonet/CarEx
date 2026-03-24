import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Heart, ArrowLeft, List, Store, Briefcase, Truck, Shield, ShieldCheck, Users, Package, ClipboardList } from 'lucide-react-native';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export const ProfileScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout, isAdmin, adminRole } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      t.logout,
      t.logoutConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        { 
          text: t.logout, 
          style: 'destructive', 
          onPress: async () => {
            await logout();
            navigation.navigate('Home');
          } 
        }
      ]
    );
  };

  const menuItems = [
    {
      id: 'listings',
      title: t.myListings,
      icon: <List size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('MyListings')
    },
    {
      id: 'favorites',
      title: t.myFavorites,
      icon: <Heart size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('Favorites')
    },
    {
      id: 'myOrders',
      title: t.myOrders,
      icon: <Package size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('MyOrders' as never)
    },
    ...(user && user.sellerStatus !== 'APPROVED' ? [{
      id: 'requestSeller',
      title: t.requestSellerAccount,
      icon: <Store size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('SellCar')
    }] : []),
    ...(user && user.brokerStatus === 'APPROVED' ? [{
      id: 'viewBrokerage',
      title: t.viewBrokerage,
      icon: <Briefcase size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('ServiceProfile' as never, { type: 'broker' } as never)
    }] : user ? [{
      id: 'applyBroker',
      title: t.applyAsBroker,
      icon: <Briefcase size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('ServiceApplication' as never, { type: 'broker' } as never)
    }] : []),
    ...(user && user.logisticsStatus === 'APPROVED' ? [{
      id: 'viewLogistics',
      title: t.viewLogistics,
      icon: <Truck size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('ServiceProfile' as never, { type: 'logistics' } as never)
    }] : user ? [{
      id: 'applyLogistics',
      title: t.applyAsLogistics,
      icon: <Truck size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('ServiceApplication' as never, { type: 'logistics' } as never)
    }] : []),
    ...(user && (user.brokerStatus === 'APPROVED' || user.logisticsStatus === 'APPROVED') ? [{
      id: 'providerOrders',
      title: t.providerOrders,
      icon: <ClipboardList size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('ProviderOrders' as never)
    }] : []),
  ];

  if (!user) {
    // Should generally be redirected by Auth stack, but for safety
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
            <Text style={styles.text}>{t.noAccount}</Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.buttonText}>{t.login}</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.myProfile}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1 }}>
            <View style={styles.userInfoContainer}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => navigation.navigate('AccountSettings')}
                  activeOpacity={0.8}
                >
                  {user.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <User size={40} color={COLORS.textPrimary} />
                  )}
                </TouchableOpacity>
                <View style={styles.userDetails}>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={[styles.userLabel, { color: COLORS.accent }]}>
                      {user.sellerStatus === 'APPROVED' ? 'Verified Seller' : 
                       user.sellerStatus === 'PENDING' ? 'Verification Pending' :
                       user.sellerStatus === 'REJECTED' ? 'Verification Rejected' : 'Buyer Account'}
                    </Text>
                    <TouchableOpacity
                      style={styles.accountSettingsRow}
                      onPress={() => navigation.navigate('AccountSettings')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.accountSettingsLink}>{t.accountSettings}</Text>
                      <ChevronRight size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.menuContainer}>
                {menuItems.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
                        <View style={styles.menuIcon}>
                            {item.icon}
                        </View>
                        <Text style={styles.menuTitle}>{item.title}</Text>
                        <ChevronRight size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                ))}
            </View>

            {isAdmin ? (
              <>
                <Text style={styles.adminSectionTitle}>{t.adminPanel}</Text>
                <View style={styles.menuContainer}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AdminDashboard' as never)}>
                    <View style={styles.menuIcon}>
                      <Shield size={24} color="#F59E0B" />
                    </View>
                    <Text style={styles.menuTitle}>{t.pendingRequests}</Text>
                    <ChevronRight size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {adminRole === 'superadmin' ? (
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AdminManagement' as never)}>
                      <View style={styles.menuIcon}>
                        <Users size={24} color="#F59E0B" />
                      </View>
                      <Text style={styles.menuTitle}>{t.manageAdmins}</Text>
                      <ChevronRight size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#EF4444" style={{ marginRight: 10 }} />
            <Text style={styles.logoutText}>{t.logout}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: COLORS.textPrimary,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: SIZES.borderRadius,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    padding: SIZES.padding,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    padding: 20,
    borderRadius: SIZES.borderRadius,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.searchBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userDetails: {
    flex: 1,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  accountSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  accountSettingsLink: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  menuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  adminSectionTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 20,
    marginBottom: 20,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

