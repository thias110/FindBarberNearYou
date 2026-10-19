// Parcours de réservation complet (issues #17 et #18) : le CLIENT réserve au
// clavier seul, le BARBER confirme, le CLIENT voit le rendez-vous confirmé.
import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  API,
  DEMO_PASSWORD,
  expectNoA11yViolations,
  loginByApi,
  tabTo,
} from "./helpers";

/** Premier jour (J+1 à J+21) où Karim a des créneaux en salon. */
async function findBookableDate(
  page: Page,
  barberId: string,
  serviceId: string,
) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await page.request.get(
      `${API}/api/barbers/${barberId}/slots?serviceId=${serviceId}&date=${date}&place=SALON`,
    );
    if (res.ok() && (await res.json()).slots.length > 0) return date;
  }
  throw new Error("Aucune date réservable trouvée.");
}

test("réserver au clavier, puis confirmation par le barber", async ({
  page,
  browser,
}) => {
  // Connexion au clavier.
  await page.goto("/login");
  await tabTo(page, page.getByRole("textbox", { name: "Email" }));
  await page.keyboard.type(ACCOUNTS.client);
  await tabTo(page, page.getByLabel("Mot de passe", { exact: true }));
  await page.keyboard.type(DEMO_PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);

  // Recherche puis fiche du barber.
  await page.goto("/barbers?city=Gen%C3%A8ve");
  const profileLink = page
    .getByRole("article")
    .filter({ hasText: "Karim — Barber Plainpalais" })
    .getByRole("link", { name: "Voir le profil" })
    .or(page.getByRole("link", { name: "Voir le profil" }).first())
    .first();
  await tabTo(page, profileLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/barbers\/[^/]+$/);
  const barberId = page.url().split("/").pop()!;

  const services = await (
    await page.request.get(`${API}/api/barbers/${barberId}`)
  ).json();
  const service = services.services[0];
  // Garde-fou : la démo doit offrir au moins un jour réservable en salon.
  await findBookableDate(page, barberId, service.id);

  // Étape 1 — prestation et lieu, uniquement au clavier.
  const serviceSelect = page.getByRole("combobox", { name: "Prestation" });
  await tabTo(page, serviceSelect);
  await serviceSelect.press("ArrowDown");
  await expect(serviceSelect).toHaveValue(service.id);

  const places = page.getByRole("radiogroup", { name: "Lieu" });
  const salon = places.getByRole("radio", { name: "En salon" });
  await tabTo(page, places.getByRole("radio").first());
  for (let i = 0; i < 3; i += 1) {
    if ((await salon.getAttribute("aria-checked")) === "true") break;
    await page.keyboard.press("ArrowRight");
  }
  await expect(salon).toHaveAttribute("aria-checked", "true");

  const next = page.getByRole("button", { name: "Continuer" });
  await tabTo(page, next);
  await page.keyboard.press("Enter");

  // Étape 2 — grille de la semaine : le titre de l'étape reçoit le focus.
  await expect(page.getByText("Étape 2 sur 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Créneau" })).toBeFocused();
  const grid = page.getByRole("group", { name: "Créneaux de la semaine" });
  const slots = grid.getByRole("button");
  const emptyWeek = page.getByText("Aucun créneau cette semaine");
  for (let week = 0; week < 4; week += 1) {
    await expect(slots.first().or(emptyWeek)).toBeVisible();
    if (await slots.first().isVisible()) break;
    await page.getByRole("button", { name: "Voir la semaine suivante" }).click();
  }
  await expectNoA11yViolations(page);

  const slot = slots.first();
  await tabTo(page, slot);
  await page.keyboard.press("Space");
  await expect(slot).toHaveAttribute("aria-pressed", "true");

  await tabTo(page, next);
  await page.keyboard.press("Enter");

  // Étape 3 — confirmation : récapitulatif puis réservation.
  await expect(page.getByText("Étape 3 sur 3")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeFocused();
  const submit = page.getByRole("button", { name: "Réserver", exact: true });
  await tabTo(page, submit);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Réservation envoyée" }),
  ).toBeVisible();

  // Lot N2 : le rendez-vous s'ajoute au calendrier (fichier .ics).
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ajouter au calendrier" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.ics$/);
  await expect(
    page.getByRole("link", { name: "Voir mes rendez-vous" }),
  ).toBeVisible();

  // Côté barber : confirmation.
  const barberContext = await browser.newContext();
  const barberPage = await barberContext.newPage();
  await loginByApi(barberPage, ACCOUNTS.barber);
  await barberPage.goto("/pro/bookings");
  const confirm = barberPage.getByRole("button", { name: "Confirmer" }).first();
  await tabTo(barberPage, confirm);
  await barberPage.keyboard.press("Enter");
  await expect(confirm).toBeHidden();
  await barberContext.close();

  // Le client voit son rendez-vous.
  // Le client démo n'a aucun historique : la seule carte est la nôtre, et
  // son statut prouve la confirmation par le barber.
  await page.goto("/appointments");
  await expect(page.getByRole("heading", { name: "À venir" })).toBeVisible();
  await expect(page.getByText(service.name).first()).toBeVisible();
  await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
  await expect(
    page.getByText("En attente de confirmation", { exact: true }),
  ).toHaveCount(0);

  // Lot N3 : une fois confirmé, le client obtient l'adresse exacte et
  // l'itinéraire (jamais avant, jamais sur la fiche publique).
  await page.getByRole("button", { name: "Adresse et itinéraire" }).click();
  await expect(page.getByText("Adresse du rendez-vous")).toBeVisible();
  const directions = page.getByRole("link", { name: /^Itinéraire vers / });
  await expect(directions).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
  );
  await expect(directions).toHaveAttribute("target", "_blank");
  await expectNoA11yViolations(page);
});
