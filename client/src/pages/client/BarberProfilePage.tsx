import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  BarberReviewsResponse,
  PublicBarberPhoto,
  PublicBarberProfileWithServices,
} from "@findbarber/shared/types";
import { apiErrorMessage, barbersApi } from "../../lib/apiClient";
import { useScrollToHash } from "../../lib/useScrollToHash";
import { BookingForm } from "../../components/BookingForm";
import { BarberProfileHeader } from "../../components/barber/BarberProfileHeader";
import { BarberServices } from "../../components/barber/BarberServices";
import { BarberGallery } from "../../components/barber/BarberGallery";
import { BarberReviews } from "../../components/barber/BarberReviews";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";

export function PublicBarberProfilePage() {
  const { barberId } = useParams();
  const [data, setData] = useState<PublicBarberProfileWithServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<BarberReviewsResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsReload, setReviewsReload] = useState(0);

  const [photos, setPhotos] = useState<PublicBarberPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [photosReload, setPhotosReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!barberId) {
      setError("Profil introuvable.");
      setLoading(false);
      return;
    }
    barbersApi
      .getProfile(barberId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Profil introuvable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId]);

  useEffect(() => {
    let cancelled = false;
    if (!barberId) {
      setReviewsLoading(false);
      return;
    }
    setReviewsLoading(true);
    setReviewsError(null);
    barbersApi
      .getReviews(barberId, { page: 1, pageSize: 5 })
      .then((res) => {
        if (!cancelled) setReviews(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReviewsError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les avis.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId, reviewsReload]);

  useEffect(() => {
    let cancelled = false;
    if (!barberId) {
      setPhotosLoading(false);
      return;
    }
    setPhotosLoading(true);
    setPhotosError(null);
    barbersApi
      .getPhotos(barberId)
      .then((res) => {
        if (!cancelled) setPhotos(res.photos);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPhotosError(apiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barberId, photosReload]);

  // « Réserver » depuis la fiche de la carte (issue #53) : `#reserver` amène
  // le formulaire de réservation en vue une fois le profil chargé.
  useScrollToHash(!loading && data !== null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-6" aria-busy="true">
          <span className="sr-only" role="status">
            Chargement du profil…
          </span>
          <Card className="flex items-center gap-4 p-6">
            <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="space-y-3 p-6 lg:col-span-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
            <Card className="space-y-3 p-6">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          Profil introuvable
        </h1>
        <p className="mt-2 text-foreground-muted">
          {error ?? "Ce profil n'existe pas ou n'est plus disponible."}
        </p>
      </div>
    );
  }

  const { profile, services } = data;

  const bookingPanel =
    services.length > 0 && profile.places.length > 0 ? (
      <BookingForm
        barberId={profile.id}
        profile={profile}
        services={services}
      />
    ) : (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-foreground">Réservation</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {services.length === 0
            ? "Ce professionnel ne propose pas encore de service à réserver."
            : "Ce professionnel n'a pas encore renseigné ses lieux de prestation."}
        </p>
      </Card>
    );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <BarberProfileHeader
              profile={profile}
              averageRating={reviews?.summary.averageRating ?? null}
              totalReviews={reviews?.summary.totalReviews ?? 0}
            />
          </div>

          {/* Mobile : la réservation vient juste après l'en-tête.
              Desktop : colonne droite sticky (≈ un tiers de la largeur). */}
          <aside
            id="reserver"
            aria-label="Réservation"
            className="min-w-0 focus:outline-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-6"
          >
            {bookingPanel}
          </aside>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
            <BarberServices profile={profile} services={services} />
            <BarberGallery
              photos={photos}
              loading={photosLoading}
              error={photosError}
              onRetry={() => setPhotosReload((n) => n + 1)}
            />
            <BarberReviews
              summary={reviews?.summary ?? null}
              reviews={reviews?.reviews ?? []}
              loading={reviewsLoading}
              error={reviewsError}
              onRetry={() => setReviewsReload((n) => n + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
