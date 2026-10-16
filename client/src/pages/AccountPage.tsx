import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { label } from "../lib/labels";
import { userApi } from "../lib/apiClient";
import { AvatarEditor } from "../components/account/AvatarEditor";
import { buttonClasses } from "../components/ui/buttonStyles";
import { authErrorMessage } from "../lib/authMessages";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { focusFirstInvalid } from "../lib/formErrors";

// Mon compte : photo de profil (issue #55) et suppression du compte
// (issue #14 : nLPD / RGPD). L'export des
// données vit dans Paramètres > Confidentialité (issue #31). Ouvert aux CLIENT
// et BARBER (un ADMIN est géré hors application).
export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleRequestDelete(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    if (!password) {
      setPasswordError(t("account.passwordRequired"));
      focusFirstInvalid(formRef.current);
      return;
    }
    setPasswordError(null);
    setConfirmOpen(true);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await userApi.deleteAccount(password);
      setConfirmOpen(false);
      // Quitter la page protégée AVANT de vider la session locale (sinon la
      // garde de route redirige vers /login). La session est déjà révoquée
      // côté serveur.
      navigate("/", { replace: true, state: { accountDeleted: true } });
      await logout().catch(() => {});
    } catch (err) {
      setConfirmOpen(false);
      setDeleteError(authErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t("account.title")}</h1>
            <p className="mt-1 break-all text-sm text-foreground-muted">
              {user.email} · {label("role", user.role)}
            </p>
          </div>
          <Link
            to="/settings"
            className={buttonClasses("secondary", "md", "shrink-0")}
          >
            {t("account.settingsLink")}
          </Link>
        </div>

        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-bold text-foreground">{t("account.photoTitle")}</h2>
          <AvatarEditor />
        </Card>

        <Card className="space-y-2 p-6">
          <h2 className="text-lg font-bold text-foreground">{t("account.dataTitle")}</h2>
          <p className="text-sm text-foreground-muted">
            {t("account.dataTextBefore")}{" "}
            <Link
              to="/settings#confidentialite"
              className="font-medium text-accent-strong underline underline-offset-2"
            >
              {t("account.dataLink")}
            </Link>
            {t("account.dataTextAfter")}
          </p>
        </Card>

        <Card className="space-y-3 border-danger/40 p-6">
          <h2 className="text-lg font-bold text-foreground">
            {t("account.deleteTitle")}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            <li>{t("account.deleteInfo.definitive")}</li>
            <li>{t("account.deleteInfo.bookings")}</li>
            <li>{t("account.deleteInfo.personal")}</li>
            {user.role === "BARBER" && (
              <li>{t("account.deleteInfo.showcase")}</li>
            )}
          </ul>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <form ref={formRef} onSubmit={handleRequestDelete} noValidate className="space-y-3">
            <Field label={t("account.passwordLabel")} error={passwordError}>
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-[44px]"
                />
              )}
            </Field>
            <Button type="submit" variant="danger">
              {t("account.deleteButton")}
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("account.confirmTitle")}
        confirmLabel={t("account.confirmLabel")}
        cancelLabel={t("account.confirmCancel")}
        tone="danger"
        isLoading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>{t("account.confirmText")}</p>
      </ConfirmDialog>
    </div>
  );
}
