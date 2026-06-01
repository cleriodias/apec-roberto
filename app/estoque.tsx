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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const indexedItems = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const load = useCallback(async (nextSearch: string, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setMessage('');

    try {
      const result = await fetchEstoqueProducts(nextSearch);
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
    void load(search.trim());
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
    void load('');
  }, [load]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(lastSearch, true)} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Produtos</Text>
          <Text style={styles.title}>Estoque</Text>
          <Text style={styles.subtitle}>Atualize a quantidade atual de qualquer produto cadastrado.</Text>
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
            <Pressable style={styles.retryButton} onPress={() => void load(lastSearch)}>
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
