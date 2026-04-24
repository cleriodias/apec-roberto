import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { fetchNotaFiscalUnits, setNotaFiscalGeneration } from '../src/services/api';
import type { NotaFiscalResult, NotaFiscalUnit } from '../src/types';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string) {
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function NotaFiscalScreen() {
  const [data, setData] = useState<NotaFiscalResult>({
    date: '',
    items: [],
    totals: { total_gerado: 0, active_count: 0, inactive_count: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savingUnitId, setSavingUnitId] = useState<number | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      setData(await fetchNotaFiscalUnits());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar as notas fiscais.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateUnit = (updatedUnit: NotaFiscalUnit) => {
    setData((current) => {
      const items = current.items.map((item) =>
        item.unit_id === updatedUnit.unit_id ? updatedUnit : item
      );
      const activeCount = items.filter((item) => item.generation_active).length;

      return {
        date: current.date,
        items,
        totals: {
          ...current.totals,
          active_count: activeCount,
          inactive_count: items.length - activeCount,
        },
      };
    });
  };

  const toggleGeneration = async (unit: NotaFiscalUnit, nextValue: boolean) => {
    const previousUnit = unit;
    setSavingUnitId(unit.unit_id);
    setError('');
    updateUnit({ ...unit, generation_active: nextValue });

    try {
      updateUnit(await setNotaFiscalGeneration(unit.unit_id, nextValue));
    } catch (toggleError) {
      updateUnit(previousUnit);
      setError(toggleError instanceof Error ? toggleError.message : 'Nao foi possivel alterar a loja.');
    } finally {
      setSavingUnitId(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Fiscal</Text>
          <Text style={styles.subtitle}>
            Gerado em {data.date ? ` (${formatDate(data.date)})` : ''}.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Total gerado em nota hoje</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totals.total_gerado)}</Text>
          </View>
          <View style={styles.summaryCounts}>
            <Text style={styles.countText}>{data.totals.active_count} ativa(s)</Text>
            <Text style={styles.countText}>{data.totals.inactive_count} inativa(s)</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#486556" />
            <Text style={styles.feedbackText}>Carregando lojas...</Text>
          </View>
        ) : data.items.length ? (
          <View style={styles.listCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.storeColumn]}>Loja</Text>
              <Text style={[styles.headerText, styles.valueColumn]}>Total</Text>
              <Text style={[styles.headerText, styles.statusColumn]}>Status</Text>
            </View>

            {data.items.map((item) => (
              <FiscalUnitRow
                key={item.unit_id}
                item={item}
                disabled={savingUnitId === item.unit_id}
                onToggle={(nextValue) => void toggleGeneration(item, nextValue)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>Nenhuma loja ativa encontrada.</Text>
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryButtonText}>Atualizar</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FiscalUnitRow({
  item,
  disabled,
  onToggle,
}: {
  item: NotaFiscalUnit;
  disabled: boolean;
  onToggle: (nextValue: boolean) => void;
}) {
  const isActive = item.generation_active;

  return (
    <View style={styles.row}>
      <Text style={[styles.storeName, styles.storeColumn]} numberOfLines={1}>
        {item.unit_name || 'Loja nao informada'}
      </Text>
      <View style={[styles.valuePill, styles.valueColumn]}>
        <Text style={styles.valuePillText}>{formatCurrency(item.total_gerado)}</Text>
      </View>
      <View style={[styles.statusWrap, styles.statusColumn]}>
        <Switch
          value={isActive}
          disabled={disabled}
          onValueChange={onToggle}
          trackColor={{ false: '#CDD3D8', true: '#BFD3C8' }}
          thumbColor={isActive ? '#486556' : '#F8F6F2'}
          ios_backgroundColor="#CDD3D8"
        />
        <Text style={[styles.statusText, isActive ? styles.statusActive : styles.statusInactive]}>
          {disabled ? '...' : isActive ? 'Ativa' : 'Off'}
        </Text>
      </View>
    </View>
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
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#E8E0D5',
    borderWidth: 1,
    borderColor: '#D4C6B5',
    padding: 18,
    gap: 12,
  },
  summaryLabel: { color: '#6F5845', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  summaryValue: { color: '#2F241B', fontSize: 28, fontWeight: '800' },
  summaryCounts: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  countText: {
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#D8CBBB',
    color: '#5D4A39',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  inlineError: {
    borderRadius: 18,
    backgroundColor: '#F7E7E4',
    borderWidth: 1,
    borderColor: '#E6C5BF',
    padding: 14,
  },
  inlineErrorText: { color: '#713D35', fontSize: 14, fontWeight: '700', textAlign: 'center' },
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
  retryButton: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#486556',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryButtonText: { color: '#EEF6F1', fontSize: 14, fontWeight: '800' },
  listCard: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0E8DD',
    borderBottomWidth: 1,
    borderColor: '#E1D5C7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headerText: { color: '#6F6152', fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ECE2D7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  storeColumn: { flex: 1.25 },
  valueColumn: { flex: 1 },
  statusColumn: { flex: 1.1 },
  storeName: {
    color: '#5D6873',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  valuePill: {
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#F1C6CE',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  valuePillText: { color: '#B42346', fontSize: 12, fontWeight: '900' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  statusText: { minWidth: 34, fontSize: 12, fontWeight: '900' },
  statusActive: { color: '#486556' },
  statusInactive: { color: '#9F2442' },
});
