import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, CheckCircle } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RequestService, CarRequest } from '../services/requests/RequestService';
import { RequestCard } from '../components/RequestCard';

export const MyRequestsScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [requests, setRequests] = useState<CarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user?.localId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await RequestService.getMyRequests();
      setRequests(rows);
    } catch (e) {
      console.error('Failed to fetch requests', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  React.useEffect(() => {
    if (isFocused) {
      fetchRequests();
    }
  }, [isFocused, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleClose = (req: CarRequest) => {
    Alert.alert(t.foundIt, t.closeRequestConfirm, [
      { text: t.requestStatusClosed, style: 'cancel' },
      {
        text: t.foundIt,
        onPress: async () => {
          try {
            await RequestService.closeRequest(req._id);
            fetchRequests();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const handleDelete = (req: CarRequest) => {
    Alert.alert(t.myRequests, t.deleteRequestConfirm, [
      { text: t.requestStatusClosed, style: 'cancel' },
      {
        text: t.foundIt,
        style: 'destructive',
        onPress: async () => {
          try {
            await RequestService.deleteRequest(req._id);
            fetchRequests();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: CarRequest }) => (
    <View>
      <RequestCard
        request={item}
        onPress={() => navigation.navigate('FindCar', { requestId: item._id })}
      />
      <View style={styles.actionRow}>
        {item.status === 'open' ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleClose(item)}>
            <CheckCircle size={16} color={COLORS.textPrimary} />
            <Text style={styles.actionText}>{t.foundIt}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
          <Trash2 size={16} color={COLORS.textPrimary} />
          <Text style={styles.actionText}>{t.requestStatusClosed}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.myRequests}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('FindCar')}>
          <Plus size={24} color={COLORS.accent} />
        </TouchableOpacity>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>{t.noRequests}</Text>}
        />
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
  list: { padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  actionRow: { flexDirection: 'row', marginTop: -8, marginBottom: SIZES.padding },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { color: COLORS.textPrimary, fontSize: 13, marginLeft: 6 },
});
