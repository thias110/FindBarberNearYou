// Messages de validation Zod partagés traduits côté client : chaque message
// écrit dans shared/src/validation est reconnu par la table de traduction, et
// un message inconnu est rendu tel quel.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LIMITS, STATS_LIMITS } from "@findbarber/shared/constants";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from "@findbarber/shared/validation";
import i18n from "../../client/src/i18n";
import {
  isKnownValidationMessage,
  translateValidationMessage,
} from "../../client/src/lib/validationMessages";

const VALIDATION_DIR = path.resolve(__dirname, "../../shared/src/validation");

// Valeurs des expressions `${…}` des gabarits. `weekday` est une valeur
// d'exécution : on prend un jour valide.
const SCOPE: Record<string, unknown> = {
  LIMITS,
  STATS_LIMITS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  weekday: 3,
};

function evaluate(expression: string): string {
  let value: unknown = SCOPE;
  for (const part of expression.trim().split(".")) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  if (value === undefined) throw new Error(`Expression inconnue : ${expression}`);
  return String(value);
}

/** Littéraux de message (chaînes et gabarits) des schémas partagés. */
function extractMessages(): string[] {
  const messages = new Set<string>();
  for (const file of readdirSync(VALIDATION_DIR)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(path.join(VALIDATION_DIR, file), "utf8")
      // Commentaires de ligne (aucun message ne contient « // »).
      .replace(/(^|[\s;,{(])\/\/.*$/gm, "$1");
    const literals = [
      ...[...source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]),
      ...[...source.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) =>
        m[1].replace(/\$\{([^}]+)\}/g, (_, expr: string) => evaluate(expr)),
      ),
    ];
    // Un message est une phrase : au moins une espace et un point final.
    for (const literal of literals) {
      if (/\s/.test(literal) && literal.endsWith(".")) messages.add(literal);
    }
  }
  return [...messages];
}

describe("messages de validation partagés", () => {
  const messages = extractMessages();

  it("sont tous reconnus par la table de traduction", () => {
    // Garde-fou de l'extraction elle-même (~87 messages distincts).
    expect(messages.length).toBeGreaterThan(80);
    expect(messages).toContain("Le nom affiché est requis.");
    expect(messages).toContain(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
    expect(messages).toContain("Jour 3 : plages qui se chevauchent.");
    expect(messages.filter((m) => !isKnownValidationMessage(m))).toEqual([]);
  });

  it("gardent en français le texte d'origine quand il est en français", async () => {
    await i18n.changeLanguage("fr");
    expect(translateValidationMessage("Le nom affiché est requis.")).toBe(
      "Le nom affiché est requis.",
    );
    expect(
      translateValidationMessage(
        `La durée ne peut pas dépasser ${LIMITS.serviceDurationMax} minutes.`,
      ),
    ).toBe(`La durée ne peut pas dépasser ${LIMITS.serviceDurationMax} minutes.`);
    expect(translateValidationMessage("Password is required.")).toBe(
      "Le mot de passe est requis.",
    );
    // Aucun message traduit ne laisse de clé brute ni d'interpolation vide.
    for (const message of messages) {
      const text = translateValidationMessage(message);
      expect(text, message).not.toMatch(/validation:|\{\{/);
    }
  });

  describe("en anglais", () => {
    afterAll(async () => {
      await i18n.changeLanguage("fr");
    });

    it("traduit un message connu, avec ses valeurs", async () => {
      await i18n.changeLanguage("en");
      expect(translateValidationMessage("Le nom affiché est requis.")).toBe(
        "Display name is required.",
      );
      expect(
        translateValidationMessage(
          `Le rayon ne peut pas dépasser ${LIMITS.travelRadiusKmMax} km.`,
        ),
      ).toBe(`The radius cannot exceed ${LIMITS.travelRadiusKmMax} km.`);
      expect(translateValidationMessage("Jour 1 : plages qui se chevauchent.")).toBe(
        "Monday: overlapping slots.",
      );
      for (const message of messages) {
        const text = translateValidationMessage(message);
        expect(text, message).not.toMatch(/validation:|\{\{/);
      }
    });

    it("renvoie tel quel un message inconnu", async () => {
      await i18n.changeLanguage("en");
      expect(translateValidationMessage("Message inconnu du serveur.")).toBe(
        "Message inconnu du serveur.",
      );
      expect(translateValidationMessage("Jour 9 : plages qui se chevauchent.")).toBe(
        "Jour 9 : plages qui se chevauchent.",
      );
    });
  });
});
