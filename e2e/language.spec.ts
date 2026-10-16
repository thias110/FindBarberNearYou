// Choix de la langue (issues #32, #37, #38) : sélecteur dans le header,
// conservé après rechargement, enregistré sur le compte et repris dans
// Paramètres, présélectionné à l'inscription.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_PASSWORD, loginByApi } from "./helpers";

test("visiteur : FR par défaut, choix EN conservé, aucun défilement à 375 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  const select = page.getByRole("banner").getByRole("combobox", { name: "Langue" });
  await expect(select).toHaveValue("fr");

  await select.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(
    page.getByRole("banner").getByRole("combobox", { name: "Language" }),
  ).toHaveValue("en");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("compte : la langue choisie dans le header est enregistrée et reprise dans Paramètres", async ({
  page,
  browser,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/settings");
  await page.getByRole("banner").getByRole("combobox").selectOption("es");
  await expect(page.getByRole("heading", { name: "Idioma" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("combobox", { name: "Idioma" })).toHaveValue("es");

  // Autre navigateur, sans préférence locale : la langue vient du compte.
  const other = await browser.newPage();
  await loginByApi(other, ACCOUNTS.client);
  await other.goto("/settings");
  await expect(other.locator("html")).toHaveAttribute("lang", "es");

  // Remise en français pour les autres tests.
  await page.getByRole("banner").getByRole("combobox").selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("inscription : langue courante présélectionnée et envoyée avec le compte", async ({
  page,
}) => {
  await page.goto("/register");
  // En bureau, le sélecteur compact est en haut de la zone du formulaire.
  await page.getByRole("combobox", { name: "Langue" }).first().selectOption("it");
  const field = page.locator("form").getByRole("combobox", { name: "Lingua" });
  await expect(field).toHaveValue("it");

  await page.getByRole("textbox", { name: "Email" }).fill(`lingua-${Date.now()}@example.com`);
  await page.getByLabel(/password|Mot de passe/i).first().fill(DEMO_PASSWORD);
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().endsWith("/api/auth/register")),
    page.locator("form").getByRole("button", { name: /Crée|Create|Crea/ }).click(),
  ]);
  expect(request.postDataJSON()).toMatchObject({ locale: "it" });
});

test("anglais : les écrans visiteur, barber et admin sont traduits", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("combobox", { name: "Langue" }).first().selectOption("en");
  await expect(page.getByRole("heading", { name: "Good to see you again." })).toBeVisible();
  await expect(page).toHaveTitle("Log in — FindBarber");

  // Connecté, c'est la langue du compte qui s'applique : on la change.
  for (const [account, path] of [
    [ACCOUNTS.barber, "/pro/dashboard"],
    [ACCOUNTS.admin, "/admin"],
  ] as const) {
    await loginByApi(page, account);
    await page.goto(path);
    await page.getByRole("combobox", { name: "Langue" }).first().selectOption("en");
    if (account === ACCOUNTS.barber) {
      await expect(
        page.getByRole("heading", { level: 1, name: "Professional area" }),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Audit log" })).toBeVisible();
    }
    // Remise en français du compte démo pour les autres tests.
    await page.getByRole("combobox", { name: "Language" }).first().selectOption("fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  }
});
