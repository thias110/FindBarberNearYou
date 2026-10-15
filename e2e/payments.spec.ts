// Écrans du paiement en ligne (issue #10). Le serveur E2E n'a pas de clés
// Stripe : les réponses de paiement de l'API sont simulées (page.route) pour
// vérifier les parcours et l'accessibilité des écrans.
import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  API,
  expectNoA11yViolations,
  loginByApi,
  tabTo,
} from "./helpers";

const SETTINGS = {
  available: true,
  connected: false,
  chargesEnabled: false,
  paymentMode: "NONE",
  depositPercent: 20,
  platformFeePercent: 5,
};

async function mockPaymentSettings(page: Page, initial: typeof SETTINGS) {
  let current = { ...initial };
  await page.route(`${API}/api/barber/payments`, async (route) => {
    if (route.request().method() === "PUT") {
      current = { ...current, ...route.request().postDataJSON() };
    }
    await route.fulfill({ json: { settings: current } });
  });
  await page.route(`${API}/api/barber/payments/onboarding`, (route) =>
    route.fulfill({
      json: { url: "http://localhost:5173/pro/payments?stripe=return" },
    }),
  );
  return {
    activate() {
      current = { ...current, connected: true, chargesEnabled: true };
    },
  };
}

test("barber : activer Stripe puis exiger un acompte", async ({ page }) => {
  await loginByApi(page, ACCOUNTS.barber);
  const stripe = await mockPaymentSettings(page, SETTINGS);
  await page.goto("/pro/dashboard");
  await page.getByRole("link", { name: /Paiements en ligne/ }).click();
  await expect(page).toHaveTitle("Paiements en ligne — FindBarber");
  await expect(page.getByText("Non configuré")).toBeVisible();
  await expect(page.getByText("commission de 5 %")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Mode de paiement" }),
  ).toBeDisabled();
  await expectNoA11yViolations(page);

  stripe.activate();
  await page
    .getByRole("button", { name: "Activer les paiements avec Stripe" })
    .click();
  await expect(page).toHaveURL(/stripe=return/);
  await expect(page.getByText("Paiements activés")).toBeVisible();

  const mode = page.getByRole("combobox", { name: "Mode de paiement" });
  await tabTo(page, mode);
  await mode.selectOption("DEPOSIT");
  await page.getByLabel("Acompte (% du prix)").fill("5");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByText("Indiquez un pourcentage entier entre 10 et 90."),
  ).toBeVisible();
  await page.getByLabel("Acompte (% du prix)").fill("30");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByText("Préférences de paiement enregistrées."),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});

test("client : acompte annoncé, redirection vers le paiement, retour confirmé", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  await page.goto("/barbers");
  await page.getByRole("link", { name: "Voir le profil" }).first().click();
  const barberId = page.url().split("/").pop()!;

  // Profil : ce barber exige un acompte de 30 %.
  await page.route(`${API}/api/barbers/${barberId}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.profile.onlinePayment = { mode: "DEPOSIT", depositPercent: 30 };
    await route.fulfill({ response, json: body });
  });
  // Création : le serveur renvoie une URL Checkout (ici, le retour de succès).
  await page.route(`${API}/api/bookings`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 201,
      json: {
        booking: { id: "b1" },
        checkoutUrl:
          "http://localhost:5173/appointments?payment=success&booking=b1",
      },
    });
  });
  await page.reload();

  const service = page.getByRole("combobox", { name: "Service" });
  await service.selectOption({ index: 1 });
  await expect(
    page.getByText(/Acompte de .* payé en ligne, le reste sur place/),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Lieu" }).selectOption({ index: 1 });
  const dates = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.now() + (i + 1) * 86_400_000).toISOString().slice(0, 10),
  );
  for (const date of dates) {
    await page.getByLabel("Date").fill(date);
    const slot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    if (await slot.isVisible({ timeout: 2000 }).catch(() => false)) {
      await slot.click();
      break;
    }
  }
  await page.getByRole("button", { name: "Réserver et payer" }).click();

  await expect(page).toHaveURL(/\/appointments\?payment=success/);
  await expect(
    page.getByText("Paiement reçu. Votre demande a été envoyée"),
  ).toBeVisible();
});

test("client : demande en attente de paiement, bouton « Payer maintenant »", async ({
  page,
}) => {
  await loginByApi(page, ACCOUNTS.client);
  const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
  await page.route(`${API}/api/bookings`, (route) =>
    route.fulfill({
      json: {
        bookings: [
          {
            id: "pay-1",
            barberId: "x",
            serviceId: "s",
            barberDisplayName: "Karim — Barber Plainpalais",
            serviceName: "Dégradé",
            serviceDescription: null,
            durationMinutes: 30,
            priceMinor: 3500,
            currency: "CHF",
            servicePlace: "SALON",
            status: "PENDING",
            startAt: start,
            endAt: start,
            clientName: "Client",
            hasReview: false,
            cancelledBy: null,
            cancelledAt: null,
            declinedAt: null,
            declineReason: null,
            expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            paymentStatus: "REQUIRES_PAYMENT",
            amountDueMinor: 1050,
            checkoutUrl: "https://checkout.stripe.test/pay-1",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.goto("/appointments?payment=cancelled");
  await expect(page.getByText("Paiement non effectué.")).toBeVisible();
  await expect(
    page.getByText(/Paiement en attente · 10\.50\s?CHF \(acompte\)/),
  ).toBeVisible();
  const pay = page.getByRole("link", { name: "Payer maintenant" });
  await expect(pay).toHaveAttribute(
    "href",
    "https://checkout.stripe.test/pay-1",
  );
  await expectNoA11yViolations(page);
});
