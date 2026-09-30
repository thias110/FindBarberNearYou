import type { Role, UserStatus } from "@findbarber/shared/types";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        status: UserStatus;
        name: string | null;
      };
      auth?: {
        sub: string;
        csrf: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

export {};
