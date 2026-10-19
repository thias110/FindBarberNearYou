// Page introuvable (lot N7) : vraie page au lieu d'une redirection silencieuse.
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

test("une adresse inconnue affiche la page « Page introuvable »", async ({ page }) => {
  await page.goto("/cette-page-n-existe-pas");
  await expect(page).toHaveURL(/\/cette-page-n-existe-pas$/);
  await expect(page).toHaveTitle("Page introuvable — FindBarber");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Rechercher un barber" })).toHaveAttribute(
    "href",
    "/barbers",
  );
  await expect(main.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
  await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  await expectNoA11yViolations(page);
});

test("le noindex disparaît dès qu'on quitte la page introuvable", async ({ page }) => {
  await page.goto("/cette-page-n-existe-pas");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
  await page.getByRole("main").getByRole("link", { name: "Accueil" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("« Rechercher un barber » mène à la recherche", async ({ page }) => {
  await page.goto("/cette-page-n-existe-pas");
  await page.getByRole("main").getByRole("link", { name: "Rechercher un barber" }).click();
  await expect(page).toHaveURL(/\/barbers$/);
});
