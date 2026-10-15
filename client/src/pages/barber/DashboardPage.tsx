import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { LIMITS, UPLOAD_IMAGE_MIME_TYPES } from "@findbarber/shared/constants";
import type { OwnBarberProfile } from "@findbarber/shared/types";
import { useAuth } from "../../app/auth-context";
import {
  ApiError,
  apiErrorMessage,
  barberApi,
  resolveUploadUrl,
  userApi,
  validateImageFile,
} from "../../lib/apiClient";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProNavCard } from "../../components/barber/ProNavCard";

// Routes BARBER existantes : aucune URL n'est introduite ni modifiée.
const PRO_NAV = [
  {
    to: "/pro/profile",
    title: "Mon profil",
    description: "Nom, adresse, coordonnées, pays et devise",
  },
  {
    to: "/pro/services",
    title: "Mes services",
    description: "Prestations, durées et tarifs",
  },
  {
    to: "/pro/working-hours",
    title: "Mes horaires",
    description: "Jours et plages de travail (heures locales du salon)",
  },
  {
    to: "/pro/time-off",
    title: "Mes indisponibilités",
    description: "Congés et fermetures exceptionnelles",
  },
  {
    to: "/pro/bookings",
    title: "Mes réservations",
    description: "Demandes en attente, confirmations et annulations",
  },
  {
    to: "/pro/stats",
    title: "Mes statistiques",
    description: "Revenus, rendez-vous, services et avis",
  },
  {
    to: "/pro/gallery",
    title: "Ma galerie",
    description: "Photos de vos réalisations",
  },
  {
    to: "/pro/payments",
    title: "Paiements en ligne",
    description: "Stripe, acompte ou paiement complet à la réservation",
  },
] as const;

export function BarberDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  // Focus de la confirmation destructive (remplace window.confirm).
  const deleteTriggerRef = useRef<HTMLSpanElement>(null);
  const cancelDeleteRef = useRef<HTMLSpanElement>(null);
  const confirmBoxRef = useRef<HTMLDivElement>(null);
  const chooseImageRef = useRef<HTMLSpanElement>(null);
  const wasConfirmingRef = useRef(false);

  const [profile, setProfile] = useState<OwnBarberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(
    user?.avatarPath ?? null,
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setProfileMissing(false);
    setProfile(null);
    barberApi
      .getProfile()
      .then((res) => {
        setProfile(res.profile);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Impossible de charger votre profil.",
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Nettoyage du minuteur de confirmation de copie (évite un setState après
  // démontage).
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
    if (avatarBusy) {
      confirmBoxRef.current?.focus();
    } else {
      cancelDeleteRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    }
  }, [confirmingDelete, avatarBusy]);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const validation = validateImageFile(selected);
    if (validation) {
      setAvatarMessage({ kind: "error", text: validation });
      return;
    }
    setConfirmingDelete(false);
    setAvatarBusy(true);
    setAvatarMessage(null);
    try {
      const res = await userApi.updateAvatar(selected);
      setAvatarPath(res.user.avatarPath);
      setAvatarMessage({ kind: "success", text: "Avatar mis à jour." });
    } catch (err: unknown) {
      // 400 (format), 401 (session), 403 (CSRF), 413 (taille) via le serveur.
      setAvatarMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
    }
  }

  // Demande de suppression : aucun appel réseau, on affiche seulement la
  // confirmation inline.
  function requestAvatarDelete() {
    if (avatarBusy) return;
    setAvatarMessage(null);
    setConfirmingDelete(true);
  }

  // Annulation : aucun appel réseau.
  function cancelAvatarDelete() {
    setConfirmingDelete(false);
  }

  // Suppression confirmée : seul chemin qui déclenche la requête. La
  // confirmation reste ouverte pendant la requête puis se ferme, afin que le
  // focus puisse être rendu au bouton déclencheur.
  async function handleAvatarDelete() {
    setAvatarBusy(true);
    setAvatarMessage(null);
    try {
      const res = await userApi.deleteAvatar();
      setAvatarPath(res.user.avatarPath);
      setAvatarMessage({ kind: "success", text: "Avatar supprimé." });
    } catch (err: unknown) {
      setAvatarMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
      setConfirmingDelete(false);
    }
  }

  const publicLink = profile
    ? `${window.location.origin}/barbers/${profile.id}`
    : null;

  async function handleCopy() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setCopyError(null);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(
        "Copie automatique impossible. Sélectionnez le lien ci-dessous manuellement.",
      );
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">
              Espace professionnel
            </h1>
            <p className="mt-1 break-words text-sm text-foreground-muted">
              {user?.name ? `${user.name} · ${user.email}` : user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => void handleLogout()}
          >
            Se déconnecter
          </Button>
        </header>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Mon avatar</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {avatarPath ? (
              <img
                src={resolveUploadUrl(avatarPath) ?? ""}
                alt="Votre avatar"
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-foreground"
              >
                {initial}
              </div>
            )}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={UPLOAD_IMAGE_MIME_TYPES.join(",")}
                disabled={avatarBusy}
                onChange={(event) => void handleAvatarChange(event)}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <span ref={chooseImageRef} className="inline-flex">
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={avatarBusy}
                    isLoading={avatarBusy}
                    aria-describedby="avatar-hint"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarPath ? "Changer l'image" : "Choisir une image"}
                  </Button>
                </span>
                {avatarPath && !confirmingDelete && (
                  <span ref={deleteTriggerRef} className="inline-flex">
                    <Button
                      variant="danger"
                      className="min-h-[44px]"
                      disabled={avatarBusy}
                      onClick={requestAvatarDelete}
                    >
                      Supprimer l'avatar
                    </Button>
                  </span>
                )}
              </div>
              <p id="avatar-hint" className="text-xs text-foreground-muted">
                JPEG, PNG ou WebP,{" "}
                {Math.round(LIMITS.uploadMaxBytes / 1_048_576)} Mo max.
              </p>
            </div>
          </div>

          {confirmingDelete && avatarPath && (
            <div
              ref={confirmBoxRef}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !avatarBusy) {
                  event.preventDefault();
                  cancelAvatarDelete();
                }
              }}
              className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 focus:outline-none"
            >
              <p className="text-sm text-foreground">
                Supprimer votre avatar ? Cette action est définitive.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span ref={cancelDeleteRef} className="inline-flex">
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={avatarBusy}
                    onClick={cancelAvatarDelete}
                  >
                    Annuler
                  </Button>
                </span>
                <Button
                  variant="danger"
                  className="min-h-[44px]"
                  disabled={avatarBusy}
                  isLoading={avatarBusy}
                  onClick={() => void handleAvatarDelete()}
                >
                  Confirmer la suppression
                </Button>
              </div>
            </div>
          )}

          {avatarMessage && (
            <Alert
              variant={avatarMessage.kind === "success" ? "success" : "danger"}
              className="mt-4"
            >
              {avatarMessage.text}
            </Alert>
          )}
        </Card>

        <nav
          aria-label="Navigation de l'espace professionnel"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PRO_NAV.map((item) => (
            <ProNavCard
              key={item.to}
              to={item.to}
              title={item.title}
              description={item.description}
            />
          ))}
        </nav>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Lien public partageable
          </h2>

          {loading ? (
            <div className="mt-3 space-y-2" aria-busy="true">
              <span className="sr-only" role="status">
                Chargement du profil…
              </span>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : loadError ? (
            <Alert variant="danger" className="mt-3">
              <p>{loadError}</p>
              <Button
                variant="secondary"
                className="mt-3 min-h-[44px]"
                onClick={loadProfile}
              >
                Réessayer
              </Button>
            </Alert>
          ) : profileMissing ? (
            <div className="mt-3">
              <Alert variant="info">
                Créez votre profil pour obtenir votre lien public.
              </Alert>
              <Button
                className="mt-3 min-h-[44px]"
                onClick={() => navigate("/pro/profile")}
              >
                Créer mon profil
              </Button>
            </div>
          ) : publicLink ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-foreground-muted">
                Ce lien reste identique, même après modification de votre profil
                ou de vos services. Ajoutez-le à votre bio Instagram ou
                partagez-le ailleurs.
              </p>
              <input
                readOnly
                value={publicLink}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Lien public de votre profil"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-[44px]"
                  onClick={() => void handleCopy()}
                >
                  {copied ? "Lien copié !" : "Copier mon lien"}
                </Button>
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Voir mon profil public
                </a>
              </div>
              {copied && (
                <p role="status" className="text-sm text-success">
                  Lien copié dans le presse-papiers.
                </p>
              )}
              {copyError && <Alert variant="warning">{copyError}</Alert>}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
