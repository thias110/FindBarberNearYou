import { useState } from "react";

const STORAGE_KEY = "fb-signature-played";

// Décision prise une seule fois par chargement de page, puis rappelée pendant
// une courte fenêtre : les rendus en double de React (StrictMode, rendu
// concurrent) ne doivent pas « consommer » l'animation. Les montages
// suivants de la session l'affichent figée.
const REUSE_WINDOW_MS = 1000;
let decision: { play: boolean; at: number } | null = null;

function decide(): boolean {
  const now = Date.now();
  if (decision) {
    return decision.play && now - decision.at < REUSE_WINDOW_MS;
  }
  let play = false;
  try {
    play = !window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Sans `sessionStorage` (navigation privée stricte), pas d'animation : le
    // contenu s'affiche directement.
  }
  decision = { play, at: now };
  return play;
}

/**
 * Vrai si le moment signature doit être joué (plan §2.5 : une seule fois par
 * session). Les retours sur la page pendant la session l'affichent figé.
 */
export function useSignatureOnce(): boolean {
  const [play] = useState(decide);
  return play;
}
