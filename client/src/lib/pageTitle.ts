// Titre de document par route (WCAG 2.4.2). Les pages d'authentification
// posent leur propre titre ; null = ne rien changer.
const SUFFIX = " — FindBarber";

const EXACT: Record<string, string> = {
  "/": "Accueil",
  "/barbers": "Rechercher un barber",
  "/appointments": "Mes rendez-vous",
  "/account": "Mon compte",
  "/settings": "Paramètres",
  "/pro/dashboard": "Espace professionnel",
  "/pro/profile": "Mon profil professionnel",
  "/pro/services": "Mes prestations",
  "/pro/working-hours": "Mes horaires",
  "/pro/time-off": "Mes absences",
  "/pro/bookings": "Mes réservations",
  "/pro/stats": "Mes statistiques",
  "/pro/gallery": "Ma galerie",
  "/pro/payments": "Paiements en ligne",
  "/admin": "Administration",
  "/admin/users": "Utilisateurs — Administration",
  "/admin/bookings": "Réservations — Administration",
  "/admin/reviews": "Avis — Administration",
  "/admin/audit": "Journal d'audit — Administration",
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

export function pageTitle(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (AUTH_ROUTES.has(path)) return null;
  const exact = EXACT[path];
  if (exact) return exact + SUFFIX;
  if (/^\/barbers\/[^/]+$/.test(path)) return "Profil du barber" + SUFFIX;
  if (/^\/admin\/barbers\/[^/]+\/stats$/.test(path)) {
    return "Statistiques du barber — Administration" + SUFFIX;
  }
  return "FindBarber";
}
