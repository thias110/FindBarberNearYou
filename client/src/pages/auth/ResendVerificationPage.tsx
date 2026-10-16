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

export function ResendVerificationPage() {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.title = t("resendVerification.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

  function validate(): string | null {
    const trimmed = email.trim();
    if (!trimmed) return t("validation.emailRequired");
    if (!EMAIL_PATTERN.test(trimmed)) return t("validation.emailInvalid");
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(false);

    const validationError = validate();
    setFieldError(validationError);
    if (validationError) {
      focusFirstInvalid(formRef.current);
      return;
    }

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
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("actions.resendVerificationLink")}
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        {t("resendVerification.subtitle")}
      </p>

      <div aria-live="polite" className="mt-4">
        {success && (
          <Alert variant="success" role="status">
            {t("resendVerification.success")}
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

        <Button
          type="submit"
          isLoading={submitting}
          className="min-h-[44px] w-full"
        >
          {t("resendVerification.submit")}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-foreground-muted">
        <Link
          to="/login"
          className="rounded text-accent-strong underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("actions.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
