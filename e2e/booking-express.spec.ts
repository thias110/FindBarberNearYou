// Réservation express (lot N6) : un visiteur sans compte réserve en saisissant
// nom, email et mot de passe à la dernière étape du tunnel, puis doit cliquer
// sur le lien reçu par email (le clic lui-même est couvert par les tests
// d'intégration : l'email n'est pas lisible ici).
import { expect, test } from "@playwright/test";
import { API, expectNoA11yViolations } from "./helpers";

test("un visiteur réserve sans compte et doit confirmer son email", async ({
  page,
}) => {
  const search = await (await page.request.get(`${API}/api/barbers?city=Gen%C3%A8ve`)).json();
  const karim = search.barbers.find((barber: { displayName: string }) =>
    barber.displayName.startsWith("Karim"),
  );
  await page.goto(`/barbers/${karim.id}`);

  // Étape 1 — prestation et lieu.
  const serviceSelect = page.getByRole("combobox", { name: "Prestation" });
  await serviceSelect.selectOption({ index: 1 });
  await page
    .getByRole("radiogroup", { name: "Lieu" })
    .getByRole("radio", { name: "En salon" })
    .click();
  const next = page.getByRole("button", { name: "Continuer" });
  await next.click();

  // Étape 2 — premier créneau libre dans les semaines à venir.
  const grid = page.getByRole("group", { name: "Créneaux de la semaine" });
  const slots = grid.getByRole("button");
  const emptyWeek = page.getByText("Aucun créneau cette semaine");
  for (let week = 0; week < 4; week += 1) {
    await expect(slots.first().or(emptyWeek)).toBeVisible();
    if (await slots.first().isVisible()) break;
    await page.getByRole("button", { name: "Voir la semaine suivante" }).click();
  }
  await slots.first().click();
  await next.click();

  // Étape 3 — le visiteur saisit ses coordonnées (aucun lien « Connectez-vous
  // pour envoyer » : la réservation express le remplace).
  await expect(page.getByText("Étape 3 sur 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vos coordonnées" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Réserver", exact: true });

  // Sans saisie : erreurs sous les champs, rien n'est envoyé.
  await submit.click();
  await expect(page.getByText("Indiquez votre nom.")).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("textbox", { name: "Nom" }).fill("Visiteur E2E");
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`express-${Date.now()}@example.com`);
  await submit.click();

  await expect(page.getByRole("heading", { name: "Vérifiez votre email" })).toBeVisible();
  await expect(page.getByText(/dans les 30 minutes/)).toBeVisible();
  await expect(page.getByRole("link", { name: "renvoyez le lien" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("un email déjà connu demande de se connecter", async ({ page }) => {
  const res = await page.request.post(`${API}/api/bookings/express`, {
    data: {
      barberId: "00000000-0000-0000-0000-000000000000",
      serviceId: "00000000-0000-0000-0000-000000000000",
      date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
      startMinute: 600,
      place: "SALON",
      email: "client@demo.ch",
      name: "Doublon",
    },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
});
