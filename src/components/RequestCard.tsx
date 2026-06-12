import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Calendar, Wallet } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import type { CarRequest } from '../services/requests/RequestService';

interface RequestCardProps {
  request: CarRequest;
  onPress?: () => void;
}

function formatBudget(req: CarRequest): string {
  const max = req.budgetMax?.toLocaleString?.() ?? String(req.budgetMax);
  if (req.budgetMin) {
    const min = req.budgetMin.toLocaleString();
    return `${min} – ${max} ${req.currency}`;
  }
  return `${max} ${req.currency}`;
}

function formatYears(req: CarRequest): string | null {
  if (req.yearMin && req.yearMax) {return `${req.yearMin}–${req.yearMax}`;}
  if (req.yearMin) {return `${req.yearMin}+`;}
  if (req.yearMax) {return `≤ ${req.yearMax}`;}
  return null;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onPress }) => {
  const { t } = useLanguage();
  const years = formatYears(request);

  const statusLabel =
    request.status === 'open'
      ? t.requestStatusOpen
      : request.status === 'closed'
      ? t.requestStatusClosed
      : t.requestStatusExpired;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {request.makeName}
            {request.modelName ? ` ${request.modelName}` : ` · ${t.anyModel}`}
          </Text>
          {onPress ? <ChevronRight size={20} color={COLORS.textSecondary} /> : null}
        </View>

        <View style={styles.metaRow}>
          <Wallet size={14} color={COLORS.textSecondary} />
          <Text style={styles.meta}>{formatBudget(request)}</Text>
          {years ? (
            <>
              <Calendar size={14} color={COLORS.textSecondary} style={styles.metaIconSpacing} />
              <Text style={styles.meta}>{years}</Text>
            </>
          ) : null}
        </View>

        <View style={[styles.statusBadge, statusStyle(request.status)]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function statusStyle(status: CarRequest['status']) {
  if (status === 'open') {return { backgroundColor: COLORS.accent };}
  return { backgroundColor: COLORS.textSecondary };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  meta: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 4 },
  metaIconSpacing: { marginLeft: 12 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { color: '#000', fontSize: 11, fontWeight: '700' },
});
