import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchEstoqueProducts, updateEstoqueProductQuantity } from '../src/services/api';
import type { EstoqueProduct } from '../src/types';

const defaultTypeFilters = [0, 1, 3];
const typeOptions = [
  { value: 0, label: 'Industria' },
  { value: 1, label: 'Balanca' },
  { value: 3, label: 'Producao' },
];

function formatQuantity(value: number) {
  return Number.isFinite(value) ? String(Math.trunc(value)) : '0';
}

function parseQuantity(value: string) {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

export default function EstoqueScreen() {
  const [items, setItems] = useState<EstoqueProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const [lastSearch, setLastSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<number[]>(defaultTypeFilters);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const indexedItems = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const selectedTypesSummary = useMemo(
    () =>
      typeOptions
        .filter((option) => selectedTypes.includes(option.value))
        .map((option) => option.label)
        .join(', '),
    [selectedTypes]
  );

  const load = useCallback(async (nextSearch: string, nextTypes: number[], isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setMessage('');

    try {
      const result = await fetchEstoqueProducts(nextSearch, nextTypes);
      setItems(result.items);
      setLastSearch(result.search);
      setDrafts(
        Object.fromEntries(result.items.map((item) => [item.id, formatQuantity(item.quantity)]))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o estoque.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const submitSearch = () => {
    void load(search.trim(), selectedTypes);
  };

  const applyTypeFilters = (nextTypes: number[]) => {
    setSelectedTypes(nextTypes);
    void load(search.trim(), nextTypes);
  };

  const toggleTypeFilter = (type: number) => {
    const isSelected = selectedTypes.includes(type);

    if (isSelected && selectedTypes.length === 1) {
      setError('Selecione ao menos um filtro de produto.');
      return;
    }

    const nextTypes = isSelected
      ? selectedTypes.filter((item) => item !== type)
      : [...selectedTypes, type].sort((left, right) => left - right);

    applyTypeFilters(nextTypes);
  };

  const resetTypeFilters = () => {
    applyTypeFilters(defaultTypeFilters);
  };

  const updateDraft = (productId: number, value: string) => {
    setDrafts((current) => ({
      ...current,
      [productId]: value,
    }));
  };

  const saveProduct = async (productId: number) => {
    const product = indexedItems.get(productId);
    const quantity = parseQuantity(drafts[productId] ?? '');

    if (quantity === null) {
      setError('Informe uma quantidade numerica para salvar.');
      return;
    }

    setSavingId(productId);
    setError('');
    setMessage('');

    try {
      const updated = await updateEstoqueProductQuantity(productId, quantity);
      setItems((current) => current.map((item) => (item.id === productId ? updated : item)));
      setDrafts((current) => ({ ...current, [productId]: formatQuantity(updated.quantity) }));
      setMessage(`${product?.name ?? updated.name} atualizado para ${formatQuantity(updated.quantity)}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar o estoque.');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    void load('', defaultTypeFilters);
  }, [load]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(lastSearch, selectedTypes, true)} />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Produtos</Text>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>Atualize a quantidade atual de qualquer produto cadastrado.</Text>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.sectionTitle}>Filtros</Text>
          <Text style={styles.filtersHint}>Escolha os tipos que devem aparecer na lista inicial.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {typeOptions.map((option) => {
              const selected = selectedTypes.includes(option.value);

              return (
                <Pressable
                  key={option.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => toggleTypeFilter(option.value)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.filtersFooter}>
            <Text style={styles.filtersSummary}>Selecionados: {selectedTypesSummary}</Text>
            <Pressable style={styles.resetButton} onPress={resetTypeFilters}>
              <Text style={styles.resetButtonText}>Padrao</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={submitSearch}
            placeholder="Buscar por nome, ID ou codigo"
            placeholderTextColor="#8A7B6B"
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonText}>Buscar</Text>
          </Pressable>
        </View>

        {message ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>{message}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#556B55" />
            <Text style={styles.feedbackText}>Carregando produtos...</Text>
          </View>
        ) : error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.errorTitle}>Falha ao carregar</Text>
            <Text style={styles.feedbackText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void load(lastSearch, selectedTypes)}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <View style={styles.productTitleBlock}>
                    <Text style={styles.productName}>{item.name || 'Produto sem nome'}</Text>
                    <Text style={styles.productMeta}>
                      ID {item.id} {item.barcode ? `- Codigo ${item.barcode}` : ''}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status_label || item.type_label || 'Produto'}</Text>
                  </View>
                </View>

                <View style={styles.quantityRow}>
                  <View style={styles.quantityField}>
                    <Text style={styles.quantityLabel}>Quantidade atual</Text>
                    <TextInput
                      value={drafts[item.id] ?? formatQuantity(item.quantity)}
                      onChangeText={(value) => updateDraft(item.id, value)}
                      keyboardType="numbers-and-punctuation"
                      placeholder="0"
                      placeholderTextColor="#8A7B6B"
                      style={styles.quantityInput}
                    />
                  </View>
                  <Pressable
                    style={[styles.saveButton, savingId === item.id && styles.saveButtonDisabled]}
                    disabled={savingId === item.id}
                    onPress={() => void saveProduct(item.id)}
                  >
                    <Text style={styles.saveButtonText}>{savingId === item.id ? 'Salvando' : 'Salvar'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackText}>Nenhum produto encontrado.</Text>
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
    borderRadius: 22,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 14,
    gap: 12,
  },
  sectionTitle: { color: '#35281E', fontSize: 18, fontWeight: '800' },
  filtersHint: { color: '#6F6152', fontSize: 14, lineHeight: 20 },
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
  filtersFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filtersSummary: { flex: 1, color: '#6A5B4C', fontSize: 13, lineHeight: 19 },
  resetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    backgroundColor: '#F8F4EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetButtonText: { color: '#5A4333', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  searchCard: {
    borderRadius: 22,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 14,
    gap: 10,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    backgroundColor: '#F8F4EE',
    color: '#2F241B',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#556B55',
    paddingVertical: 13,
  },
  searchButtonText: { color: '#F3FAF3', fontSize: 14, fontWeight: '900' },
  successCard: {
    borderRadius: 18,
    backgroundColor: '#E8F1E8',
    borderWidth: 1,
    borderColor: '#BFD2BF',
    padding: 14,
  },
  successText: { color: '#344E34', fontSize: 14, fontWeight: '800' },
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
    backgroundColor: '#556B55',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryButtonText: { color: '#F3FAF3', fontSize: 14, fontWeight: '800' },
  list: { gap: 14 },
  productCard: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 16,
    gap: 14,
  },
  productHeader: { gap: 10 },
  productTitleBlock: { gap: 4 },
  productName: { color: '#2F241B', fontSize: 18, fontWeight: '800' },
  productMeta: { color: '#786B5E', fontSize: 12, lineHeight: 18 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EEF3EE',
    borderWidth: 1,
    borderColor: '#D0DDD0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { color: '#435843', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  quantityRow: { gap: 12 },
  quantityField: { gap: 6 },
  quantityLabel: { color: '#5F5042', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  quantityInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    backgroundColor: '#F8F4EE',
    color: '#2F241B',
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#111111',
    paddingVertical: 13,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
