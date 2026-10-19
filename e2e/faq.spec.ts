// FAQ publique (lot N7) : accordéons accessibles, lien depuis le pied de page.
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers";

test("le pied de page mène à la FAQ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Questions fréquentes" }).click();
  await expect(page).toHaveURL(/\/aide$/);
  await expect(page).toHaveTitle("Questions fréquentes — FindBarber");
  await expect(
    page.getByRole("heading", { level: 1, name: "Questions fréquentes" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pour les clients" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pour les barbers" })).toBeVisible();
});

test("un accordéon s'ouvre et se referme, accessible", async ({ page }) => {
  await page.goto("/aide");
  const question = page.getByRole("button", { name: "Comment réserver un rendez-vous ?" });
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("region", { name: "Comment réserver un rendez-vous ?" }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
});

test("la FAQ des barbers s'ouvre au clavier", async ({ page }) => {
  await page.goto("/aide");
  const question = page.getByRole("button", { name: "À quoi sert le badge « Certifié » ?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(question).toHaveAttribute("aria-expanded", "true");
});
