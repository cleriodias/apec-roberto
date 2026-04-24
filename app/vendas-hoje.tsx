import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchVendasHoje } from '../src/services/api';
import type { VendasHojeLoja, VendasHojeResult } from '../src/types';

type SalesPeriod = 'today' | 'yesterday';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string) {
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function VendasHojeScreen() {
  const [data, setData] = useState<VendasHojeResult>({
    date: '',
    period: 'today',
    items: [],
    totals: { dinheiro: 0, cartao: 0, total: 0 },
  });
  const [period, setPeriod] = useState<SalesPeriod>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async (nextPeriod = period, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      setData(await fetchVendasHoje(nextPeriod));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar as vendas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const changePeriod = (nextPeriod: SalesPeriod) => {
    if (nextPeriod === period) {
      return;
    }

    setPeriod(nextPeriod);
    void load(nextPeriod);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(period, true)} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Relatorio</Text>
          <Text style={styles.title}>Vendas Hoje</Text>
          <Text style={styles.subtitle}>
            Total de vendas em dinheiro e cartao por loja{data.date ? ` em ${formatDate(data.date)}` : ''}.
          </Text>
          <View style={styles.periodTabs}>
            <Pressable
              style={[styles.periodButton, period === 'today' && styles.periodButtonActive]}
              onPress={() => changePeriod('today')}
            >
              <Text style={[styles.periodButtonText, period === 'today' && styles.periodButtonTextActive]}>
                Hoje
              </Text>
            </Pressable>
            <Pressable
              style={[styles.periodButton, period === 'yesterday' && styles.periodButtonActive]}
              onPress={() => changePeriod('yesterday')}
            >
              <Text style={[styles.periodButtonText, period === 'yesterday' && styles.periodButtonTextActive]}>
                Ontem
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Dinheiro</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totals.dinheiro)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Cartao</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totals.cartao)}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Total geral</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(data.totals.total)}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#3F5F78" />
            <Text style={styles.feedbackText}>Carregando vendas...</Text>
          </View>
        ) : error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.errorTitle}>Falha ao carregar</Text>
            <Text style={styles.feedbackText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void load(period)}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : data.items.length ? (
          <View style={styles.list}>
            {data.items.map((item) => (
              <StoreSalesCard key={item.unit_id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>
              Nenhuma venda em dinheiro ou cartao registrada {period === 'today' ? 'hoje' : 'ontem'}.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StoreSalesCard({ item }: { item: VendasHojeLoja }) {
  return (
    <View style={styles.storeCard}>
      <View style={styles.storeHeader}>
        <Text style={styles.storeTitle}>{item.unit_name || 'Loja nao informada'}</Text>
        <Text style={styles.storeTotal}>{formatCurrency(item.total)}</Text>
      </View>

      <View style={styles.valuesRow}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Dinheiro</Text>
          <Text style={styles.valueAmount}>{formatCurrency(item.dinheiro)}</Text>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Cartao</Text>
          <Text style={styles.valueAmount}>{formatCurrency(item.cartao)}</Text>
        </View>
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
  periodTabs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  periodButton: {
    borderRadius: 999,
    backgroundColor: '#F4F0EA',
    borderWidth: 1,
    borderColor: '#D8CBBB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  periodButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  periodButtonText: {
    color: '#5E5145',
    fontSize: 13,
    fontWeight: '900',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#E7EDF1',
    borderWidth: 1,
    borderColor: '#CBD8E0',
    padding: 18,
    gap: 12,
  },
  summaryBlock: {
    borderRadius: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D8E0E5',
    padding: 14,
    gap: 4,
  },
  summaryLabel: { color: '#536778', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  summaryValue: { color: '#263B4C', fontSize: 22, fontWeight: '800' },
  summaryTotal: {
    borderRadius: 18,
    backgroundColor: '#3F5F78',
    padding: 16,
    gap: 4,
  },
  summaryTotalLabel: { color: '#DDE9F1', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  summaryTotalValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
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
  retryButton: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#3F5F78',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryButtonText: { color: '#F3F8FF', fontSize: 14, fontWeight: '800' },
  list: { gap: 14 },
  storeCard: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 18,
    gap: 14,
  },
  storeHeader: { gap: 6 },
  storeTitle: { color: '#2F241B', fontSize: 18, fontWeight: '800' },
  storeTotal: { color: '#3F5F78', fontSize: 24, fontWeight: '800' },
  valuesRow: { flexDirection: 'row', gap: 12 },
  valueBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#F4F0EA',
    borderWidth: 1,
    borderColor: '#E1D5C7',
    padding: 14,
    gap: 4,
  },
  valueLabel: { color: '#6D5C4A', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  valueAmount: { color: '#30261D', fontSize: 17, fontWeight: '800' },
});
