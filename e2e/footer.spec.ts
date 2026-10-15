// Footer (issue #59) et contact support (issue #58) : seuls les liens
// configurés apparaissent, aucun lien vide ni « # ».
import { expect, test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

test("footer : contact, mentions légales et réseaux configurés seulement", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "mailto:support@demo.ch",
  );
  await expect(footer.getByRole("link", { name: "Mentions légales" })).toBeVisible();
  await expect(footer.getByRole("link", { name: /Instagram/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/findbarber.demo",
  );
  for (const network of ["Facebook", "TikTok", "LinkedIn"]) {
    await expect(footer.getByRole("link", { name: new RegExp(network) })).toHaveCount(0);
  }
  const hrefs = await footer
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  for (const href of hrefs) {
    expect(href.trim()).not.toBe("");
    expect(href).not.toBe("#");
  }
});

test("mentions légales : éditeur configuré, contact, accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mentions légales" })).toBeVisible();
  await expect(page.getByText("FindBarber Démo")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "support@demo.ch" })).toBeVisible();
  await expectNoA11yViolations(page);
});

test("le footer est aussi présent une fois connecté", async ({ page }) => {
  await loginByApi(page, ACCOUNTS.barber);
  await page.goto("/pro/dashboard");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" })).toBeVisible();
});
