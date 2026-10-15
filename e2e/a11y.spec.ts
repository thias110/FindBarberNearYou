// Audit d'accessibilité automatisé (issue #18) : axe-core sur les pages
// principales de chaque rôle, en thème clair et sombre.
import { test } from "@playwright/test";
import { ACCOUNTS, expectNoA11yViolations, loginByApi } from "./helpers";

const PAGES: { role: keyof typeof ACCOUNTS | "visiteur"; paths: string[] }[] = [
  {
    role: "visiteur",
    paths: [
      "/",
      "/barbers",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password?token=e2e",
    ],
  },
  { role: "client", paths: ["/", "/barbers", "/appointments", "/account"] },
  {
    role: "barber",
    paths: [
      "/pro/dashboard",
      "/pro/profile",
      "/pro/services",
      "/pro/working-hours",
      "/pro/time-off",
      "/pro/bookings",
      "/pro/stats",
      "/pro/gallery",
      "/pro/payments",
      "/account",
    ],
  },
  {
    role: "admin",
    paths: [
      "/admin",
      "/admin/users",
      "/admin/bookings",
      "/admin/reviews",
      "/admin/audit",
    ],
  },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe WCAG AA, thème ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const { role, paths } of PAGES) {
      test(`pages ${role}`, async ({ page }) => {
        if (role !== "visiteur") await loginByApi(page, ACCOUNTS[role]);
        for (const path of paths) {
          await test.step(path, async () => {
            await page.goto(path);
            await page.waitForLoadState("networkidle");
            await expectNoA11yViolations(page);
          });
        }
      });
    }

    test("fiche barber publique", async ({ page }) => {
      await page.goto("/barbers");
      await page.getByRole("link", { name: "Voir le profil" }).first().click();
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page);
    });
  });
}
