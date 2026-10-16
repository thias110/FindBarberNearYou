import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { LIMITS, UPLOAD_IMAGE_MIME_TYPES } from "@findbarber/shared/constants";
import { useAuth } from "../../app/auth-context";
import {
  apiErrorMessage,
  resolveUploadUrl,
  userApi,
  validateImageFile,
} from "../../lib/apiClient";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

// Photo de profil de l'utilisateur connecté (issues #8 et #55) : envoi,
// remplacement et suppression via `PUT/DELETE /api/users/me/avatar`. Partagé
// par Mon compte (CLIENT et BARBER) et l'espace professionnel. La page
// appelante fournit le titre et la carte. L'utilisateur en session est mis à
// jour pour que la photo s'affiche partout (accueil, en-têtes).
export function AvatarEditor() {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Focus de la confirmation destructive (remplace window.confirm).
  const deleteTriggerRef = useRef<HTMLSpanElement>(null);
  const cancelDeleteRef = useRef<HTMLSpanElement>(null);
  const confirmBoxRef = useRef<HTMLDivElement>(null);
  const chooseImageRef = useRef<HTMLSpanElement>(null);
  const wasConfirmingRef = useRef(false);

  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const avatarPath = user?.avatarPath ?? null;

  // Gestion clavier de la confirmation inline de suppression :
  // - ouverture : focus sur « Annuler » (action la moins destructrice) ;
  // - pendant la requête : focus maintenu dans le bloc (les deux boutons sont
  //   désactivés, donc le focus serait sinon perdu) ;
  // - fermeture : focus rendu au bouton déclencheur, s'il existe encore.
  useEffect(() => {
    if (!confirmingDelete) {
      if (wasConfirmingRef.current) {
        wasConfirmingRef.current = false;
        // Priorité : bouton déclencheur (Annuler / échec de suppression).
        // S'il a disparu (suppression réussie), repli sur « Choisir une image ».
        const target =
          deleteTriggerRef.current?.querySelector<HTMLButtonElement>("button") ??
          chooseImageRef.current?.querySelector<HTMLButtonElement>("button");
        target?.focus();
      }
      return;
    }
    wasConfirmingRef.current = true;
    if (busy) {
      confirmBoxRef.current?.focus();
    } else {
      cancelDeleteRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    }
  }, [confirmingDelete, busy]);

  if (!user) return null;

  const initialSource = user.name?.trim() || user.email;
  const initial = initialSource.charAt(0).toUpperCase();

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const validation = validateImageFile(selected);
    if (validation) {
      setMessage({ kind: "error", text: validation });
      return;
    }
    setConfirmingDelete(false);
    setBusy(true);
    setMessage(null);
    try {
      const res = await userApi.updateAvatar(selected);
      updateUser(res.user);
      setMessage({ kind: "success", text: t("avatar.updated") });
    } catch (err: unknown) {
      // 400 (format), 401 (session), 403 (CSRF), 413 (taille) via le serveur.
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  // Demande de suppression : aucun appel réseau, on affiche seulement la
  // confirmation inline.
  function requestDelete() {
    if (busy) return;
    setMessage(null);
    setConfirmingDelete(true);
  }

  // Annulation : aucun appel réseau.
  function cancelDelete() {
    setConfirmingDelete(false);
  }

  // Suppression confirmée : seul chemin qui déclenche la requête. La
  // confirmation reste ouverte pendant la requête puis se ferme, afin que le
  // focus puisse être rendu au bouton déclencheur.
  async function handleDelete() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await userApi.deleteAvatar();
      updateUser(res.user);
      setMessage({ kind: "success", text: t("avatar.deleted") });
    } catch (err: unknown) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {avatarPath ? (
          <img
            src={resolveUploadUrl(avatarPath) ?? ""}
            alt={t("avatar.alt")}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-strong"
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_IMAGE_MIME_TYPES.join(",")}
            disabled={busy}
            onChange={(event) => void handleChange(event)}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <span ref={chooseImageRef} className="inline-flex">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                disabled={busy}
                isLoading={busy}
                aria-describedby={
                  message?.kind === "error"
                    ? "avatar-hint avatar-message"
                    : "avatar-hint"
                }
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPath ? t("avatar.change") : t("avatar.choose")}
              </Button>
            </span>
            {avatarPath && !confirmingDelete && (
              <span ref={deleteTriggerRef} className="inline-flex">
                <Button
                  variant="danger"
                  className="min-h-[44px]"
                  disabled={busy}
                  onClick={requestDelete}
                >
                  {t("avatar.delete")}
                </Button>
              </span>
            )}
          </div>
          <p id="avatar-hint" className="text-xs text-foreground-muted">
            {t("avatar.hint", {
              size: Math.round(LIMITS.uploadMaxBytes / 1_048_576),
            })}
          </p>

          {/* Résultat affiché à côté du champ (issue #55). */}
          {message && (
            <Alert
              id="avatar-message"
              variant={message.kind === "success" ? "success" : "danger"}
            >
              {message.text}
            </Alert>
          )}
        </div>
      </div>

      {confirmingDelete && avatarPath && (
        <div
          ref={confirmBoxRef}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) {
              event.preventDefault();
              cancelDelete();
            }
          }}
          className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 focus:outline-none"
        >
          <p className="text-sm text-foreground">
            {t("avatar.confirmText")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span ref={cancelDeleteRef} className="inline-flex">
              <Button
                variant="secondary"
                className="min-h-[44px]"
                disabled={busy}
                onClick={cancelDelete}
              >
                {t("avatar.cancel")}
              </Button>
            </span>
            <Button
              variant="danger"
              className="min-h-[44px]"
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleDelete()}
            >
              {t("avatar.confirmDelete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
