import type { ROLES, USER_STATUSES } from "./constants";

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  name: string | null;
  createdAt: string;
}
