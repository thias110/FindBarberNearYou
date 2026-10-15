// Statistiques barber (issue #46) : rien n'est coupé ni ne déborde aux
// largeurs mobile, tablette et bureau, côté BARBER comme côté ADMIN.
import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, loginByApi } from "./helpers";

const WIDTHS = [375, 768, 1280];

async function expectNothingClipped(page: Page): Promise<void> {
  await expect(page.getByText("Rendez-vous par semaine")).toBeVisible();
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) {
      out.push(`défilement horizontal : ${root.scrollWidth} > ${root.clientWidth}`);
    }
    // Chaque texte (valeur, libellé) doit tenir dans la carte qui le contient.
    for (const el of document.querySelectorAll("main p, main dt, main dd span, main li span")) {
      const card = el.closest(".rounded-lg, [class*='rounded-']");
      if (!card || !(el as HTMLElement).innerText.trim()) continue;
      const box = el.getBoundingClientRect();
      const frame = card.getBoundingClientRect();
      if (box.right > frame.right + 1 || box.left < frame.left - 1) {
        out.push(`débordement : « ${(el as HTMLElement).innerText.trim()} »`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
}

for (const width of WIDTHS) {
  test(`statistiques barber lisibles à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginByApi(page, ACCOUNTS.barber);
    await page.goto("/pro/stats");
    await expectNothingClipped(page);
  });

  test(`statistiques vues par l'admin lisibles à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginByApi(page, ACCOUNTS.admin);
    await page.goto("/admin/users");
    await page.getByRole("link", { name: "Voir les statistiques" }).first().click();
    await expectNothingClipped(page);
  });
}
