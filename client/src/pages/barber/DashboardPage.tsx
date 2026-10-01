import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { OwnBarberProfile } from "@findbarber/shared/types";
import { useAuth } from "../../app/auth-context";
import { ApiError, barberApi } from "../../lib/apiClient";

export function BarberDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<OwnBarberProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-brand-900">Espace barbier</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-brand-700 px-4 py-2 text-white"
          >
            Se déconnecter
          </button>
        </div>
        <p className="text-gray-700">Connecté en tant que {user?.email}.</p>

        <nav className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/pro/profile"
            className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-brand-900">Mon profil</span>
            <span className="mt-1 block text-sm text-gray-600">
              Nom, adresse, coordonnées, pays et devise
            </span>
          </Link>
          <Link
            to="/pro/services"
            className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-brand-900">Mes services</span>
            <span className="mt-1 block text-sm text-gray-600">
              Prestations, durées et tarifs
            </span>
          </Link>
          <Link
            to="/pro/working-hours"
            className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-brand-900">Mes horaires</span>
            <span className="mt-1 block text-sm text-gray-600">
              Jours et plages de travail (heures locales du salon)
            </span>
          </Link>
          <Link
            to="/pro/time-off"
            className="rounded-2xl bg-white p-5 shadow transition hover:shadow-md"
          >
            <span className="font-semibold text-brand-900">
              Mes indisponibilités
            </span>
            <span className="mt-1 block text-sm text-gray-600">
              Congés et fermetures exceptionnelles
            </span>
          </Link>
        </nav>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="font-semibold text-brand-900">Lien public partageable</h2>
          {loading ? (
            <p className="mt-2 text-gray-500">Chargement…</p>
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
            <p className="mt-2 text-gray-700">
              Créez votre profil pour obtenir votre lien public.
            </p>
          ) : publicLink ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-600">
                Ce lien reste identique, même après modification de votre profil ou de
                vos services. Ajoutez-le à votre bio Instagram ou partagez-le ailleurs.
              </p>
              <input
                readOnly
                value={publicLink}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Lien public de votre profil"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
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
