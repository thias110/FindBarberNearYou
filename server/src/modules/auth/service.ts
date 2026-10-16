import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  emailVerificationTokens,
  passwordResetTokens,
  users,
  type User,
} from "@findbarber/shared/schema";
import type { PublicUser, Role } from "@findbarber/shared/types";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@findbarber/shared/constants";
import { env } from "../../config/env.js";
import { AppError, isUniqueViolation } from "../../lib/errors.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../lib/email.js";
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
// Valeur garantie par la contrainte `users_locale_valid` ; repli défensif.
export function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name: user.name,
    locale: toLocale(user.locale),
    avatarPath: user.avatarPath ? publicUploadPath(user.avatarPath) : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  role: Role;
  name?: string;
  locale?: Locale;
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

  let created: User;
  try {
    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        passwordHash,
        role: input.role,
        name: input.name?.trim() || null,
        locale: input.locale ?? DEFAULT_LOCALE,
      })
      .returning();

    created = user;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, "EMAIL_TAKEN", "This email is already registered.");
    }
    throw err;
  }

  // Compte créé NON vérifié : émission immédiate du lien de vérification. Un
  // échec d'envoi n'échoue pas l'inscription (lien redemandable).
  const token = await issueEmailVerificationToken(created.id);
  await sendVerificationEmail({
    to: created.email,
    token,
    locale: created.locale,
  });

  return toPublicUser(created);
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

  if (!user || user.status === "DELETED") {
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
  await sendVerificationEmail({ to: user.email, token, locale: user.locale });
}

// --- Mot de passe oublié (issue #9) ---

/**
 * Demande de réinitialisation. Réponse neutre côté route : on ne révèle jamais
 * si l'adresse existe. Rien n'est envoyé pour un compte inconnu ou suspendu,
 * ni pendant le délai de renvoi (silencieux, comme pour la vérification).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!user || user.status !== "ACTIVE") return;

  const [last] = await db
    .select({ createdAt: passwordResetTokens.createdAt })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);
  const cooldownMs = env.EMAIL_RESEND_COOLDOWN_SECONDS * 1000;
  if (last && Date.now() - last.createdAt.getTime() < cooldownMs) return;

  const token = generateEmailToken();
  await db.insert(passwordResetTokens).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashEmailToken(token),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000),
  });
  await sendPasswordResetEmail({ to: user.email, token, locale: user.locale });
}

function invalidResetToken(): AppError {
  return new AppError(
    400,
    "INVALID_RESET_TOKEN",
    "Ce lien de réinitialisation est invalide ou a expiré.",
  );
}

/**
 * Réinitialise le mot de passe avec un jeton valide, en une transaction :
 * consommation atomique du jeton (usage unique + expiration), nouveau hash,
 * `password_changed_at` (révoque toutes les sessions existantes), invalidation
 * des autres jetons du compte. Le lien prouve la possession de l'adresse :
 * un compte non vérifié devient vérifié.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const tokenHash = hashEmailToken(token);

  await db.transaction(async (tx) => {
    const now = new Date();
    const [consumed] = await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed) throw invalidResetToken();

    const [user] = await tx
      .select({ status: users.status, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, consumed.userId))
      .limit(1);
    if (!user || user.status !== "ACTIVE") throw invalidResetToken();

    await tx
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: now,
        emailVerifiedAt: user.emailVerifiedAt ?? now,
        updatedAt: now,
      })
      .where(eq(users.id, consumed.userId));

    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, consumed.userId),
          isNull(passwordResetTokens.consumedAt),
        ),
      );
  });
}
