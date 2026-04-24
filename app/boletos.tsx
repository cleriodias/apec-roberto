import * as Clipboard from 'expo-clipboard';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchBoletos, setBoletoPaidStatus } from '../src/services/api';
import type { BoletoFilterUnit, BoletoFilters, BoletoItem, BoletoStatusFilter } from '../src/types';

const statusOptions: Array<{ value: BoletoStatusFilter; label: string }> = [
  { value: 'unpaid', label: 'Nao pagos' },
  { value: 'paid', label: 'Pagos' },
  { value: 'all', label: 'Todos' },
];

type DateFilterField = 'start_date' | 'end_date';

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateToIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoDateToDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null) {
  if (!value) {
    return '--/--/----';
  }

  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function getStatusLabel(item: BoletoItem) {
  return item.is_paid ? 'Pago' : 'Nao pago';
}

function getStatusStyles(item: BoletoItem) {
  return item.is_paid
    ? { backgroundColor: '#E6F1EA', borderColor: '#B8D1C0', color: '#355443' }
    : { backgroundColor: '#F4ECE3', borderColor: '#D8C7B6', color: '#6B4C35' };
}

export default function BoletosScreen() {
  const today = getTodayIsoDate();
  const [filters, setFilters] = useState<BoletoFilters>({
    start_date: today,
    end_date: today,
    paid: 'unpaid',
    unit_id: 'all',
  });
  const [draftFilters, setDraftFilters] = useState<BoletoFilters>(filters);
  const [items, setItems] = useState<BoletoItem[]>([]);
  const [filterUnits, setFilterUnits] = useState<BoletoFilterUnit[]>([]);
  const [listTotalAmount, setListTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeDateField, setActiveDateField] = useState<DateFilterField | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadBoletos = async (nextFilters: BoletoFilters, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const result = await fetchBoletos(nextFilters);
      setItems(result.items);
      setFilterUnits(result.filterUnits);
      setListTotalAmount(result.listTotalAmount);
      setFilters(result.filters);
      setDraftFilters(result.filters);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os boletos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadBoletos(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyDigitableLine = async (line: string) => {
    const normalized = line.trim();

    if (!normalized) {
      Alert.alert('Linha digitavel indisponivel', 'Este boleto nao possui linha digitavel.');
      return;
    }

    await Clipboard.setStringAsync(normalized);
    Alert.alert('Linha copiada', 'A linha digitavel foi copiada.');
  };

  const openDatePicker = (field: DateFilterField) => {
    setActiveDateField(field);
  };

  const updateDateFilter = (field: DateFilterField, value: string) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setActiveDateField(null);
    }

    if (event.type === 'dismissed' || !selectedDate || !activeDateField) {
      return;
    }

    const field = activeDateField;
    setDraftFilters((current) => ({
      ...current,
      [field]: dateToIsoDate(selectedDate),
    }));
  };

  const togglePaidStatus = async (item: BoletoItem, nextValue: boolean) => {
    setUpdatingId(item.id);

    try {
      await setBoletoPaidStatus(item.id, nextValue);
      await loadBoletos(draftFilters);
    } catch (updateError) {
      Alert.alert(
        'Falha ao atualizar',
        updateError instanceof Error ? updateError.message : 'Nao foi possivel atualizar o status do boleto.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadBoletos(filters, true)} />}
      >

        <View style={styles.filtersCard}>
          <Text style={styles.sectionTitle}>Filtros</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Loja</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable
                style={[styles.chip, draftFilters.unit_id === 'all' && styles.chipActive]}
                onPress={() => setDraftFilters((current) => ({ ...current, unit_id: 'all' }))}
              >
                <Text style={[styles.chipText, draftFilters.unit_id === 'all' && styles.chipTextActive]}>Todas</Text>
              </Pressable>

              {filterUnits.map((unit) => {
                const selected = draftFilters.unit_id === String(unit.id);
                return (
                  <Pressable
                    key={unit.id}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setDraftFilters((current) => ({ ...current, unit_id: String(unit.id) }))}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{unit.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.datesRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>Inicio</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  {...({ type: 'date' } as object)}
                  value={draftFilters.start_date}
                  onChangeText={(value) => updateDateFilter('start_date', value)}
                  style={styles.dateInput}
                />
              ) : (
                <Pressable style={styles.dateButton} onPress={() => openDatePicker('start_date')}>
                  <Text style={styles.dateButtonText}>{formatDate(draftFilters.start_date)}</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.dateField}>
              <Text style={styles.label}>Fim</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  {...({ type: 'date' } as object)}
                  value={draftFilters.end_date}
                  onChangeText={(value) => updateDateFilter('end_date', value)}
                  style={styles.dateInput}
                />
              ) : (
                <Pressable style={styles.dateButton} onPress={() => openDatePicker('end_date')}>
                  <Text style={styles.dateButtonText}>{formatDate(draftFilters.end_date)}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {activeDateField && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={isoDateToDate(draftFilters[activeDateField])}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleDateChange}
            />
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              {statusOptions.map((option) => {
                const selected = draftFilters.paid === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.statusButton, selected && styles.statusButtonActive]}
                    onPress={() => setDraftFilters((current) => ({ ...current, paid: option.value }))}
                  >
                    <Text style={[styles.statusButtonText, selected && styles.statusButtonTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable style={styles.applyButton} onPress={() => void loadBoletos(draftFilters)}>
            <Text style={styles.applyButtonText}>Aplicar filtros</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Total da consulta</Text>
            <Text style={styles.summaryValue}>{formatCurrency(listTotalAmount)}</Text>
          </View>
          <Text style={styles.summaryCount}>{items.length} boleto(s)</Text>
        </View>

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#6B4C35" />
            <Text style={styles.feedbackText}>Carregando boletos...</Text>
          </View>
        ) : error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.errorTitle}>Falha ao carregar</Text>
            <Text style={styles.feedbackText}>{error}</Text>
          </View>
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((item) => {
              const statusStyles = getStatusStyles(item);

              return (
                <View key={item.id} style={styles.boletoCard}>
                  <View style={styles.boletoHeader}>
                    <Text style={styles.boletoTitle}>{item.description || `Boleto #${item.id}`}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyles.backgroundColor, borderColor: statusStyles.borderColor },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusStyles.color }]}>
                        {getStatusLabel(item)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.metaLine}>Valor: {formatCurrency(item.amount)}</Text>
                  <Text style={styles.metaLine}>Vencimento: {formatDate(item.due_date)}</Text>
                  <Text style={styles.metaLine}>Loja: {item.unit_name || 'Nao informada'}</Text>

                  <View style={styles.digitableBox}>
                    <Text style={styles.digitableLabel}>Linha digitavel</Text>
                    <Text style={styles.digitableValue}>{item.digitable_line || 'Nao informada'}</Text>
                  </View>

                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Marcar como pago</Text>
                      <Text style={styles.switchHint}>{item.is_paid ? 'Pago' : 'Nao pago'}</Text>
                    </View>
                    <Switch
                      value={item.is_paid}
                      onValueChange={(value) => void togglePaidStatus(item, value)}
                      disabled={updatingId === item.id}
                      trackColor={{ false: '#D8C7B6', true: '#A7C5B0' }}
                      thumbColor={item.is_paid ? '#355443' : '#6B4C35'}
                    />
                  </View>

                  <Pressable style={styles.copyButton} onPress={() => void copyDigitableLine(item.digitable_line)}>
                    <Text style={styles.copyButtonText}>Copiar linha digitavel</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>Nenhum boleto encontrado para o filtro aplicado.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3EEE7' },
  content: { padding: 20, gap: 16, paddingBottom: 28 },
  hero: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    gap: 8,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    color: '#F3F3F3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: { color: '#2F241B', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#6F6152', fontSize: 15, lineHeight: 22 },
  filtersCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    gap: 14,
  },
  sectionTitle: { color: '#35281E', fontSize: 19, fontWeight: '800' },
  fieldGroup: { gap: 8 },
  label: { color: '#5D4C3D', fontSize: 14, fontWeight: '700' },
  chipsRow: { gap: 8, paddingRight: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    backgroundColor: '#F7F2EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { borderColor: '#5A4333', backgroundColor: '#5A4333' },
  chipText: { color: '#5A4333', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFF8F0' },
  datesRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1, gap: 8 },
  dateButton: {
    borderWidth: 1,
    borderColor: '#D8CBBB',
    borderRadius: 16,
    backgroundColor: '#F9F5EF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: '#2F241B',
    fontSize: 15,
    fontWeight: '700',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D8CBBB',
    borderRadius: 16,
    backgroundColor: '#F9F5EF',
    color: '#2F241B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    fontWeight: '700',
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    backgroundColor: '#F7F2EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusButtonActive: { borderColor: '#5A4333', backgroundColor: '#5A4333' },
  statusButtonText: { color: '#5A4333', fontSize: 13, fontWeight: '700' },
  statusButtonTextActive: { color: '#FFF8F0' },
  applyButton: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#111111',
    paddingVertical: 14,
  },
  applyButtonText: { color: '#F8F6F2', fontSize: 15, fontWeight: '800' },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: '#EAE1D7',
    borderWidth: 1,
    borderColor: '#D4C5B6',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: { color: '#6D5C4A', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { color: '#2F241B', fontSize: 24, fontWeight: '800' },
  summaryCount: { color: '#5D4C3D', fontSize: 14, fontWeight: '700' },
  feedbackCard: {
    borderRadius: 22,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  feedbackText: { color: '#6A5B4C', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errorTitle: { color: '#6B3F3F', fontSize: 18, fontWeight: '800' },
  list: { gap: 14 },
  boletoCard: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 18,
    gap: 10,
  },
  boletoHeader: { gap: 10 },
  boletoTitle: { color: '#2F241B', fontSize: 18, fontWeight: '800' },
  metaLine: { color: '#5F5042', fontSize: 14, lineHeight: 20 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  digitableBox: {
    borderRadius: 18,
    backgroundColor: '#F6F1EA',
    borderWidth: 1,
    borderColor: '#E1D5C7',
    padding: 14,
    gap: 6,
  },
  digitableLabel: {
    color: '#6D5C4A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  digitableValue: { color: '#30261D', fontSize: 14, lineHeight: 21 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchInfo: { flex: 1, gap: 2 },
  switchLabel: { color: '#3A2D22', fontSize: 14, fontWeight: '800' },
  switchHint: { color: '#6D5C4A', fontSize: 12, fontWeight: '700' },
  copyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#5A4333',
    paddingVertical: 13,
  },
  copyButtonText: { color: '#FFF8F0', fontSize: 14, fontWeight: '800' },
});
