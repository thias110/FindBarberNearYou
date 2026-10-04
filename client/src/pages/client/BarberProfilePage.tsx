import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  BarberReviewsResponse,
  PublicBarberProfileWithServices,
} from "@findbarber/shared/types";
import { COUNTRY_NAME_BY_CODE } from "@findbarber/shared/countries";
import {
  APPROXIMATE_LOCATION_LABEL,
  AUDIENCE_LABELS,
  SERVICE_PLACE_LABELS,
  TECHNIQUE_LABELS,
} from "@findbarber/shared/constants";
import { barbersApi } from "../../lib/apiClient";
import { formatCurrency, formatDateTime, formatDuration } from "../../lib/formatters";
import { BookingForm } from "../../components/BookingForm";

export function PublicBarberProfilePage() {
  const { barberId } = useParams();
  const [data, setData] = useState<PublicBarberProfileWithServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<BarberReviewsResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsReload, setReviewsReload] = useState(0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-center text-gray-500">
        Chargement…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-50 p-8 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">
          Profil introuvable
        </h1>
        <p className="mt-2 text-gray-600">
          {error ?? "Ce profil n'existe pas ou n'est plus disponible."}
        </p>
      </div>
    );
  }

  const { profile, services } = data;
  const countryName = COUNTRY_NAME_BY_CODE[profile.countryCode] ?? profile.countryCode;

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-brand-900">
            {profile.displayName}
          </h1>
          <p className="mt-2 whitespace-pre-line text-gray-700">
            {profile.description}
          </p>
          <p className="mt-4 text-sm text-gray-600">
            {profile.postalCode ? `${profile.postalCode}, ` : ""}
            {profile.city}, {countryName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.places.length === 0 ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Lieux non renseignés
              </span>
            ) : (
              profile.places.map((place) => (
                <span
                  key={place}
                  className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800"
                >
                  {SERVICE_PLACE_LABELS[place]}
                </span>
              ))
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {APPROXIMATE_LOCATION_LABEL}
          </p>
        </section>

        {services.length > 0 && profile.places.length > 0 ? (
          <BookingForm
            barberId={profile.id}
            profile={profile}
            services={services}
          />
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="font-semibold text-brand-900">Réservation</h2>
            <p className="mt-2 text-gray-600">
              {services.length === 0
                ? "Ce professionnel ne propose pas encore de service à réserver."
                : "Ce professionnel n'a pas encore renseigné ses lieux de prestation."}
            </p>
          </section>
        )}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="font-semibold text-brand-900">Services</h2>
          {services.length === 0 ? (
            <p className="mt-2 text-gray-600">Aucun service pour le moment.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {services.map((service) => (
                <li key={service.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-900">{service.name}</p>
                      {service.description && (
                        <p className="mt-1 text-sm text-gray-600">
                          {service.description}
                        </p>
                      )}
                      {(service.audiences.length > 0 ||
                        service.techniques.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {service.audiences.map((code) => (
                            <span
                              key={code}
                              className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800"
                            >
                              {AUDIENCE_LABELS[code]}
                            </span>
                          ))}
                          {service.techniques.map((code) => (
                            <span
                              key={code}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {TECHNIQUE_LABELS[code]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="whitespace-nowrap text-right text-sm text-gray-700">
                      <span className="font-semibold">
                        {formatCurrency(service.priceMinor, profile.currency)}
                      </span>
                      <br />
                      {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="font-semibold text-brand-900">Avis</h2>
          {reviewsLoading ? (
            <p className="mt-2 text-gray-600">Chargement des avis…</p>
          ) : reviewsError ? (
            <div className="mt-2">
              <p className="text-sm text-red-700">{reviewsError}</p>
              <button
                type="button"
                onClick={() => setReviewsReload((n) => n + 1)}
                className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
              >
                Réessayer
              </button>
            </div>
          ) : reviews && reviews.reviews.length === 0 ? (
            <p className="mt-2 text-gray-600">Aucun avis pour le moment.</p>
          ) : reviews ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-700">
                Note moyenne :{" "}
                <span className="font-semibold">
                  {reviews.summary.averageRating === null
                    ? "—"
                    : `${reviews.summary.averageRating}/5`}
                </span>{" "}
                ({reviews.summary.totalReviews} avis)
              </p>
              <ul className="divide-y divide-gray-100">
                {reviews.reviews.map((review) => (
                  <li key={review.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-900">
                        {review.clientName ?? "Client"}
                      </p>
                      <p className="text-sm text-gray-700">
                        {review.rating}/5
                      </p>
                    </div>
                    {review.comment && (
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
                        {review.comment}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDateTime(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
