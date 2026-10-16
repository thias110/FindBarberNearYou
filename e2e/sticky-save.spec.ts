// Enregistrer sans remonter (issue #56) : sur les longs formulaires de
// l'espace pro, le bouton d'enregistrement et le résultat restent à l'écran,
// et chaque étape du profil (issue #43) est atteignable par une ancre.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

test.use({ viewport: { width: 1280, height: 640 } });

test("profil : étapes par ancre, bouton et résultat toujours visibles", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/profile");
  const next = page.getByRole("button", { name: "Enregistrer et continuer" });

  // En haut de la page, le bouton est déjà à l'écran.
  await expect(next).toBeInViewport();

  // Le formulaire est découpé en étapes (issue #43) : chaque étape a son ancre.
  await page
    .getByRole("navigation", { name: "Étapes du profil" })
    .getByRole("button", { name: /Fuseau horaire/ })
    .click();
  await expect(page).toHaveURL(/#fuseau$/);
  await expect(
    page.getByRole("heading", { name: "Fuseau horaire" }),
  ).toBeInViewport();

  // Le résultat apparaît à côté du bouton, sans remonter.
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(page.getByText("Profil enregistré.")).toBeInViewport();
  await expectNoA11yViolations(page);
});

test("profil : un lien direct ouvre la section visée", async ({ page }) => {
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/profile#localisation");
  await expect(page.locator("#localisation")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Localisation" }),
  ).toBeInViewport();
});

test("horaires : le bouton d'enregistrement reste à l'écran", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/working-hours");
  const save = page.getByRole("button", { name: "Enregistrer le planning" });
  await expect(save).toBeInViewport();
  await page.mouse.wheel(0, 400);
  await expect(save).toBeInViewport();
});
