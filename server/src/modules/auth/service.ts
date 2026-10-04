import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, type User } from "@findbarber/shared/schema";
import type { PublicUser, Role } from "@findbarber/shared/types";
import { env } from "../../config/env.js";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import { publicUploadPath } from "../../lib/storage.js";

const BCRYPT_COST = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Mapper public partagé (auth + module user). L'avatar est exposé sous forme
// d'URL publique relative (`/uploads/...`), jamais comme chemin disque.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
    avatarPath: user.avatarPath ? publicUploadPath(user.avatarPath) : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  role: Role;
  name?: string;
}): Promise<PublicUser> {
  const email = normalizeEmail(input.email);

  if (input.role === "ADMIN") {
    throw new AppError(
      403,
      "ADMIN_REGISTRATION_FORBIDDEN",
      "Admin accounts cannot be created through public registration.",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        passwordHash,
        role: input.role,
        name: input.name?.trim() || null,
      })
      .returning();
    return toPublicUser(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "EMAIL_TAKEN", "This email is already registered.");
    }
    throw err;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: PublicUser; token: string; csrfToken: string }> {
  const email = normalizeEmail(input.email);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account has been suspended.");
  }

  const csrfToken = randomBytes(32).toString("hex");
  const token = jwt.sign(
    { sub: user.id, csrf: csrfToken },
    env.JWT_SECRET,
    // Durée du JWT, en secondes
    { expiresIn: env.JWT_EXPIRES_IN_SECONDS },
  );

  return { user: toPublicUser(user), token, csrfToken };
}
