import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
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

export function BarberDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const validation = validateImageFile(selected);
    if (validation) {
      setAvatarMessage({ kind: "error", text: validation });
      return;
    }
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

  async function handleAvatarDelete() {
    if (!window.confirm("Supprimer votre avatar ?")) return;
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
      window.setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Espace barbier</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-brand-700 px-4 py-2 text-white"
          >
            Se déconnecter
          </button>
        </div>
        <p className="text-foreground">Connecté en tant que {user?.email}.</p>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow">
          <h2 className="font-semibold text-foreground">Mon avatar</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {avatarPath ? (
              <img
                src={resolveUploadUrl(avatarPath) ?? ""}
                alt="Mon avatar"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800">
                {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="file"
                accept={UPLOAD_IMAGE_MIME_TYPES.join(",")}
                disabled={avatarBusy}
                onChange={(event) => void handleAvatarChange(event)}
                className="block text-sm"
              />
              {avatarPath && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => void handleAvatarDelete()}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                >
                  Supprimer l'avatar
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-foreground-muted">
            JPEG, PNG ou WebP, {Math.round(LIMITS.uploadMaxBytes / 1_048_576)} Mo
            max.
          </p>
          {avatarMessage && (
            <p
              className={`mt-2 text-sm ${
                avatarMessage.kind === "success"
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {avatarMessage.text}
            </p>
          )}
        </section>

        <nav className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/pro/profile"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">Mon profil</span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Nom, adresse, coordonnées, pays et devise
            </span>
          </Link>
          <Link
            to="/pro/services"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">Mes services</span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Prestations, durées et tarifs
            </span>
          </Link>
          <Link
            to="/pro/working-hours"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">Mes horaires</span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Jours et plages de travail (heures locales du salon)
            </span>
          </Link>
          <Link
            to="/pro/time-off"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">
              Mes indisponibilités
            </span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Congés et fermetures exceptionnelles
            </span>
          </Link>
          <Link
            to="/pro/bookings"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">
              Mes réservations
            </span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Demandes en attente, confirmations et annulations
            </span>
          </Link>
          <Link
            to="/pro/stats"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">
              Mes statistiques
            </span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Revenus, rendez-vous, services et avis
            </span>
          </Link>
          <Link
            to="/pro/gallery"
            className="rounded-2xl border border-border bg-surface p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-foreground">Ma galerie</span>
            <span className="mt-1 block text-sm text-foreground-muted">
              Photos de vos réalisations
            </span>
          </Link>
        </nav>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow">
          <h2 className="font-semibold text-foreground">Lien public partageable</h2>
          {loading ? (
            <p className="mt-2 text-foreground-muted">Chargement…</p>
          ) : loadError ? (
            <div className="mt-2">
              <p className="text-sm text-red-700">{loadError}</p>
              <button
                onClick={loadProfile}
                className="mt-2 rounded-lg border border-brand-700 px-4 py-2 text-brand-700"
              >
                Réessayer
              </button>
            </div>
          ) : profileMissing ? (
            <p className="mt-2 text-foreground">
              Créez votre profil pour obtenir votre lien public.
            </p>
          ) : publicLink ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-foreground-muted">
                Ce lien reste identique, même après modification de votre profil ou de
                vos services. Ajoutez-le à votre bio Instagram ou partagez-le ailleurs.
              </p>
              <input
                readOnly
                value={publicLink}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Lien public de votre profil"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-white"
                >
                  {copied ? "Lien copié !" : "Copier mon lien"}
                </button>
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-brand-700 px-4 py-2 text-brand-700"
                >
                  Voir mon profil public
                </a>
              </div>
              {copyError && <p className="text-sm text-amber-700">{copyError}</p>}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
