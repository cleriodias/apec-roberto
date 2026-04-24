import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F3EEE7',
    card: '#F3EEE7',
    border: '#D8CBBB',
    primary: '#111111',
    text: '#2F241B',
    notification: '#5A4333',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: '#F3EEE7' } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="boletos" options={{ title: 'Boletos' }} />
        <Stack.Screen name="vendas-hoje" options={{ title: 'Vendas Hoje' }} />
        <Stack.Screen name="nota-fiscal" options={{ title: 'Nota Fiscal' }} />
        <Stack.Screen name="feature/[slug]" options={{ title: 'Funcionalidade' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
