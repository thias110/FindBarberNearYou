// Formulaire de profil barber en étapes (issue #43) : validation par étape
// avec le schéma partagé, rattachement des erreurs serveur et brouillon local.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_PROFILE_FORM,
  clearProfileDraft,
  firstStepWithError,
  loadProfileDraft,
  PROFILE_FIELDS,
  positionOf,
  saveProfileDraft,
  stepFromHash,
  toProfileRequest,
  validateProfileSteps,
  type ProfileFormState,
} from "../../client/src/lib/profileSteps";
import { profileSchema } from "@findbarber/shared/validation";

const complete: ProfileFormState = {
  ...EMPTY_PROFILE_FORM,
  displayName: "Barbier",
  description: "Coupes soignées",
  places: ["SALON"],
  address: "Rue 1",
  city: "Genève",
  countryCode: "CH",
  latitude: "46.2",
  longitude: "6.14",
  timezone: "Europe/Zurich",
};

describe("validateProfileSteps", () => {
  it("validates only the fields of the steps already shown", () => {
    const form = { ...EMPTY_PROFILE_FORM, displayName: "Barbier", description: "Desc" };
    expect(validateProfileSteps(form, 0)).toEqual({});
    // Étape 2 : aucun lieu choisi, mais aucune erreur sur la ville (étape 3).
    const errors = validateProfileSteps(form, 1);
    expect(Object.keys(errors)).toEqual(["places"]);
  });

  it("reports the field of an invalid step with the shared French message", () => {
    const errors = validateProfileSteps(EMPTY_PROFILE_FORM, 0);
    expect(errors.displayName).toBe("Le nom affiché est requis.");
    expect(errors.description).toBe("La description est requise.");
  });

  it("applies cross-field rules within the step (address, travel radius)", () => {
    const base = { ...complete, address: "", places: ["SALON" as const] };
    expect(validateProfileSteps(base, 1).address).toMatch(/adresse est requise/);
    const mobile = { ...complete, places: ["AT_CLIENT" as const], travelRadiusKm: "" };
    expect(validateProfileSteps(mobile, 1).travelRadiusKm).toMatch(/rayon/i);
    expect(validateProfileSteps({ ...mobile, travelRadiusKm: "15" }, 1)).toEqual({});
  });

  it("asks for a position (address or map) when coordinates are missing", () => {
    const errors = validateProfileSteps({ ...complete, latitude: "", longitude: "abc" }, 2);
    expect(errors.latitude).toMatch(/choisissez une adresse suggérée ou cliquez sur la carte/);
    expect(errors.longitude).toBe(errors.latitude);
    expect(validateProfileSteps({ ...complete, latitude: "46,2" }, 2)).toEqual({});
  });

  it("accepts a complete form whose request passes the server schema unchanged", () => {
    expect(validateProfileSteps(complete, 3)).toEqual({});
    const request = toProfileRequest(complete);
    expect(request).not.toHaveProperty("currency");
    expect(profileSchema.safeParse(request).success).toBe(true);
  });

  it("finds the first step containing an error", () => {
    expect(firstStepWithError({ city: "x" })).toBe(2);
    expect(firstStepWithError({ displayName: "x", timezone: "y" })).toBe(0);
    expect(firstStepWithError({})).toBe(-1);
  });
});

describe("stepFromHash", () => {
  it("maps step anchors (and the legacy #devise-fuseau) to their step", () => {
    expect(stepFromHash("#identite")).toBe(0);
    expect(stepFromHash("#localisation")).toBe(2);
    expect(stepFromHash("#fuseau")).toBe(3);
    expect(stepFromHash("#devise-fuseau")).toBe(3);
    expect(stepFromHash("")).toBe(-1);
    expect(stepFromHash("#inconnue")).toBe(-1);
  });
});

describe("positionOf / PROFILE_FIELDS (issue #45)", () => {
  it("returns the chosen position only when both coordinates are numbers", () => {
    expect(positionOf(complete)).toEqual({ latitude: 46.2, longitude: 6.14 });
    expect(positionOf({ ...complete, latitude: "" })).toBeNull();
    expect(positionOf({ ...complete, longitude: "x" })).toBeNull();
  });

  it("lists every form field for server error mapping", () => {
    expect(PROFILE_FIELDS).toContain("latitude");
    expect(PROFILE_FIELDS).toContain("displayName");
    expect(PROFILE_FIELDS).toHaveLength(11);
  });
});

describe("profile draft", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves, restores and clears a draft per user", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
    saveProfileDraft("user-1", { form: complete, step: 2 });
    expect(loadProfileDraft("user-1")).toEqual({ form: complete, step: 2 });
    expect(loadProfileDraft("user-2")).toBeNull();
    clearProfileDraft("user-1");
    expect(loadProfileDraft("user-1")).toBeNull();
  });

  it("ignores a corrupted draft and an unavailable storage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "{not json",
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
      },
    });
    expect(loadProfileDraft("user-1")).toBeNull();
    expect(() => saveProfileDraft("user-1", { form: complete, step: 0 })).not.toThrow();
  });
});
