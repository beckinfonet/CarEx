import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Plus, Trash2, Shield, ShieldCheck, X } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/AuthService';

interface AdminEntry {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
}

export const AdminManagementScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!user?.localId) return;
    try {
      const data = await AuthService.getAdminUsers(user.localId);
      setAdmins(data);
    } catch {
      Alert.alert(t.error, 'Failed to load admins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdmins();
  };

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert(t.error, t.enterAdminEmail);
      return;
    }
    setAdding(true);
    try {
      await AuthService.addAdminUser(user.localId, email);
      setNewEmail('');
      setModalVisible(false);
      fetchAdmins();
    } catch (error: any) {
      const msg = error?.response?.status === 409 ? t.adminAlreadyExists : 'Failed to add admin';
      Alert.alert(t.error, msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (item: AdminEntry) => {
    Alert.alert(
      t.confirmRemoveAdmin,
      item.email,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.removeAdmin,
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.removeAdminUser(user.localId, item.id);
              fetchAdmins();
            } catch {
              Alert.alert(t.error, 'Failed to remove admin');
            }
          },
        },
      ],
    );
  };

  const renderAdmin = ({ item }: { item: AdminEntry }) => {
    const isSuperAdmin = item.role === 'superadmin';
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {isSuperAdmin ? (
            <ShieldCheck size={20} color="#F59E0B" />
          ) : (
            <Shield size={20} color={COLORS.accent} />
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardEmail}>{item.email}</Text>
            <Text style={[styles.cardRole, isSuperAdmin && styles.superAdminRole]}>
              {isSuperAdmin ? t.superadmin : t.admin}
            </Text>
          </View>
          {!isSuperAdmin ? (
            <TouchableOpacity style={styles.removeButton} onPress={() => handleRemove(item)}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
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
        <Text style={styles.headerTitle}>{t.adminUsers}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={admins}
        renderItem={renderAdmin}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.addAdmin}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>{t.enterAdminEmail}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="email@example.com"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleAdd} disabled={adding}>
                {adding ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>{t.addAdmin}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  addBtn: {
    padding: 8,
  },
  listContent: {
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardEmail: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  cardRole: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  superAdminRole: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: SIZES.padding,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  modalSaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
