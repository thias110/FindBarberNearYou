// Parcours visiteur (issue #17) : accueil public, recherche, inscription au
// clavier seul (issue #18).
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, tabTo } from "./helpers";

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

  // Champ Ville avec suggestions (lot N4) : rôle `combobox`. Sans service de
  // géocodage (cas des tests), il reste un champ texte et Entrée soumet.
  const city = page.getByRole("combobox", { name: "Ville" });
  await tabTo(page, city);
  await page.keyboard.type("Genève");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/barbers\?city=Gen%C3%A8ve/);
  await expect(page.getByText("Karim — Barber Plainpalais")).toBeVisible();
});

test("recherche par ville : une suggestion se choisit au clavier", async ({
  page,
}) => {
  // Pas de clé de géocodage en test : la réponse de l'API est simulée.
  await page.route("**/api/places/suggest**", (route) =>
    route.fulfill({
      json: {
        suggestions: [
          { name: "Genève", label: "Genève, Genève, Suisse" },
          { name: "Gex", label: "Gex, Ain, France" },
        ],
      },
    }),
  );
  await page.goto("/");
  const city = page.getByRole("combobox", { name: "Ville" });
  await city.fill("Ge");
  await expect(
    page.getByRole("listbox", { name: "Villes suggérées" }).getByRole("option"),
  ).toHaveCount(2);

  // Deux flèches bas désignent la deuxième suggestion ; Entrée la valide
  // sans soumettre le formulaire.
  await city.press("ArrowDown");
  await city.press("ArrowDown");
  await city.press("Enter");
  await expect(city).toHaveValue("Gex");
  await expect(page).toHaveURL(/\/$/);

  // Liste fermée : Entrée soumet la recherche.
  await city.press("Enter");
  await expect(page).toHaveURL(/\/barbers\?city=Gex/);
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

test("filtres prix, note et distance appliqués en un geste (issue #52)", async ({
  page,
}) => {
  await page.goto("/barbers");
  await expect(page.getByText("Karim — Barber Plainpalais")).toBeVisible();

  await page.getByRole("button", { name: "≤ 50 CHF" }).click();
  await expect(page).toHaveURL(/maxPrice=50/);
  await expect(page).toHaveURL(/currency=CHF/);
  await expect(page.getByRole("button", { name: "≤ 50 CHF" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Note de 4 sur 5 et plus" }).click();
  await expect(page).toHaveURL(/minRating=4/);

  // Position refusée (aucune permission accordée) : le filtre distance est
  // désactivé, avec une explication.
  await page.getByRole("button", { name: "5 km", exact: true }).click();
  await expect(page.getByText(/Filtre désactivé/)).toBeVisible();
  await expect(page.getByRole("button", { name: "10 km" })).toBeDisabled();

  await page.getByRole("button", { name: "Réinitialiser" }).click();
  await expect(page).toHaveURL(/\/barbers$/);
});

test("filtre distance avec une position partagée (issue #52)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 46.2, longitude: 6.14 });
  await page.goto("/barbers");
  await page.getByRole("button", { name: "25 km" }).click();
  await expect(page).toHaveURL(/radiusKm=25/);
  // La position n'apparaît jamais dans l'URL.
  expect(page.url()).not.toMatch(/46\.2|6\.14|lat|lng/i);
  await expect(page.getByText(/résultat\(s\) à moins de 25 km/)).toBeVisible();
});

test("carte plein écran : liste repliable sur ordinateur (issue #49)", async ({
  page,
}) => {
  await page.goto("/barbers");
  const results = page.getByRole("region", { name: "Résultats de la recherche" });
  await expect(results.getByText("Karim — Barber Plainpalais")).toBeVisible();
  await page.getByRole("button", { name: "Masquer la liste" }).click();
  await expect(results).toHaveCount(0);
  await page.getByRole("button", { name: "Afficher la liste" }).click();
  await expect(results.getByText("Karim — Barber Plainpalais")).toBeVisible();
});

test("carte plein écran : liste en panneau depuis le bas sur mobile, au clavier (issue #49)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/barbers");
  const toggle = page.getByRole("button", { name: /Afficher la liste/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Karim — Barber Plainpalais")).toBeHidden();

  // La liste est atteinte au clavier sans passer par la carte.
  await tabTo(page, toggle);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /Masquer la liste/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Karim — Barber Plainpalais")).toBeVisible();
});

test("fiche barber sur la carte : note, prix et « Réserver » (issue #53)", async ({
  page,
}) => {
  await page.goto("/barbers");
  // Sélection depuis la liste (même fiche qu'au clic sur le marqueur).
  await page
    .getByRole("button", { name: "Afficher Marco — Atelier Eaux-Vives sur la carte" })
    .click();
  const card = page.getByRole("region", { name: "Fiche de Marco — Atelier Eaux-Vives" });
  await expect(card).toBeVisible();
  // Sans avis : mention explicite, jamais de note inventée.
  await expect(card.getByText("Nouveau sur FindBarber")).toBeVisible();
  await expect(card.getByText(/À partir de/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  await page
    .getByRole("button", { name: "Afficher Karim — Barber Plainpalais sur la carte" })
    .click();
  const karim = page.getByRole("region", { name: "Fiche de Karim — Barber Plainpalais" });
  await expect(karim.getByText(/\(\d+ avis\)/)).toBeVisible();
  await karim.getByRole("link", { name: "Réserver" }).click();
  await expect(page).toHaveURL(/\/barbers\/[^/]+#reserver$/);
  await expect(page.locator("#reserver")).toBeFocused();
});

test("cartes « Barbers à découvrir » de l'accueil (issue #54)", async ({
  page,
}) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "Barbers à découvrir" });
  const card = list
    .getByRole("listitem")
    .filter({ hasText: "Karim — Barber Plainpalais" });
  const profileLink = card.getByRole("link", { name: "Karim — Barber Plainpalais" });
  await expect(profileLink).toBeVisible();
  await expect(card.getByText(/\(\d+ avis\)/)).toBeVisible();
  await expect(card.getByText(/À partir de/)).toBeVisible();
  // « Réserver » mène directement au formulaire, focalisable à part.
  await expect(card.getByRole("link", { name: "Réserver" })).toHaveAttribute(
    "href",
    /#reserver$/,
  );
  // Ni nombre de services ni pays ; pas de distance sans position partagée.
  await expect(list.getByText(/services? actifs?/)).toHaveCount(0);
  await expect(list.getByText(/Suisse/)).toHaveCount(0);
  await expect(list.getByText(/\d km/)).toHaveCount(0);

  // Toute la carte mène au profil (lien étendu), atteignable au clavier.
  await tabTo(page, profileLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/barbers\/[^/#]+$/);
});

test("distance sur les cartes de l'accueil si la position est partagée (issue #54)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 46.21, longitude: 6.15 });
  await page.goto("/");
  const list = page.getByRole("list", { name: "Barbers à découvrir" });
  await expect(list.getByText(/Genève · .*km/).first()).toBeVisible();
});

test("horaires publics sur la fiche barber, jour courant mis en avant (lot N3)", async ({
  page,
}) => {
  await page.goto("/barbers");
  await page.getByRole("link", { name: "Voir le profil" }).first().click();
  const hours = page.getByRole("region", { name: "Horaires" });
  await expect(hours).toBeVisible();
  // Sept jours, du lundi au dimanche ; un jour sans plage affiche « Fermé ».
  for (const day of ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]) {
    // Le jour courant porte aussi le badge « Aujourd'hui » dans son libellé.
    await expect(hours.locator("dt").filter({ hasText: day })).toHaveCount(1);
  }
  await expect(hours.getByText("Fermé").first()).toBeVisible();
  // Le jour courant du salon est signalé (fuseau du profil de démo).
  await expect(hours.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(hours.getByText("Aujourd'hui")).toBeVisible();
  await expectNoA11yViolations(page);
});

test("prochain créneau libre sur les cartes de résultat (lot N1)", async ({ page }) => {
  await page.goto("/barbers");
  // Les barbers de démo ont des horaires et un fuseau : un créneau existe
  // dans les 7 jours, affiché en clair sur leur carte.
  await expect(page.getByText(/^Prochain créneau : /).first()).toBeVisible();
  await expectNoA11yViolations(page);
});
