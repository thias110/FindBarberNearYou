import type { PublicUser } from "@findbarber/shared/types";

declare global {
  namespace Express {
    interface Request {
      // Forme publique (sans secret) : renvoyée telle quelle par
      // GET /api/auth/me, avatar compris (issue #55).
      user?: PublicUser;
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
