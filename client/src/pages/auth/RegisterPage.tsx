import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, authApi } from "../../lib/apiClient";
import { useLocale } from "../../app/locale-context";
import { LanguageSelect } from "../../components/LanguageSelect";
import { authErrorMessage } from "../../lib/authMessages";
import { cn } from "../../lib/cn";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { PasswordVisibilityIcon } from "../../components/auth/PasswordVisibilityIcon";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { fieldErrorsFrom, focusFirstInvalid } from "../../lib/formErrors";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: {
  value: "CLIENT" | "BARBER";
  labelKey: "register.roleClient" | "register.roleBarber";
}[] = [
  { value: "CLIENT", labelKey: "register.roleClient" },
  { value: "BARBER", labelKey: "register.roleBarber" },
];

export function RegisterPage() {
  const { t } = useTranslation("auth");
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
  const formRef = useRef<HTMLFormElement>(null);
  const { locale } = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    document.title = t("register.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = t("validation.emailInvalid");
    }
    if (!password) {
      errors.password = t("validation.passwordRequired");
    } else if (password.length < 8) {
      errors.password = t("validation.passwordMinLength", { count: 8 });
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({
        name: name || undefined,
        email,
        password,
        role,
        // Langue choisie (issue #38) : interface et premier email.
        locale,
      });
      // Pas d'auto-login : on affiche l'état « Vérifiez votre email ».
      setRegistered(true);
    } catch (err) {
      // Email déjà utilisé ou champ refusé par le serveur : message sous le
      // champ concerné plutôt qu'en tête de page (issue #57).
      const fields: FieldErrors =
        err instanceof ApiError && err.code === "EMAIL_TAKEN"
          ? { email: authErrorMessage(err) }
          : fieldErrorsFrom(err, ["name", "email", "password"]);
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
        focusFirstInvalid(formRef.current);
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <AuthLayout>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {t("register.checkEmail.title")}
        </h1>

        <Alert variant="info" role="status" className="mt-4">
          {t("register.checkEmail.body")}
        </Alert>

        <div className="mt-6 space-y-4">
          <Button
            onClick={() => navigate("/resend-verification", { replace: true })}
            className="min-h-[44px] w-full"
          >
            {t("actions.resendVerificationLink")}
          </Button>
          <p className="text-center text-sm text-foreground-muted">
            {t("register.checkEmail.alreadyVerified")}{" "}
            <Link
              to="/login"
              className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("actions.login")}
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("register.title")}
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        {t("register.subtitle")}
      </p>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label={t("fields.name")} hint={t("fields.optional")}>
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

        <Field label={t("fields.email")} error={fieldErrors.email}>
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

        <Field label={t("fields.password")} error={fieldErrors.password}>
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
                    ? t("fields.hidePassword")
                    : t("fields.showPassword")
                }
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          )}
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t("register.roleLegend")}
          </legend>
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
                  {t(option.labelKey)}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Langue du compte (issue #38), présélectionnée sur la langue courante. */}
        <LanguageSelect />

        {/* Erreur globale juste au-dessus du bouton (issue #57). */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          isLoading={submitting}
          className="min-h-[44px] w-full"
        >
          {t("register.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        {t("register.hasAccount")}{" "}
        <Link
          to="/login"
          className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("actions.login")}
        </Link>
      </p>
    </AuthLayout>
  );
}
