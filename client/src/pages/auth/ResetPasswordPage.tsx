import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { PasswordVisibilityIcon } from "../../components/auth/PasswordVisibilityIcon";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { focusFirstInvalid } from "../../lib/formErrors";

const PASSWORD_MIN_LENGTH = 8;

const LINK_CLASS =
  "rounded text-accent-strong underline focus-ring";

// Réinitialisation (issue #9) : le jeton arrive par le lien de l'email
// (`?token=`). Après succès, toutes les sessions sont révoquées côté serveur.
export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    document.title = t("resetPassword.documentTitle");
    return () => {
      document.title = "FindBarber";
    };
  }, [t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    const errors: typeof fieldErrors = {};
    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.password = t("validation.passwordMinLength", {
        count: PASSWORD_MIN_LENGTH,
      });
    }
    if (confirmation !== password) {
      errors.confirmation = t("validation.passwordMismatch");
    }
    setFieldErrors(errors);
    if (errors.password || errors.confirmation) {
      focusFirstInvalid(formRef.current);
      return;
    }

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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {t("resetPassword.incomplete.title")}
        </h1>
        <Alert variant="danger" role="alert" className="mt-4">
          {t("resetPassword.incomplete.body")}
        </Alert>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className={LINK_CLASS}>
            {t("actions.requestNewLink")}
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {t("resetPassword.done.title")}
        </h1>
        <Alert variant="success" role="status" className="mt-4">
          {t("resetPassword.done.body")}
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className={LINK_CLASS}>
            {t("actions.login")}
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
        {t("resetPassword.title")}
      </h1>

      <div aria-live="polite" className="mt-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}{" "}
            <Link to="/forgot-password" className="font-medium underline">
              {t("actions.requestNewLink")}
            </Link>
          </Alert>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field
          label={t("resetPassword.newPassword")}
          error={fieldErrors.password}
          hint={t("resetPassword.minLengthHint", { count: PASSWORD_MIN_LENGTH })}
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

        <Field
          label={t("resetPassword.confirmPassword")}
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
          {t("resetPassword.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
