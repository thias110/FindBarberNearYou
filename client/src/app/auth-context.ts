import { createContext, useContext } from "react";
import type { PublicUser } from "@findbarber/shared/types";

export interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  /** Remplace l'utilisateur en session après une modification réussie côté
   * serveur (ex. photo de profil, issue #55) : l'interface suit sans recharger. */
  updateUser: (user: PublicUser) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
