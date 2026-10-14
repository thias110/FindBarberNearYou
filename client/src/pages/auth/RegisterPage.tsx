import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { cn } from "../../lib/cn";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { PasswordVisibilityIcon } from "../../components/auth/PasswordVisibilityIcon";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: { value: "CLIENT" | "BARBER"; label: string }[] = [
  { value: "CLIENT", label: "Je cherche un barber" },
  { value: "BARBER", label: "Je suis barber" },
];

export function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // `?role=BARBER` (lien « Vous êtes barber ? » de l'accueil) présélectionne
  // le rôle ; toute autre valeur retombe sur CLIENT.
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<"CLIENT" | "BARBER">(
    searchParams.get("role") === "BARBER" ? "BARBER" : "CLIENT",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    document.title = "Inscription — FindBarber";
    return () => {
      document.title = "FindBarber";
    };
  }, []);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "L'email est requis.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Format d'email invalide.";
    }
    if (!password) {
      errors.password = "Le mot de passe est requis.";
    } else if (password.length < 8) {
      errors.password = "Le mot de passe doit contenir au moins 8 caractères.";
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.register({
        name: name || undefined,
        email,
        password,
        role,
      });
      // Pas d'auto-login : on affiche l'état « Vérifiez votre email ».
      setRegistered(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold text-foreground">
          Vérifiez votre adresse email.
        </h1>

        <Alert variant="info" role="status" className="mt-4">
          Un lien de vérification vient d'être envoyé à votre adresse email.
          Cliquez dessus pour activer votre compte. Pensez à vérifier vos
          courriers indésirables.
        </Alert>

        <div className="mt-6 space-y-4">
          <Button
            onClick={() => navigate("/resend-verification", { replace: true })}
            className="min-h-[44px] w-full"
          >
            Renvoyer le lien de vérification
          </Button>
          <p className="text-center text-sm text-foreground-muted">
            Vous avez déjà vérifié votre email ?{" "}
            <Link
              to="/login"
              className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-foreground">
        Créez votre compte.
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Réservez un barber ou développez votre activité, simplement.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Nom" hint="Optionnel">
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-[44px]"
            />
          )}
        </Field>

        <Field label="Email" error={fieldErrors.email}>
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

        <Field label="Mot de passe" error={fieldErrors.password}>
          {(control) => (
            <div className="relative">
              <Input
                {...control}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
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

        <fieldset>
          <legend className="text-sm font-medium text-foreground">Je suis</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                    selected
                      ? "border-accent bg-accent-soft text-foreground"
                      : "border-border bg-surface text-foreground-muted hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={() => setRole(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="submit"
          isLoading={submitting}
          className="min-h-[44px] w-full"
        >
          Créer mon compte
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        Vous avez déjà un compte ?{" "}
        <Link
          to="/login"
          className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
