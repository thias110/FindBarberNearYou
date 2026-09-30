import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "@findbarber/shared/schema";
import type { Role } from "@findbarber/shared/types";
import { env } from "../config/env.js";
import { AUTH_COOKIE } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";

export interface AuthPayload extends jwt.JwtPayload {
  sub: string;
  csrf: string;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
    }

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as unknown as AuthPayload;
    } catch {
      throw new AppError(401, "UNAUTHORIZED", "Invalid or expired session.");
    }

    if (!payload.sub || !payload.csrf) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid session.");
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Account not found.");
    }
    if (user.status === "SUSPENDED") {
      throw new AppError(403, "ACCOUNT_SUSPENDED", "Account suspended.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
    };
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "Insufficient permissions."));
    }
    next();
  };
