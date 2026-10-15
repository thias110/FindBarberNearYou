// Mon compte (issue #14) : export JSON puis suppression du compte au clavier,
// avec confirmation, sur un compte démo dédié.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  API,
  DELETABLE_CLIENT,
  DEMO_PASSWORD,
  loginByApi,
  tabTo,
} from "./helpers";

test("exporter ses données puis supprimer son compte", async ({ page }) => {
  await loginByApi(page, DELETABLE_CLIENT);
  await page.goto("/");
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page).toHaveTitle("Mon compte — FindBarber");

  // Export : fichier JSON téléchargé, avec le compte et sans secret.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger mes données" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^findbarber-mes-donnees-.*\.json$/,
  );
  const exported = readFileSync((await download.path())!, "utf8");
  expect(JSON.parse(exported).account.email).toBe(DELETABLE_CLIENT);
  expect(exported).not.toContain("passwordHash");

  // Suppression : mot de passe, puis dialogue de confirmation, au clavier.
  await tabTo(page, page.getByLabel("Mot de passe actuel"));
  await page.keyboard.type(DEMO_PASSWORD);
  await tabTo(page, page.getByRole("button", { name: "Supprimer mon compte" }));
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Garder mon compte" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Votre compte a été supprimé")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Se connecter" }).first(),
  ).toBeVisible();

  const relogin = await page.request.post(`${API}/api/auth/login`, {
    data: { email: DELETABLE_CLIENT, password: DEMO_PASSWORD },
  });
  expect(relogin.status()).toBe(401);
});
