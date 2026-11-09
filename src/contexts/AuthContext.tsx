import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { checkRedirectResult, onAuthChange } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  redirectError: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, redirectError: false });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((next) => {
      setUser(next);
      setLoading(false);
    });
    void checkRedirectResult().catch(() => { if (active) setRedirectError(true); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading, redirectError }}>{children}</AuthContext.Provider>;
}
