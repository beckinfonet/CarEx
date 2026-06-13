import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RequestService, RedactedCarRequest } from '../services/requests/RequestService';
import { RequestCard } from '../components/RequestCard';
import { MakeModelFilterBar } from '../components/MakeModelFilterBar';
import { VehicleMake, VehicleModel } from '../hooks/useVehicleCatalog';

export const CarRequestsScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [requests, setRequests] = useState<RedactedCarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notApproved, setNotApproved] = useState(false);

  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [minBudget, setMinBudget] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!user?.localId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const parsedBudget = parseInt(minBudget, 10);
      const res = await RequestService.getOpenRequests({
        makeId: selectedMake?.id ?? null,
        modelId: selectedModel?.id ?? null,
        minBudget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null,
      });
      setRequests(res.requests);
      setNotApproved(false);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setNotApproved(true);
        setRequests([]);
      } else {
        console.error('Failed to browse requests', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId, selectedMake, selectedModel, minBudget]);

  React.useEffect(() => {
    if (isFocused) {
      fetchRequests();
    }
  }, [isFocused, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const renderItem = ({ item }: { item: RedactedCarRequest }) => (
    <RequestCard
      request={item}
      onPress={() => navigation.navigate('CarRequestDetails', { requestId: item._id })}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.buyerRequests}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {notApproved ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>{t.sellersOnly}</Text>
        </View>
      ) : (
        <>
          <View style={styles.filters}>
            <MakeModelFilterBar
              selectedMake={selectedMake}
              selectedModel={selectedModel}
              onSelect={(make, model) => {
                setSelectedMake(make);
                setSelectedModel(model);
              }}
              t={{
                selectMake: t.selectMake,
                selectModel: t.selectModel,
                make: t.brand,
                model: t.model,
              }}
            />
            <TextInput
              style={styles.budgetInput}
              value={minBudget}
              onChangeText={setMinBudget}
              keyboardType="number-pad"
              placeholder={t.filterMinBudget}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={COLORS.accent} />
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
              }
              ListEmptyComponent={<Text style={styles.empty}>{t.noOpenRequests}</Text>}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 24 },
  filters: { paddingHorizontal: SIZES.padding, gap: 10, marginBottom: 4 },
  budgetInput: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
  },
  list: { padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.padding },
  loader: { marginTop: 40 },
});
