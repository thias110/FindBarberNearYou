// Page Paramètres (issue #29) : accès réservé aux comptes connectés, lien
// depuis Mon compte, sections Apparence et Confidentialité, thème conservé.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

test("un visiteur est redirigé vers la connexion", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("Paramètres depuis Mon compte : sections, thème et accessibilité", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/account");
  await page.getByRole("link", { name: "Paramètres" }).click();
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

  await expectNoA11yViolations(page);

  // Retour au thème système pour ne pas influencer les autres parcours.
  await page.getByRole("radio", { name: /Système/ }).check();
});
