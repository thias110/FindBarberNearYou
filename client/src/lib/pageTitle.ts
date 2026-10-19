import i18n from "../i18n";

// Titre de document par route (WCAG 2.4.2), dans la langue courante (issue
// #32). Les pages d'authentification posent leur propre titre ; null = ne rien
// changer.
const SUFFIX = " — FindBarber";

// Route → clé `common:pageTitle.*`.
const EXACT: Record<string, string> = {
  "/": "home",
  "/barbers": "barbers",
  "/appointments": "appointments",
  "/account": "account",
  "/settings": "settings",
  "/mentions-legales": "legal",
  "/aide": "faq",
  "/pro/dashboard": "proDashboard",
  "/pro/profile": "proProfile",
  "/pro/services": "proServices",
  "/pro/working-hours": "proWorkingHours",
  "/pro/time-off": "proTimeOff",
  "/pro/bookings": "proBookings",
  "/pro/stats": "proStats",
  "/pro/gallery": "proGallery",
  "/pro/payments": "proPayments",
  "/admin": "admin",
  "/admin/users": "adminUsers",
  "/admin/bookings": "adminBookings",
  "/admin/reviews": "adminReviews",
  "/admin/audit": "adminAudit",
};

// Routes servies par AuthLayout (qui porte son propre header et son <main>) :
// le header global n'y est pas rendu.
export const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/resend-verification",
  "/forgot-password",
  "/reset-password",
]);

function titled(key: string): string {
  return i18n.t(`common:pageTitle.${key}`) + SUFFIX;
}

export function pageTitle(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (AUTH_ROUTES.has(path)) return null;
  const exact = EXACT[path];
  if (exact) return titled(exact);
  if (/^\/barbers\/[^/]+$/.test(path)) return titled("barberProfile");
  if (/^\/admin\/barbers\/[^/]+\/stats$/.test(path)) {
    return titled("adminBarberStats");
  }
  // Route inconnue : NotFoundPage.
  return titled("notFound");
}
