import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "@findbarber/shared/constants";
import { useAuth } from "../app/auth-context";
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
      setPasswordError("Saisissez votre mot de passe pour confirmer.");
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">Mon compte</h1>
            <p className="mt-1 break-all text-sm text-foreground-muted">
              {user.email} · {ROLE_LABELS[user.role]}
            </p>
          </div>
          <Link
            to="/settings"
            className={buttonClasses("secondary", "md", "shrink-0")}
          >
            Paramètres
          </Link>
        </div>

        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-bold text-foreground">Photo de profil</h2>
          <AvatarEditor />
        </Card>

        <Card className="space-y-2 p-6">
          <h2 className="text-lg font-bold text-foreground">Mes données</h2>
          <p className="text-sm text-foreground-muted">
            Pour télécharger une copie de vos données, rendez-vous dans{" "}
            <Link
              to="/settings#confidentialite"
              className="font-medium text-accent-strong underline underline-offset-2"
            >
              Paramètres &gt; Confidentialité
            </Link>
            .
          </p>
        </Card>

        <Card className="space-y-3 border-danger/40 p-6">
          <h2 className="text-lg font-bold text-foreground">
            Supprimer mon compte
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            <li>La suppression est définitive.</li>
            <li>
              Vos rendez-vous à venir sont annulés et l'autre partie est
              prévenue.
            </li>
            <li>
              Votre nom, votre email, votre adresse et vos commentaires sont
              effacés. L'historique des rendez-vous et les notes restent, sous
              forme anonyme.
            </li>
            {user.role === "BARBER" && (
              <li>
                Votre vitrine (profil, photos, horaires) est retirée de la
                recherche.
              </li>
            )}
          </ul>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <form ref={formRef} onSubmit={handleRequestDelete} noValidate className="space-y-3">
            <Field label="Mot de passe actuel" error={passwordError}>
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
              Supprimer mon compte
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Supprimer définitivement votre compte ?"
        confirmLabel="Supprimer définitivement"
        cancelLabel="Garder mon compte"
        tone="danger"
        isLoading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>Cette action est irréversible.</p>
      </ConfirmDialog>
    </div>
  );
}
