// Erreurs au plus près du champ (issue #57) : message sous le champ, lié par
// aria-describedby, focus placé sur le premier champ en erreur.
import { expect, test, type Locator } from "@playwright/test";
import { ACCOUNTS, loginByApi } from "./helpers";

async function expectDescribedBy(field: Locator, message: RegExp): Promise<void> {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const ids = (await field.getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(" ")
      .filter(Boolean)
      .map((id) => field.page().locator(`[id="${id}"]`).innerText()),
  );
  expect(texts.join(" ")).toMatch(message);
}

test("inscription : email déjà utilisé affiché sous le champ, focus dessus", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Email" }).fill(ACCOUNTS.client);
  await page.getByLabel("Mot de passe", { exact: true }).fill("MotDePasse123!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  const email = page.getByRole("textbox", { name: "Email" });
  await expectDescribedBy(email, /existe déjà/);
  await expect(email).toBeFocused();
});

test("connexion : champs vides, focus sur le premier en erreur", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Se connecter" }).click();
  const email = page.getByRole("textbox", { name: "Email" });
  await expectDescribedBy(email, /requis/);
  await expect(email).toBeFocused();
});

test("prestations : prix invalide affiché sous le champ Prix", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/services");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ajouter" }) });
  await form.getByLabel("Nom du service").fill("Test erreurs");
  await form.getByLabel("Durée (minutes)").fill("30");
  await form.getByLabel("Prix").fill("abc");
  await form.getByRole("button", { name: "Ajouter" }).click();

  const price = form.getByLabel("Prix");
  await expectDescribedBy(price, /Prix invalide/);
  await expect(price).toBeFocused();
  await expect(price).toBeInViewport();
});
