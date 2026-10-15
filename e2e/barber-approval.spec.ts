// Approbation des nouveaux barbers (issue #40) : le profil en attente est
// invisible dans la recherche, le barber voit qu'il attend une validation,
// l'admin l'approuve et le profil apparaît.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

const PENDING_EMAIL = "nouveau.barber@demo.ch";
const PENDING_NAME = "Lucas — Nouveau Salon";

test("parcours d'approbation d'un nouveau barber", async ({ page, browser }) => {
  // Visiteur : profil absent de la recherche.
  const visitor = await browser.newPage();
  await visitor.goto("/barbers");
  await expect(visitor.getByText("Karim", { exact: false }).first()).toBeVisible();
  await expect(visitor.getByText(PENDING_NAME)).toHaveCount(0);

  // Barber en attente : bannière sur le tableau de bord.
  const barber = await browser.newPage();
  await loginByApi(barber, PENDING_EMAIL);
  await barber.goto("/pro/dashboard");
  await expect(barber.getByText("Votre profil attend une validation.")).toBeVisible();

  // Admin : alerte sur le tableau de bord, filtre « À approuver », approbation.
  await loginByApi(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Voir les profils à approuver" }).click();
  await expect(page).toHaveURL(/filtre=a-approuver/);
  const card = page.getByRole("listitem").filter({ hasText: PENDING_EMAIL });
  await expect(card.getByText("En attente d'approbation")).toBeVisible();
  await expectNoA11yViolations(page);
  await card.getByRole("button", { name: "Approuver" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approuver" }).click();
  await expect(page.getByText(`${PENDING_EMAIL} est approuvé`)).toBeVisible();

  // Le profil apparaît dans la recherche et la bannière disparaît.
  await visitor.reload();
  await expect(visitor.getByText(PENDING_NAME).first()).toBeVisible();
  await barber.reload();
  await expect(barber.getByRole("heading", { name: "Espace professionnel" })).toBeVisible();
  await expect(barber.getByText("Votre profil attend une validation.")).toHaveCount(0);
});
