import { useEffect, useState } from "react";

// Délai au-delà duquel un chargement bascule sur l'état d'erreur (plan §2.7) :
// aucun squelette ne tourne sans fin.
export const LOADING_TIMEOUT_MS = 10_000;

/**
 * Vrai si `loading` dure depuis plus de `timeoutMs`. Repasse à faux dès que le
 * chargement se termine ou recommence (nouvel essai).
 */
export function useLoadingTimeout(
  loading: boolean,
  timeoutMs: number = LOADING_TIMEOUT_MS,
): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (!loading) return;
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [loading, timeoutMs]);
  return timedOut;
}
