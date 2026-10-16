import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROLE_HOME } from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";
import { ApiError } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { PasswordVisibilityIcon } from "../../components/auth/PasswordVisibilityIcon";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { focusFirstInvalid } from "../../lib/formErrors";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);

  const registered =
    (location.state as { registered?: boolean } | null)?.registered === true;

  useEffect(() => {
    document.title = t("login.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

  // Message de succès après inscription : affiché une seule fois, puis retiré
  // de l'historique pour ne pas réapparaître au rechargement.
  useEffect(() => {
    if (!registered) return;
    setSuccessMessage(t("login.registered"));
    navigate(location.pathname, { replace: true, state: null });
  }, [registered, location.pathname, navigate, t]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = t("validation.emailInvalid");
    }
    if (!password) {
      errors.password = t("validation.passwordRequired");
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setNotVerified(false);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true);
        setError(null);
      } else {
        setNotVerified(false);
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("login.title")}
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        {t("login.subtitle")}
      </p>

      {successMessage && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"
        >
          {successMessage}
        </div>
      )}

      {notVerified && (
        <Alert variant="warning" role="alert" className="mt-4">
          {t("login.notVerified")}{" "}
          <Link
            to="/resend-verification"
            className="rounded text-accent-strong underline focus-ring"
          >
            {t("actions.resendVerificationLink")}
          </Link>
        </Alert>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
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
                autoComplete="current-password"
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
                className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl text-foreground-muted transition-colors hover:text-foreground focus-ring-inset"
              >
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          )}
        </Field>

        <p className="-mt-2 text-right text-sm">
          <Link
            to="/forgot-password"
            className="inline-flex min-h-11 items-center rounded text-accent-strong underline focus-ring"
          >
            {t("login.forgotPassword")}
          </Link>
        </p>

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
          {t("actions.login")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        {t("login.noAccount")}{" "}
        <Link
          to="/register"
          className="rounded text-accent-strong underline focus-ring"
        >
          {t("login.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
}
