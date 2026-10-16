import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { focusFirstInvalid } from "../../lib/formErrors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LINK_CLASS =
  "rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Mot de passe oublié (issue #9) : réponse toujours neutre, comme le serveur.
export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.title = t("forgotPassword.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(false);

    const trimmed = email.trim();
    const validationError = !trimmed
      ? t("validation.emailRequired")
      : !EMAIL_PATTERN.test(trimmed)
        ? t("validation.emailInvalid")
        : null;
    setFieldError(validationError);
    if (validationError) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: trimmed });
      setSuccess(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("forgotPassword.title")}
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        {t("forgotPassword.subtitle")}
      </p>

      <div aria-live="polite" className="mt-4">
        {success && (
          <Alert variant="success" role="status">
            {t("forgotPassword.success")}
          </Alert>
        )}
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label={t("fields.email")} error={fieldError}>
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

        <Button type="submit" isLoading={submitting} className="w-full">
          {t("forgotPassword.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        <Link to="/login" className={LINK_CLASS}>
          {t("actions.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
