import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchProfile, getSession, onAuthChange } from '@/lib/api';
import type { AppSession, Profile } from '@/lib/types';

type AuthState = {
  session: AppSession | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return onAuthChange(setSession);
  }, []);

  const userId = session?.user.id;

  const refreshProfile = useCallback(async () => {
    setProfile(userId ? await fetchProfile(userId).catch(() => null) : null);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = userId ? await fetchProfile(userId).catch(() => null) : null;
      if (!cancelled) setProfile(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
