import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const quickLinks = [
  {
    path: '/boletos',
    title: 'Boletos',
    backgroundColor: '#8A4E4E',
    borderColor: '#6F3F3F',
    titleColor: '#FFF6F6',
  },
  {
    path: '/vendas-hoje',
    title: 'Vendas Hoje',
    backgroundColor: '#4C7091',
    borderColor: '#395872',
    titleColor: '#F3F8FC',
  },
  {
    path: '/nota-fiscal',
    title: 'Nota Fiscal',
    backgroundColor: '#5A7A69',
    borderColor: '#466052',
    titleColor: '#F2FAF5',
  },
  {
    path: '/remanejar-funcionarios',
    title: 'Remanejar Funcionarios',
    backgroundColor: '#7B6548',
    borderColor: '#5E4D36',
    titleColor: '#FFF8EF',
  },
] as const;

export default function IndexScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>PEC - ROBERTO</Text>
          <Text style={styles.subtitle}>Controle de Lojas</Text>
        </View>

        <View style={styles.menu}>
          {quickLinks.map((item) => (
            <Pressable
              key={item.path}
              style={[
                styles.card,
                {
                  backgroundColor: item.backgroundColor,
                  borderColor: item.borderColor,
                },
              ]}
              onPress={() => router.push(item.path)}
            >
              <Text style={[styles.cardTitle, { color: item.titleColor }]}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3EEE7',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
  },
  hero: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#111111',
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#6A5B4C',
    fontSize: 16,
    lineHeight: 24,
  },
  menu: {
    gap: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#5B2C14',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
});
