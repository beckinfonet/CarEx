import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Briefcase, Truck } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

type Tab = 'brokers' | 'logistics';

export const ServicesScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('brokers');

  const renderEmptyState = () => {
    const icon =
      activeTab === 'brokers' ? (
        <Briefcase size={48} color={COLORS.textSecondary} />
      ) : (
        <Truck size={48} color={COLORS.textSecondary} />
      );

    return (
      <View style={styles.emptyState}>
        {icon}
        <Text style={styles.emptyTitle}>
          {activeTab === 'brokers' ? t.brokers : t.logisticsTab}
        </Text>
        <Text style={styles.emptySubtitle}>{t.comingSoon}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.services}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'brokers' && styles.activeTab]}
          onPress={() => setActiveTab('brokers')}>
          <Briefcase
            size={18}
            color={
              activeTab === 'brokers' ? COLORS.accent : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'brokers' && styles.activeTabText,
            ]}>
            {t.brokers}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'logistics' && styles.activeTab]}
          onPress={() => setActiveTab('logistics')}>
          <Truck
            size={18}
            color={
              activeTab === 'logistics' ? COLORS.accent : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'logistics' && styles.activeTabText,
            ]}>
            {t.logisticsTab}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
