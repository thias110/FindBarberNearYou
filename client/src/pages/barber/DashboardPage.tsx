import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OwnBarberProfile } from "@findbarber/shared/types";
import { useAuth } from "../../app/auth-context";
import { ApiError, barberApi } from "../../lib/apiClient";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { AvatarEditor } from "../../components/account/AvatarEditor";
import { ProNavCard } from "../../components/barber/ProNavCard";
import { buttonClasses } from "../../components/ui/buttonStyles";
import { CONTROL_CLASS } from "../../components/ui/control";

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
  const copyTimeoutRef = useRef<number | null>(null);

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

  // Nettoyage du minuteur de confirmation de copie (évite un setState après
  // démontage).
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
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
          <h2 className="mb-4 text-lg font-bold text-foreground">
            Photo de profil
          </h2>
          <AvatarEditor />
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
          <h2 className="text-lg font-bold text-foreground">
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
                className={CONTROL_CLASS}
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
                  className={buttonClasses("secondary")}
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
