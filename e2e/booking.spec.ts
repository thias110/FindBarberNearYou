// Parcours de réservation complet (issues #17 et #18) : le CLIENT réserve au
// clavier seul, le BARBER confirme, le CLIENT voit le rendez-vous confirmé.
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, API, DEMO_PASSWORD, loginByApi, tabTo } from "./helpers";

/** Premier jour (J+1 à J+21) où Karim a des créneaux en salon. */
async function findBookableDate(page: Page, barberId: string, serviceId: string) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const res = await page.request.get(
      `${API}/api/barbers/${barberId}/slots?serviceId=${serviceId}&date=${date}&place=SALON`,
    );
    if (res.ok() && (await res.json()).slots.length > 0) return date;
  }
  throw new Error("Aucune date réservable trouvée.");
}

test("réserver au clavier, puis confirmation par le barber", async ({ page, browser }) => {
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

  const services = await (await page.request.get(`${API}/api/barbers/${barberId}`)).json();
  const service = services.services[0];
  const date = await findBookableDate(page, barberId, service.id);

  // Formulaire : uniquement le clavier.
  const serviceSelect = page.getByRole("combobox", { name: "Service" });
  await tabTo(page, serviceSelect);
  await serviceSelect.press("ArrowDown");
  await expect(serviceSelect).toHaveValue(service.id);

  const placeSelect = page.getByRole("combobox", { name: "Lieu" });
  await tabTo(page, placeSelect);
  await placeSelect.press("ArrowDown");
  await expect(placeSelect).not.toHaveValue("");

  // Le champ date est un widget natif : on vérifie qu'il est atteignable au
  // clavier, puis on fixe la valeur (la saisie clavier segmentée du sélecteur
  // natif n'est pas fiable en Chromium headless ; elle relève du navigateur).
  const dateInput = page.getByLabel("Date");
  await tabTo(page, dateInput);
  await dateInput.fill(date);
  await expect(dateInput).toHaveValue(date);

  const firstSlot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
  const slotLabel = (await firstSlot.textContent())!.trim();
  const slot = page.getByRole("button", { name: slotLabel, exact: true });
  await tabTo(page, slot);
  await page.keyboard.press("Space");
  await expect(slot).toHaveAttribute("aria-pressed", "true");

  await tabTo(page, page.getByRole("button", { name: "Réserver" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Réservation envoyée.")).toBeVisible();

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
  await expect(page.getByText("En attente de confirmation", { exact: true })).toHaveCount(0);
});
