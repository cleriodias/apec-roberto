import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ClientSession } from '../types';

const AUTH_KEY = '@adapp-cliente/auth';

export async function loadClientSession(): Promise<ClientSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as ClientSession) : null;
  } catch {
    return null;
  }
}

export async function saveClientSession(session: ClientSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export async function clearClientSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}
