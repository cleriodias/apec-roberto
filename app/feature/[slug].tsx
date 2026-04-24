import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const featureTitles: Record<string, string> = {
  'vendas-hoje': 'Vendas Hoje',
  'nota-fiscal': 'Nota Fiscal',
};

export default function FeatureScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const title = featureTitles[params.slug ?? ''] ?? 'Funcionalidade';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SafeAreaView style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Em preparacao</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>Esta funcionalidade sera conectada aos endpoints do sistema.</Text>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3EEE7',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    color: '#6A5B4C',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    color: '#2F241B',
    fontSize: 30,
    fontWeight: '800',
  },
  summary: {
    color: '#5F5042',
    fontSize: 16,
    lineHeight: 24,
  },
});
