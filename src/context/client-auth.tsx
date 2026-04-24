import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { clearClientSession, loadClientSession, saveClientSession } from '../services/auth-store';
import { loginWithEmail } from '../services/api';
import type { ClientSession } from '../types';

type ClientAuthContextValue = {
  session: ClientSession | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const ClientAuthContext = createContext<ClientAuthContextValue | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const stored = await loadClientSession();
      setSession(stored);
      setLoading(false);
    };

    void run();
  }, []);

  const value = useMemo<ClientAuthContextValue>(
    () => ({
      session,
      loading,
      signIn: async (email: string) => {
        const nextSession = await loginWithEmail(email);
        await saveClientSession(nextSession);
        setSession(nextSession);
      },
      signOut: async () => {
        await clearClientSession();
        setSession(null);
      },
    }),
    [loading, session]
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within ClientAuthProvider');
  }
  return context;
}
