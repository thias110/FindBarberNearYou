import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  emailVerificationTokens,
  users,
  type User,
} from "@findbarber/shared/schema";
import type { PublicUser, Role } from "@findbarber/shared/types";
import { env } from "../../config/env.js";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import { sendVerificationEmail } from "../../lib/email.js";
import { publicUploadPath } from "../../lib/storage.js";

const BCRYPT_COST = 12;
const EMAIL_TOKEN_BYTES = 32;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Jeton de vérification : 256 bits d'entropie, encodé en hexadécimal.
export function generateEmailToken(): string {
  return randomBytes(EMAIL_TOKEN_BYTES).toString("hex");
}

// Le jeton brut n'est jamais stocké : seule son empreinte SHA-256 l'est.
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

    // Compte créé NON vérifié : émission immédiate du lien de vérification.
    const token = await issueEmailVerificationToken(user.id);
    await sendVerificationEmail({ to: user.email, token });

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

  if (user.emailVerifiedAt === null) {
    throw new AppError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email address before logging in.",
    );
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

// Crée et stocke un jeton de vérification (empreinte SHA-256 uniquement).
// Renvoie le jeton brut, destiné exclusivement à l'email de vérification.
export async function issueEmailVerificationToken(
  userId: string,
): Promise<string> {
  const token = generateEmailToken();
  await db.insert(emailVerificationTokens).values({
    id: randomUUID(),
    userId,
    tokenHash: hashEmailToken(token),
    expiresAt: new Date(
      Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000,
    ),
  });
  return token;
}

// Consomme un jeton valide et marque le compte vérifié. Usage unique + expiry
// garantis atomiquement par l'UPDATE ... WHERE. Aucune session n'est créée.
export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashEmailToken(token);
  const now = new Date();

  const [consumed] = await db
    .update(emailVerificationTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.consumedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .returning({ userId: emailVerificationTokens.userId });

  if (!consumed) {
    // Réponse uniforme : expiré / déjà utilisé / inconnu ne sont pas distingués.
    throw new AppError(
      400,
      "INVALID_VERIFICATION_TOKEN",
      "Invalid or expired verification link.",
    );
  }

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: now })
    .where(eq(users.id, consumed.userId))
    .returning({ id: users.id });

  if (!user) {
    throw new AppError(
      400,
      "INVALID_VERIFICATION_TOKEN",
      "Invalid or expired verification link.",
    );
  }
}

// Renvoi d'email de vérification. Réponse générique anti-énumération : on ne
// révèle jamais si l'email existe. Le cooldown par compte est silencieux
// (aucun email, réponse identique) ; le bucket IP (express-rate-limit) reste
// le seul signal 429 observable.
export async function resendVerification(email: string): Promise<void> {
  const normalized = normalizeEmail(email);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!user || user.emailVerifiedAt !== null) {
    return;
  }

  const [last] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, user.id))
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(1);

  const cooldownMs = env.EMAIL_RESEND_COOLDOWN_SECONDS * 1000;
  if (last && Date.now() - last.createdAt.getTime() < cooldownMs) {
    return;
  }

  const token = await issueEmailVerificationToken(user.id);
  await sendVerificationEmail({ to: user.email, token });
}
