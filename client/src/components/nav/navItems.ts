import type { ROLES } from "@findbarber/shared/constants";
import type { NavIconName } from "./NavIcon";

// Entrées de navigation des espaces connectés (plan §2.6.6). Une seule source
// pour la barre latérale (desktop) et la barre d'onglets (mobile). Uniquement
// des routes existantes du routeur.

export interface NavItem {
  to: string;
  icon: NavIconName;
  /** Clé i18n (`ns:clé`). */
  label: string;
  /** Actif seulement sur la route exacte (ex. « / »). */
  end?: boolean;
}

export type AppRole = Exclude<(typeof ROLES)[number], "ADMIN">;

// Barre latérale : toutes les sections de l'espace. Les libellés des sections
// pro sont ceux des cartes du tableau de bord (mêmes noms partout).
export const SIDEBAR_ITEMS: Record<AppRole, NavItem[]> = {
  CLIENT: [
    { to: "/", icon: "home", label: "common:nav.home", end: true },
    { to: "/barbers", icon: "search", label: "common:nav.search" },
    { to: "/appointments", icon: "calendar", label: "common:nav.appointments" },
    { to: "/account", icon: "user", label: "common:nav.account" },
  ],
  BARBER: [
    { to: "/pro/dashboard", icon: "today", label: "common:nav.today" },
    { to: "/pro/bookings", icon: "calendar", label: "barber:dashboard.nav.bookings.title" },
    { to: "/pro/working-hours", icon: "clock", label: "barber:dashboard.nav.workingHours.title" },
    { to: "/pro/time-off", icon: "pause", label: "barber:dashboard.nav.timeOff.title" },
    { to: "/pro/services", icon: "scissors", label: "barber:dashboard.nav.services.title" },
    { to: "/pro/profile", icon: "store", label: "barber:dashboard.nav.profile.title" },
    { to: "/pro/gallery", icon: "image", label: "barber:dashboard.nav.gallery.title" },
    { to: "/pro/payments", icon: "card", label: "barber:dashboard.nav.payments.title" },
    { to: "/pro/stats", icon: "chart", label: "barber:dashboard.nav.stats.title" },
    { to: "/account", icon: "user", label: "common:nav.account" },
  ],
};

// Barre d'onglets mobile : 4 onglets client, 5 onglets barber.
export const TAB_ITEMS: Record<AppRole, NavItem[]> = {
  CLIENT: [
    { to: "/", icon: "home", label: "common:nav.home", end: true },
    { to: "/barbers", icon: "search", label: "common:nav.search" },
    { to: "/appointments", icon: "calendar", label: "common:nav.appointments" },
    { to: "/account", icon: "user", label: "common:nav.accountShort" },
  ],
  BARBER: [
    { to: "/pro/dashboard", icon: "today", label: "common:nav.today" },
    { to: "/pro/bookings", icon: "calendar", label: "common:nav.bookings" },
    { to: "/pro/working-hours", icon: "clock", label: "common:nav.agenda" },
    { to: "/pro/profile", icon: "store", label: "common:nav.showcase" },
    { to: "/account", icon: "user", label: "common:nav.accountShort" },
  ],
};
