// Parcours visiteur (issue #17) : accueil public, recherche, inscription au
// clavier seul (issue #18).
import { expect, test } from "@playwright/test";
import { tabTo } from "./helpers";

test("l'accueil est public et propose inscription et espace barber", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Accueil — FindBarber");
  await expect(
    page.getByRole("heading", { name: "Trouvez votre barber, au bon moment." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Créer un compte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Se connecter" }).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Proposer mes services" }).click();
  await expect(page).toHaveURL(/\/register\?role=BARBER$/);
  await expect(
    page.getByRole("radio", { name: "Je suis barber" }),
  ).toBeChecked();
});

test("recherche par ville depuis l'accueil, au clavier", async ({ page }) => {
  await page.goto("/");
  // Premier arrêt : le lien d'évitement.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();

  const city = page.getByRole("textbox", { name: "Ville" });
  await tabTo(page, city);
  await page.keyboard.type("Genève");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/barbers\?city=Gen%C3%A8ve/);
  await expect(page.getByText("Karim — Barber Plainpalais")).toBeVisible();
});

test("inscription au clavier seul jusqu'à « Vérifiez votre email »", async ({
  page,
}) => {
  await page.goto("/register");
  const email = `e2e-${Date.now()}@example.com`;

  await tabTo(page, page.getByRole("textbox", { name: "Nom" }));
  await page.keyboard.type("Client Clavier");
  await tabTo(page, page.getByRole("textbox", { name: "Email" }));
  await page.keyboard.type(email);
  await tabTo(page, page.getByLabel("Mot de passe", { exact: true }));
  await page.keyboard.type("MotDePasse123!");
  await tabTo(
    page,
    page.getByRole("button", {
      name: /Créer mon compte|S'inscrire|Créer un compte/,
    }),
  );
  await page.keyboard.press("Enter");

  await expect(page.getByText("Vérifiez votre adresse email.")).toBeVisible();
});

test("mot de passe oublié depuis la connexion, au clavier, réponse neutre", async ({
  page,
}) => {
  await page.goto("/login");
  await tabTo(page, page.getByRole("link", { name: "Mot de passe oublié ?" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page).toHaveTitle("Mot de passe oublié — FindBarber");

  await tabTo(page, page.getByRole("textbox", { name: "Email" }));
  await page.keyboard.type("inconnu@example.com");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "Si un compte existe avec cette adresse, un lien de réinitialisation",
    ),
  ).toBeVisible();
});

test("lien de réinitialisation invalide : message clair", async ({ page }) => {
  await page.goto(`/reset-password?token=${"0".repeat(64)}`);
  await page.getByLabel("Nouveau mot de passe").fill("NouveauMotDePasse1!");
  await page
    .getByLabel("Confirmer le mot de passe")
    .fill("NouveauMotDePasse1!");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(
    page.getByText("Ce lien de réinitialisation est invalide ou a expiré."),
  ).toBeVisible();
});
