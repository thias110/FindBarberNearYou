import { useCallback, useEffect, useRef, useState } from "react";
import {
  requestVisitorPosition,
  type VisitorPositionStatus,
} from "./visitorPosition";

export type LocateNotice = "pending" | "centered" | "denied" | "unavailable";

const NOTICE_DURATION_MS = 6000;

/**
 * Bouton « Ma position » de la carte : demande la position du visiteur
 * (invite du navigateur au besoin), puis incrémente `recenterCount`, que la
 * carte lit pour se recentrer. `notice` est le message bref à afficher ; il
 * s'efface seul, sauf « recherche en cours ». Appuyer pendant une demande déjà
 * lancée ailleurs (filtre de distance) recentre dès l'arrivée de la position.
 */
export function useLocateButton(status: VisitorPositionStatus) {
  const [locating, setLocating] = useState(false);
  const [recenterCount, setRecenterCount] = useState(0);
  // `id` change à chaque message : le même message réaffiché relance le minuteur.
  const [notice, setNotice] = useState<{ kind: LocateNotice; id: number } | null>(
    null,
  );
  const lastId = useRef(0);

  const show = useCallback((kind: LocateNotice) => {
    lastId.current += 1;
    setNotice({ kind, id: lastId.current });
  }, []);

  const onLocate = useCallback(() => {
    if (status === "granted") {
      setRecenterCount((count) => count + 1);
      show("centered");
      return;
    }
    setLocating(true);
    show("pending");
    requestVisitorPosition();
  }, [status, show]);

  useEffect(() => {
    if (!locating) return;
    if (status === "granted") {
      setLocating(false);
      setRecenterCount((count) => count + 1);
      show("centered");
    } else if (status === "denied" || status === "unavailable") {
      setLocating(false);
      show(status);
    }
  }, [locating, status, show]);

  useEffect(() => {
    if (notice === null || notice.kind === "pending") return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return { onLocate, recenterCount, notice: notice?.kind ?? null };
}
