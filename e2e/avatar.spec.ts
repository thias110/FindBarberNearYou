// Photo de profil du client (issue #55) : envoi depuis Mon compte, refus d'un
// fichier invalide avec message à côté du champ, affichage sur l'accueil puis
// suppression (retour à l'initiale). Avatar cliquable de l'accueil (issue #60).
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

// PNG 1 × 1 valide.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("un client ajoute, voit puis supprime sa photo de profil", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Photo de profil" }),
  ).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  const message = page.locator("#avatar-message");

  // Fichier qui n'est pas une image : refusé, message à côté du champ.
  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("pas une image"),
  });
  await expect(message).toHaveText("Format accepté : JPEG, PNG ou WebP.");

  // Image trop lourde : refusée avant tout envoi.
  await fileInput.setInputFiles({
    name: "lourde.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1_048_576),
  });
  await expect(message).toContainText("Image trop volumineuse");

  // Image valide : elle devient la photo de profil.
  await fileInput.setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(message).toHaveText("Photo de profil mise à jour.");
  await expect(page.getByAltText("Votre photo de profil")).toBeVisible();
  await expectNoA11yViolations(page);

  // L'accueil affiche la photo à la place de l'initiale ; elle mène à Mon
  // compte.
  await page.goto("/");
  const avatarLink = page.getByRole("link", { name: "Votre compte" });
  await expect(
    avatarLink.locator('img[src*="/uploads/avatars/"]'),
  ).toHaveCount(1);
  await avatarLink.click();
  await expect(page).toHaveURL(/\/account$/);

  // Suppression avec confirmation : l'initiale réapparaît.
  await page.getByRole("button", { name: "Supprimer la photo" }).click();
  await page.getByRole("button", { name: "Confirmer la suppression" }).click();
  await expect(message).toHaveText("Photo de profil supprimée.");
  await expect(page.getByAltText("Votre photo de profil")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator('main img[src*="/uploads/avatars/"]')).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Votre compte" })).toHaveText("C");
});

test("l'initiale de l'accueil mène à Mon compte, au clavier", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/");
  const avatarLink = page.getByRole("link", { name: "Votre compte" });
  await avatarLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/account$/);
});
