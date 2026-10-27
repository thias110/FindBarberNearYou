import { createContext, useContext } from "react";

export interface FavoritesContextValue {
  /** Identifiants des barbers en favori (vide hors du rôle CLIENT). */
  ids: ReadonlySet<string>;
  /** Barbers dont l'ajout ou le retrait est en cours. */
  pendingIds: ReadonlySet<string>;
  /** Ajoute ou retire le favori, de façon optimiste ; rejette si le serveur refuse. */
  toggle: (barberId: string) => Promise<void>;
}

export const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined,
);

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
