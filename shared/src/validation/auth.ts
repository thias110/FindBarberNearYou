import { z } from "zod";
import { safeText } from "./safeText";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt only considers the first 72 bytes

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address.")
  .max(254, "Email is too long.");

const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  )
  .max(128, "Password is too long.")
  .refine((password) => passwordByteLength(password) <= PASSWORD_MAX_BYTES, {
    message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes (bcrypt limit).`,
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["CLIENT", "BARBER", "ADMIN"]).default("CLIENT"),
  name: safeText(100, "Name is too long.")
    .min(1, "Name cannot be empty.")
    .optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(1024, "Password is too long."),
});

// Jeton de vérification d'email : chaîne hexadécimale de 64 caractères
// (256 bits). On tolère jusqu'à 512 caractères pour rester robuste aux
// évolutions futures sans exposer de limite utile à un attaquant.
export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required.").max(512, "Token is too long."),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// Mot de passe oublié (issue #9) : réponse toujours neutre côté serveur.
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Réinitialisation : jeton porteur (même format que la vérification d'email)
// et nouveau mot de passe soumis aux mêmes règles qu'à l'inscription.
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required.").max(512, "Token is too long."),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
