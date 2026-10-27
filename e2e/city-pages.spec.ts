// Pages ville pour le référencement (lot N9) : HTML produit par l'API et
// atteint par le navigateur (proxy Vite en développement, Nginx en production).
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

test("une page ville est du HTML lisible, accessible, et mène à la fiche d'un barber", async ({
  page,
  request,
}) => {
  // Le contenu est dans le HTML initial (utile aux moteurs de recherche), sans JavaScript.
  const html = await request.get("/barbers/ville/geneve");
  expect(html.status()).toBe(200);
  const body = await html.text();
  expect(body).toContain("<h1>Barbers à Genève</h1>");
  expect(body).toContain('rel="canonical"');
  expect(body).toContain("application/ld+json");

  await page.goto("/barbers/ville/geneve");
  await expect(
    page.getByRole("heading", { name: "Barbers à Genève" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole("link", { name: /Karim — Barber Plainpalais/ }).click();
  await expect(page).toHaveURL(/\/barbers\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Karim — Barber Plainpalais" }),
  ).toBeVisible();
});

test("le plan du site et robots.txt sont servis", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/barbers/ville/geneve");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");
});

test("une ville sans page répond 404", async ({ request }) => {
  const res = await request.get("/barbers/ville/inconnue");
  expect(res.status()).toBe(404);
});
