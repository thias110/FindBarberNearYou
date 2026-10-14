import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Renvoyer la vérification — FindBarber";
    return () => {
      document.title = "FindBarber";
    };
  }, []);

  function validate(): string | null {
    const trimmed = email.trim();
    if (!trimmed) return "L'email est requis.";
    if (!EMAIL_PATTERN.test(trimmed)) return "Format d'email invalide.";
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(false);

    const validationError = validate();
    setFieldError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      await authApi.resendVerification({ email: email.trim() });
      // Réponse générique, conforme au backend : ne révèle jamais si l'adresse
      // existe. Le cooldown backend reste silencieux (même réponse 200).
      setSuccess(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-foreground">
        Renvoyer le lien de vérification
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Saisissez l'adresse email utilisée lors de votre inscription.
      </p>

      <div aria-live="polite" className="mt-4">
        {success && (
          <Alert variant="success" role="status">
            Si un compte existe avec cette adresse, un lien de vérification vient
            d'être envoyé. Pensez à vérifier vos courriers indésirables.
          </Alert>
        )}
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={fieldError}>
          {(control) => (
            <Input
              {...control}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-[44px]"
            />
          )}
        </Field>

        <Button
          type="submit"
          isLoading={submitting}
          className="min-h-[44px] w-full"
        >
          Renvoyer le lien
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        <Link
          to="/login"
          className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Retour à la connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
