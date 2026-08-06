import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { AuthUser } from "../types/auth";
import { fetchMe } from "../api/auth";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);
  const [cartMergeCallback, setCartMergeCallback] = useState<((token: string) => Promise<void>) | undefined>(
    () => undefined
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (token) {
        try {
          const u = await fetchMe();
          if (cancelled) return;
          setUser(u);
          localStorage.setItem("auth_user", JSON.stringify(u));
        } catch {
          if (cancelled) return;
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          setToken(null);
          setUser(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(false);
    }

    bootstrap();
    return () => { cancelled = true; };
  }, [token]);

  const setAuth = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
    localStorage.setItem("auth_user", JSON.stringify(updated));
  }, []);

  const cmCb = useCallback(
    (cb: ((token: string) => Promise<void>) | undefined) => setCartMergeCallback(() => cb),
    []
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, setAuth, logout, updateUser, setCartMergeCallback: cmCb, onCartMerge: cartMergeCallback }}>
      {children}
    </AuthContext.Provider>
  );
}
