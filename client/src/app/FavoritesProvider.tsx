import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { userApi } from "../lib/apiClient";
import { useAuth } from "./auth-context";
import { FavoritesContext } from "./favorites-context";

// Favoris du CLIENT connecté (lot N5) : chargés une fois, puis tenus à jour de
// façon optimiste (le cœur change tout de suite, et revient en arrière si le
// serveur refuse). Les autres rôles et les visiteurs n'ont aucun favori.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.role === "CLIENT" ? user.id : null;
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    setIds(new Set());
    setPendingIds(new Set());
    if (!userId) return;
    let cancelled = false;
    userApi
      .listFavorites()
      .then((res) => {
        if (!cancelled) setIds(new Set(res.barbers.map((b) => b.id)));
      })
      .catch(() => {
        // Les cœurs restent vides ; un ajout se fera sur une liste à jour.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    async (barberId: string) => {
      const wasFavorite = idsRef.current.has(barberId);
      const mark = (set: ReadonlySet<string>, on: boolean) => {
        const next = new Set(set);
        if (on) next.add(barberId);
        else next.delete(barberId);
        return next;
      };
      setIds((prev) => mark(prev, !wasFavorite));
      setPendingIds((prev) => mark(prev, true));
      try {
        if (wasFavorite) await userApi.removeFavorite(barberId);
        else await userApi.addFavorite(barberId);
      } catch (err) {
        setIds((prev) => mark(prev, wasFavorite));
        throw err;
      } finally {
        setPendingIds((prev) => mark(prev, false));
      }
    },
    [],
  );

  const value = useMemo(() => ({ ids, pendingIds, toggle }), [ids, pendingIds, toggle]);
  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}
