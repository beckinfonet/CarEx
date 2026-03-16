import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Heart, ArrowLeft, List } from 'lucide-react-native';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export const ProfileScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, logout } = useAuth();

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

