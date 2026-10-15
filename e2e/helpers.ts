import { expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const API = "http://localhost:4000";
export const DEMO_PASSWORD = "Demo1234!";
export const ACCOUNTS = {
  admin: "admin@demo.ch",
  barber: "karim.plainpalais@demo.ch",
  client: "client@demo.ch",
} as const;

/** Compte démo réservé au parcours de suppression (non utilisé ailleurs). */
export const DELETABLE_CLIENT = "client2@demo.ch";

/** Connexion par l'API (cookies partagés avec la page : même hôte). */
export async function loginByApi(page: Page, email: string): Promise<void> {
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Avance au clavier (Tab) jusqu'à ce que `target` ait le focus : prouve que
 * l'élément est atteignable sans souris.
 */
export async function tabTo(
  page: Page,
  target: Locator,
  max = 60,
): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Élément non atteignable au clavier en ${max} tabulations.`);
}

/** Audit WCAG 2.0/2.1 A + AA : aucune violation tolérée. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}
