// Helpers de test pour les migrations drizzle : lecture du journal et
// découverte d'une migration cible PAR CONTENU (aucune dépendance à la
// dernière entrée du journal). Réutilisés par les tests de migration des
// horaires (lot 5) et du fuseau (lot 6A).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DRIZZLE_DIR = fileURLToPath(
  new URL("../../server/drizzle", import.meta.url),
);

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

export function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(
    readFileSync(`${DRIZZLE_DIR}/meta/_journal.json`, "utf8"),
  ) as { entries: JournalEntry[] };
  return journal.entries;
}

export function readMigration(tag: string): string {
  return readFileSync(`${DRIZZLE_DIR}/${tag}.sql`, "utf8");
}

/** Premier tag du journal (dans l'ordre) dont le SQL satisfait `predicate`. */
export function findTagBySqlContent(
  predicate: (sql: string) => boolean,
): string {
  for (const entry of journalEntries()) {
    if (predicate(readMigration(entry.tag))) return entry.tag;
  }
  throw new Error("Aucune migration du journal ne correspond au contenu attendu.");
}

/** Tags du journal strictement antérieurs à `tag`. */
export function tagsBefore(tag: string): string[] {
  const entries = journalEntries();
  const index = entries.findIndex((entry) => entry.tag === tag);
  if (index === -1) {
    throw new Error(`Migration "${tag}" absente du journal drizzle.`);
  }
  return entries.slice(0, index).map((entry) => entry.tag);
}
