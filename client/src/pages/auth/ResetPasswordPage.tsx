import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { PasswordVisibilityIcon } from "../../components/auth/PasswordVisibilityIcon";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";

const PASSWORD_MIN_LENGTH = 8;

const LINK_CLASS =
  "rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Réinitialisation (issue #9) : le jeton arrive par le lien de l'email
// (`?token=`). Après succès, toutes les sessions sont révoquées côté serveur.
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmation?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Nouveau mot de passe — FindBarber";
    return () => {
      document.title = "FindBarber";
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    const errors: typeof fieldErrors = {};
    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
    }
    if (confirmation !== password) {
      errors.confirmation = "Les deux mots de passe ne correspondent pas.";
    }
    setFieldErrors(errors);
    if (errors.password || errors.confirmation) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold text-foreground">
          Lien incomplet
        </h1>
        <Alert variant="danger" role="alert" className="mt-4">
          Ce lien de réinitialisation est incomplet. Utilisez le lien reçu par
          email ou demandez-en un nouveau.
        </Alert>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className={LINK_CLASS}>
            Demander un nouveau lien
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold text-foreground">
          Mot de passe modifié
        </h1>
        <Alert variant="success" role="status" className="mt-4">
          Votre mot de passe a été changé. Par sécurité, vos autres sessions ont
          été déconnectées.
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className={LINK_CLASS}>
            Se connecter
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-foreground">
        Choisir un nouveau mot de passe
      </h1>

      <div aria-live="polite" className="mt-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}{" "}
            <Link to="/forgot-password" className="font-medium underline">
              Demander un nouveau lien
            </Link>
          </Alert>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field
          label="Nouveau mot de passe"
          error={fieldErrors.password}
          hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        >
          {(control) => (
            <div className="relative">
              <Input
                {...control}
                type={showPassword ? "text" : "password"}
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-[44px] pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-lg text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          )}
        </Field>

        <Field
          label="Confirmer le mot de passe"
          error={fieldErrors.confirmation}
        >
          {(control) => (
            <Input
              {...control}
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="min-h-[44px]"
            />
          )}
        </Field>

        <Button type="submit" isLoading={submitting} className="w-full">
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthLayout>
  );
}
