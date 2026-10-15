// Page Paramètres (issue #29) : accès réservé aux comptes connectés, lien
// depuis Mon compte, sections Apparence et Confidentialité, thème conservé.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

test("un visiteur est redirigé vers la connexion", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
});

// Issue #30 : le thème se choisit uniquement dans Paramètres.
test("aucun sélecteur de thème dans les en-têtes", async ({ page }) => {
  const themeButtons = page.getByRole("button", { name: /thème/i });
  for (const path of ["/", "/login", "/register", "/barbers"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(themeButtons).toHaveCount(0);
  }
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Mon compte", exact: true })).toBeVisible();
  await expect(themeButtons).toHaveCount(0);
});

test("Paramètres depuis Mon compte : sections, thème et accessibilité", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/account");
  await page.getByRole("link", { name: "Paramètres", exact: true }).click();
  await expect(page).toHaveTitle("Paramètres — FindBarber");

  await expect(page.getByRole("heading", { name: "Apparence" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Confidentialité" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Télécharger mes données" }),
  ).toBeVisible();

  // Le thème choisi s'applique tout de suite et reste après rechargement.
  await page.getByRole("radio", { name: /Sombre/ }).check();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("radio", { name: /Sombre/ })).toBeChecked();
  // Le choix vaut pour toute l'application, pas seulement cette page.
  await page.goto("/account");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.goto("/settings");

  await expectNoA11yViolations(page);

  // Retour au thème système pour ne pas influencer les autres parcours.
  await page.getByRole("radio", { name: /Système/ }).check();
});
