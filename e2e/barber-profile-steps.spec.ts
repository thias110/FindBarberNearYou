// Formulaire de profil barber en étapes (issue #43). Le compte démo a déjà un
// profil : l'absence de profil et l'enregistrement sont simulés (page.route)
// pour parcourir la création sans modifier les données démo.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, API, expectNoA11yViolations, loginByApi } from "./helpers";

// PNG 1 × 1 valide.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("barber : création du profil en étapes, brouillon conservé au rechargement", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.barber);
  const me = (await (await page.request.get(`${API}/api/auth/me`)).json()).user;
  let sent: Record<string, unknown> | null = null;
  await page.route(`${API}/api/barber/profile`, async (route) => {
    if (route.request().method() === "PUT") {
      sent = route.request().postDataJSON();
      await route.fulfill({
        json: {
          profile: {
            ...sent,
            id: "p-1",
            currency: "CHF",
            avatarPath: null,
            certified: false,
            onlinePayment: { mode: "NONE", depositPercent: 20 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: { code: "BARBER_PROFILE_NOT_FOUND", message: "Aucun profil." } },
    });
  });

  await page.goto("/pro/profile");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Créer mon profil" })).toBeVisible();
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();

  // Étape invalide : l'erreur s'affiche à côté du champ, on reste sur l'étape.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Le nom affiché est requis.")).toBeVisible();
  await expect(page.getByLabel("Nom affiché")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();

  await page.getByLabel("Nom affiché").fill("Barbier Étapes");
  await page.getByLabel("Description").fill("Coupes et barbes");

  // Photo obligatoire (issue #44) : sans elle, on ne quitte pas l'étape 1.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Ajoutez une photo de profil pour continuer.")).toBeVisible();
  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();

  // Envoi simulé : les données démo ne sont pas modifiées.
  await page.route(`${API}/api/users/me/avatar`, (route) =>
    route.fulfill({ json: { user: { ...me, avatarPath: "/uploads/avatars/e2e.webp" } } }),
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("Ajoutez une photo de profil pour continuer.")).toBeHidden();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Étape 2 sur 4")).toBeVisible();

  // Rechargement : les données saisies et l'étape atteinte sont conservées.
  // (La photo simulée n'existe pas côté serveur : on garde la session simulée.)
  await page.route(`${API}/api/auth/me`, (route) =>
    route.fulfill({ json: { user: { ...me, avatarPath: "/uploads/avatars/e2e.webp" } } }),
  );
  await page.reload();
  await expect(page.getByText("Étape 2 sur 4")).toBeVisible();
  await page.getByRole("button", { name: /Identité/ }).click();
  await expect(page.getByLabel("Nom affiché")).toHaveValue("Barbier Étapes");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("En salon").check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText(/adresse est requise/)).toBeVisible();
  await page.getByLabel("Adresse privée (facultative)").fill("Rue du Test 1");
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByLabel("Ville").fill("Genève");
  await expect(page.getByText("Franc suisse (CHF)")).toBeVisible();
  // Position (issue #45) : plus de champ latitude/longitude.
  await expect(page.getByLabel("Latitude")).toHaveCount(0);
  await expect(page.getByLabel("Longitude")).toHaveCount(0);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText(/choisissez une adresse suggérée ou cliquez sur la carte/)).toBeVisible();

  // Autocomplétion simulée (le géocodage réel passe par le serveur).
  await page.route(`${API}/api/barber/address-suggestions*`, (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("countryCode")).toBe("CH");
    return route.fulfill({
      json: {
        suggestions: [
          { label: "Rue du Test 1, 1201 Genève", latitude: 46.2044, longitude: 6.1432 },
        ],
      },
    });
  });
  await page.getByRole("combobox", { name: "Rechercher votre adresse" }).fill("Rue du Test 1");
  await page.getByRole("button", { name: "Rue du Test 1, 1201 Genève" }).click();
  await expect(page.getByText("Position enregistrée : Rue du Test 1, 1201 Genève.")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByText("Étape 4 sur 4")).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await expect(page.getByText("Profil créé.")).toBeVisible();
  expect(sent).toMatchObject({
    displayName: "Barbier Étapes",
    places: ["SALON"],
    address: "Rue du Test 1",
    city: "Genève",
    latitude: 46.2044,
  });
  expect(sent).not.toHaveProperty("currency");
  // Brouillon effacé après la création.
  expect(
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) =>
        key.startsWith("fb-barber-profile-draft:"),
      ),
    ),
  ).toEqual([]);
});
