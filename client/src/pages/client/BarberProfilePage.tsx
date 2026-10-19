import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import type {
  BarberReviewsResponse,
  PublicBarberPhoto,
  PublicBarberProfileWithServices,
} from "@findbarber/shared/types";
import i18n from "../../i18n";
import { apiErrorMessage, barbersApi } from "../../lib/apiClient";
import { useScrollToHash } from "../../lib/useScrollToHash";
import { BookingFlow } from "../../components/booking/BookingFlow";
import { BarberProfileHeader } from "../../components/barber/BarberProfileHeader";
import { BarberServices } from "../../components/barber/BarberServices";
import { BarberGallery } from "../../components/barber/BarberGallery";
import { BarberReviews } from "../../components/barber/BarberReviews";
import { BarberWeeklyHours } from "../../components/barber/BarberWeeklyHours";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageContainer } from "../../components/ui/PageContainer";

export function PublicBarberProfilePage() {
  const { t } = useTranslation("client");
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
      setError(i18n.t("client:profile.notFoundMessage"));
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
          setError(
            err instanceof Error
              ? err.message
              : i18n.t("client:profile.notFoundMessage"),
          );
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
              : i18n.t("client:profile.reviewsError"),
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
        <PageContainer width="wide" aria-busy="true">
          <span className="sr-only" role="status">
            {t("profile.loading")}
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
        </PageContainer>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
          {t("profile.notFoundTitle")}
        </h1>
        <p className="mt-2 text-foreground-muted">
          {error ?? t("profile.unavailable")}
        </p>
      </div>
    );
  }

  const { profile, services } = data;

  const bookingPanel =
    services.length > 0 && profile.places.length > 0 ? (
      <BookingFlow
        barberId={profile.id}
        profile={profile}
        services={services}
      />
    ) : (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-foreground">{t("profile.booking")}</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {services.length === 0
            ? t("profile.noServices")
            : t("profile.noPlaces")}
        </p>
      </Card>
    );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <PageContainer width="wide" stack="md">
        <BarberProfileHeader
          profile={profile}
          averageRating={reviews?.summary.averageRating ?? null}
          totalReviews={reviews?.summary.totalReviews ?? 0}
        />

        {/* Le tunnel de réservation (grille de la semaine + récapitulatif de
            320 px) a besoin de toute la largeur de la fiche : il passe sous
            l'en-tête, avant le détail du profil. */}
        <aside
          id="reserver"
          aria-label={t("profile.booking")}
          className="min-w-0 scroll-mt-24 focus:outline-none"
        >
          {bookingPanel}
        </aside>

        <div className="min-w-0 space-y-6">
          <BarberServices profile={profile} services={services} />
          <BarberWeeklyHours hours={data.weeklyHours} />
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
      </PageContainer>
    </div>
  );
}
