import { useEffect, useSyncExternalStore } from "react";
import type { LatLng } from "./geo";

// Position du visiteur (issues #52 et #54). Donnée personnelle : gardée
// uniquement en mémoire (jamais dans l'URL, le stockage du navigateur ni une
// requête au serveur). Partagée entre la recherche et l'accueil pour la durée
// de la visite.

export type VisitorPositionStatus =
  | "idle" // jamais demandée
  | "pending" // demande en cours
  | "granted" // position connue
  | "denied" // refus du visiteur
  | "unavailable"; // navigateur sans géolocalisation ou position introuvable

export interface VisitorPositionState {
  status: VisitorPositionStatus;
  position: LatLng | null;
}

let state: VisitorPositionState = { status: "idle", position: null };
const listeners = new Set<() => void>();

function setState(next: VisitorPositionState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function geolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/** Demande la position (déclenche l'invite du navigateur si nécessaire). */
export function requestVisitorPosition(): void {
  if (state.status === "pending" || state.status === "granted") return;
  if (!geolocationAvailable()) {
    setState({ status: "unavailable", position: null });
    return;
  }
  setState({ status: "pending", position: null });
  navigator.geolocation.getCurrentPosition(
    (result) => {
      setState({
        status: "granted",
        position: {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        },
      });
    },
    (error) => {
      setState({
        status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        position: null,
      });
    },
    { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 15_000 },
  );
}

// Si le visiteur a DÉJÀ autorisé la géolocalisation pour ce site, la position
// est relue sans nouvelle invite (aucune demande spontanée sinon).
async function restoreIfAlreadyGranted(): Promise<void> {
  if (state.status !== "idle" || !geolocationAvailable()) return;
  try {
    const permission = await navigator.permissions?.query({ name: "geolocation" });
    if (permission?.state === "granted") requestVisitorPosition();
  } catch {
    // API Permissions absente : on attend une action du visiteur.
  }
}

export function useVisitorPosition(): VisitorPositionState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void restoreIfAlreadyGranted();
  }, []);
  return snapshot;
}
