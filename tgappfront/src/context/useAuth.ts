import { createContext, useContext } from "react";
import type { AuthUser } from "../types/auth";

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  onCartMerge?: (token: string) => Promise<void>;
  setCartMergeCallback: (cb: ((token: string) => Promise<void>) | undefined) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  setAuth: () => {},
  logout: () => {},
  updateUser: () => {},
  setCartMergeCallback: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
