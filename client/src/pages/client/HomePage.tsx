import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { PublicBarberSearchItem } from "@findbarber/shared/types";
import { useAuth } from "../../app/auth-context";
import { barbersApi } from "../../lib/apiClient";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { HomeHero } from "../../components/home/HomeHero";
import { CategoryChips } from "../../components/home/CategoryChips";
import { BarberPreviewCard } from "../../components/home/BarberPreviewCard";

const PREVIEW_LIMIT = 3;

const LINK_BASE =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const PRIMARY_LINK_CLASS = `${LINK_BASE} bg-accent text-accent-foreground hover:bg-accent-hover`;
const SECONDARY_LINK_CLASS = `${LINK_BASE} border border-border bg-surface text-foreground hover:bg-surface-muted`;

const STEPS = [
  {
    title: "1. Cherchez",
    description: "Trouvez un barber selon vos besoins.",
  },
  {
    title: "2. Comparez",
    description: "Consultez les services et profils disponibles.",
  },
  {
    title: "3. Réservez",
    description: "Choisissez un créneau et confirmez votre rendez-vous.",
  },
];

// Accueil : public pour les visiteurs (incitation à l'inscription), enrichi
// pour un CLIENT connecté (rendez-vous, déconnexion). Les BARBER et ADMIN sont
// redirigés vers leur espace par la route.
export function ClientHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Arrivée après suppression du compte (issue #14).
  const accountDeleted = Boolean(
    (location.state as { accountDeleted?: boolean } | null)?.accountDeleted,
  );

  const [barbers, setBarbers] = useState<PublicBarberSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    barbersApi
      .search({ page: 1, pageSize: PREVIEW_LIMIT }, controller.signal)
      .then((res) => {
        if (!cancelled) setBarbers(res.barbers);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Une annulation (démontage) n'est pas une erreur utilisateur.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les barbers.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  // Recherche par ville : contrat d'URL de BarbersSearchPage (`city`).
  function handleSearch(city: string) {
    const trimmed = city.trim();
    navigate(
      trimmed ? `/barbers?city=${encodeURIComponent(trimmed)}` : "/barbers",
    );
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {accountDeleted && (
          <Alert variant="success">
            Votre compte a été supprimé et vos données personnelles effacées.
          </Alert>
        )}

        <HomeHero user={user} onSubmitCity={handleSearch} />

        <CategoryChips />

        <section aria-labelledby="home-barbers-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="home-barbers-title"
                className="text-xl font-semibold text-foreground"
              >
                Barbers à découvrir
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Des professionnels prêts à vous accueillir.
              </p>
            </div>
            <Button
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => navigate("/barbers")}
            >
              Voir tous les barbers
            </Button>
          </div>

          {loading ? (
            <div
              aria-busy="true"
              className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <span className="sr-only" role="status">
                Chargement des barbers…
              </span>
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-48 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
            >
              <p>{error}</p>
              <Button
                variant="secondary"
                className="mt-3 min-h-[44px]"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                Réessayer
              </Button>
            </div>
          ) : barbers.length === 0 ? (
            <Card className="mt-4 p-6 text-center">
              <p className="text-foreground-muted">
                Aucun barber à afficher pour le moment.
              </p>
              <Button
                className="mt-4 min-h-[44px]"
                onClick={() => navigate("/barbers")}
              >
                Rechercher un barber
              </Button>
            </Card>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((barber) => (
                <li key={barber.id}>
                  <BarberPreviewCard barber={barber} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {user ? (
          <section aria-labelledby="home-appointments-title">
            <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="home-appointments-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Vos rendez-vous
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  Retrouvez vos prochains rendez-vous et votre historique.
                </p>
              </div>
              <Button
                className="min-h-[44px] shrink-0"
                onClick={() => navigate("/appointments")}
              >
                Voir mes rendez-vous
              </Button>
            </Card>
          </section>
        ) : (
          <section
            aria-labelledby="home-join-title"
            className="grid gap-4 sm:grid-cols-2"
          >
            <h2 id="home-join-title" className="sr-only">
              Rejoindre FindBarber
            </h2>
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-lg font-semibold text-foreground">
                Réservez en toute simplicité
              </p>
              <p className="text-sm text-foreground-muted">
                Créez un compte pour réserver et suivre vos rendez-vous.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link to="/register" className={PRIMARY_LINK_CLASS}>
                  Créer un compte
                </Link>
                <Link to="/login" className={SECONDARY_LINK_CLASS}>
                  Se connecter
                </Link>
              </div>
            </Card>
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-lg font-semibold text-foreground">
                Vous êtes barber ?
              </p>
              <p className="text-sm text-foreground-muted">
                Présentez vos services, gérez vos horaires et recevez des
                réservations, au salon ou à domicile.
              </p>
              <div className="mt-auto">
                <Link
                  to="/register?role=BARBER"
                  className={SECONDARY_LINK_CLASS}
                >
                  Proposer mes services
                </Link>
              </div>
            </Card>
          </section>
        )}

        <section aria-labelledby="home-steps-title">
          <h2
            id="home-steps-title"
            className="text-xl font-semibold text-foreground"
          >
            Comment ça marche
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.title}>
                <Card className="h-full p-5">
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm text-foreground-muted">
                    {step.description}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {user && (
          <div className="flex justify-center pb-4">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => void handleLogout()}
            >
              Se déconnecter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
