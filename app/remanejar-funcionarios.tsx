import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchRemanejarFuncionarios, remanejarFuncionario } from '../src/services/api';
import type {
  RemanejarFuncionarioUnit,
  RemanejarFuncionariosResult,
  RemanejarFuncionarioUser,
} from '../src/types';

type OpenSelect = 'user' | 'unit' | null;

const initialData: RemanejarFuncionariosResult = {
  users: [],
  units: [],
};

export default function RemanejarFuncionariosScreen() {
  const [data, setData] = useState<RemanejarFuncionariosResult>(initialData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);

  const selectedUser = data.users.find((item) => item.id === selectedUserId) ?? null;
  const selectedUnit = data.units.find((item) => item.id === selectedUnitId) ?? null;
  const alreadyAssigned = Boolean(selectedUser && selectedUnit && selectedUser.unit_id === selectedUnit.id);

  const load = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const result = await fetchRemanejarFuncionarios();
      setData(result);

      setSelectedUserId((current) => (current && result.users.some((item) => item.id === current) ? current : null));
      setSelectedUnitId((current) => (current && result.units.some((item) => item.id === current) ? current : null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSelectUser = (user: RemanejarFuncionarioUser) => {
    setSelectedUserId(user.id);
    setOpenSelect(null);
    setSuccessMessage('');
  };

  const handleSelectUnit = (unit: RemanejarFuncionarioUnit) => {
    setSelectedUnitId(unit.id);
    setOpenSelect(null);
    setSuccessMessage('');
  };

  const handleRemanejar = async () => {
    if (!selectedUser || !selectedUnit || alreadyAssigned) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await remanejarFuncionario(selectedUser.id, selectedUnit.id);

      setData((current) => ({
        ...current,
        users: current.users.map((item) => (item.id === result.user.id ? result.user : item)),
      }));
      setSelectedUnitId(result.user.unit_id);
      setSuccessMessage(result.message);
      Alert.alert('Remanejado', result.message);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Nao foi possivel remanejar o funcionario.';
      setError(message);
      Alert.alert('Falha ao remanejar', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Equipe</Text>
          <Text style={styles.subtitle}>
            Troque a loja principal do funcionario e mantenha apenas a loja selecionada nas permissoes.
          </Text>
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.inlineSuccess}>
            <Text style={styles.inlineSuccessText}>{successMessage}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#6D573B" />
            <Text style={styles.feedbackText}>Carregando funcionarios e lojas...</Text>
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Funcionario</Text>
              <Pressable
                style={[styles.selectButton, openSelect === 'user' && styles.selectButtonOpen]}
                onPress={() => setOpenSelect((current) => (current === 'user' ? null : 'user'))}
              >
                <Text style={[styles.selectText, !selectedUser && styles.placeholderText]} numberOfLines={1}>
                  {selectedUser
                    ? selectedUser.unit_name
                      ? `${selectedUser.name} - ${selectedUser.unit_name}`
                      : selectedUser.name
                    : 'Selecione um funcionario'}
                </Text>
                <Text style={styles.selectCaret}>{openSelect === 'user' ? '^' : 'v'}</Text>
              </Pressable>

              {openSelect === 'user' ? (
                <View style={styles.optionsCard}>
                  <ScrollView nestedScrollEnabled style={styles.optionsScroll}>
                    {data.users.map((user) => {
                      const selected = user.id === selectedUserId;
                      return (
                        <Pressable
                          key={user.id}
                          style={[styles.optionRow, selected && styles.optionRowActive]}
                          onPress={() => handleSelectUser(user)}
                        >
                          <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>{user.name}</Text>
                          <Text style={[styles.optionHint, selected && styles.optionHintActive]}>
                            {user.unit_name || 'Sem loja definida'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Loja</Text>
              <Pressable
                style={[styles.selectButton, openSelect === 'unit' && styles.selectButtonOpen]}
                onPress={() => setOpenSelect((current) => (current === 'unit' ? null : 'unit'))}
              >
                <Text style={[styles.selectText, !selectedUnit && styles.placeholderText]} numberOfLines={1}>
                  {selectedUnit ? selectedUnit.name : 'Selecione uma loja'}
                </Text>
                <Text style={styles.selectCaret}>{openSelect === 'unit' ? '^' : 'v'}</Text>
              </Pressable>

              {openSelect === 'unit' ? (
                <View style={styles.optionsCard}>
                  <ScrollView nestedScrollEnabled style={styles.optionsScroll}>
                    {data.units.map((unit) => {
                      const selected = unit.id === selectedUnitId;
                      return (
                        <Pressable
                          key={unit.id}
                          style={[styles.optionRow, selected && styles.optionRowActive]}
                          onPress={() => handleSelectUnit(unit)}
                        >
                          <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>{unit.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {selectedUser ? (
              <View style={styles.currentInfoCard}>
                <Text style={styles.currentInfoLabel}>Loja atual</Text>
                <Text style={styles.currentInfoValue}>{selectedUser.unit_name || 'Sem loja definida'}</Text>
              </View>
            ) : null}

            {alreadyAssigned ? (
              <Text style={styles.helperText}>O funcionario ja esta vinculado a essa loja.</Text>
            ) : null}

            <Pressable
              style={[
                styles.actionButton,
                (!selectedUser || !selectedUnit || alreadyAssigned || saving) && styles.actionButtonDisabled,
              ]}
              disabled={!selectedUser || !selectedUnit || alreadyAssigned || saving}
              onPress={() => void handleRemanejar()}
            >
              <Text style={styles.actionButtonText}>{saving ? 'Remanejando...' : 'Remanejar'}</Text>
            </Pressable>
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
  subtitle: { color: '#6F6152', fontSize: 15, lineHeight: 22 },
  inlineError: {
    borderRadius: 18,
    backgroundColor: '#F7E7E4',
    borderWidth: 1,
    borderColor: '#E6C5BF',
    padding: 14,
  },
  inlineErrorText: { color: '#713D35', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  inlineSuccess: {
    borderRadius: 18,
    backgroundColor: '#E9F2EA',
    borderWidth: 1,
    borderColor: '#BFD3C2',
    padding: 14,
  },
  inlineSuccessText: { color: '#365344', fontSize: 14, fontWeight: '700', textAlign: 'center' },
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
  formCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    gap: 14,
  },
  fieldGroup: { gap: 8 },
  label: { color: '#5D4C3D', fontSize: 14, fontWeight: '700' },
  selectButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D8CBBB',
    borderRadius: 16,
    backgroundColor: '#F9F5EF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectButtonOpen: {
    borderColor: '#6D573B',
    backgroundColor: '#F5EEE4',
  },
  selectText: {
    flex: 1,
    color: '#2F241B',
    fontSize: 15,
    fontWeight: '700',
  },
  placeholderText: { color: '#8A7A6C' },
  selectCaret: { color: '#5A4333', fontSize: 12, fontWeight: '900' },
  optionsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1D5C7',
    backgroundColor: '#F8F3EC',
    overflow: 'hidden',
  },
  optionsScroll: { maxHeight: 260 },
  optionRow: {
    borderBottomWidth: 1,
    borderColor: '#E9DFD3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  optionRowActive: {
    backgroundColor: '#6D573B',
    borderColor: '#6D573B',
  },
  optionTitle: { color: '#35281E', fontSize: 14, fontWeight: '800' },
  optionTitleActive: { color: '#FFF8F0' },
  optionHint: { color: '#6D5C4A', fontSize: 12, fontWeight: '600' },
  optionHintActive: { color: '#F6EBDD' },
  currentInfoCard: {
    borderRadius: 18,
    backgroundColor: '#F6F1EA',
    borderWidth: 1,
    borderColor: '#E1D5C7',
    padding: 14,
    gap: 4,
  },
  currentInfoLabel: {
    color: '#6D5C4A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  currentInfoValue: { color: '#30261D', fontSize: 15, fontWeight: '800' },
  helperText: { color: '#7A6449', fontSize: 13, fontWeight: '700' },
  actionButton: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#6D573B',
    paddingVertical: 14,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: { color: '#FFF8F0', fontSize: 15, fontWeight: '800' },
});
