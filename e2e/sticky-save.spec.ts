// Enregistrer sans remonter (issue #56) : sur les longs formulaires de
// l'espace pro, le bouton d'enregistrement et le résultat restent à l'écran,
// et chaque section du profil est atteignable par une ancre.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

test.use({ viewport: { width: 1280, height: 640 } });

test("profil : sections par ancre, bouton et résultat toujours visibles", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/profile");
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });

  // En haut de la page, le bouton est déjà à l'écran.
  await expect(save).toBeInViewport();

  // Le sommaire mène directement à une section.
  await page
    .getByRole("navigation", { name: "Sections du profil" })
    .getByRole("link", { name: "Devise et fuseau" })
    .click();
  await expect(page).toHaveURL(/#devise-fuseau$/);
  await expect(
    page.getByRole("heading", { name: "Devise et fuseau horaire" }),
  ).toBeInViewport();

  // Enregistrement depuis le milieu de la page : le résultat apparaît à côté
  // du bouton, sans remonter.
  await page.getByRole("heading", { name: "Localisation" }).scrollIntoViewIfNeeded();
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
