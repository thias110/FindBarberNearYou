export const ROLES = ["CLIENT", "BARBER", "ADMIN"] as const;

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export const ROLE_HOME = {
  CLIENT: "/",
  BARBER: "/pro/dashboard",
  ADMIN: "/admin",
} as const;
