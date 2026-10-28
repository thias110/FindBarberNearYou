import { useTranslation } from "react-i18next";
import type { PublicBarberPhoto } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

interface BarberGalleryProps {
  photos: PublicBarberPhoto[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

// Grille responsive uniquement : aucun carrousel, aucune lightbox.
export function BarberGallery({
  photos,
  loading,
  error,
  onRetry,
}: BarberGalleryProps) {
  const { t } = useTranslation("barber");
  return (
    <Card className="rounded-3xl border-border/80 p-6 shadow-card-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3 font-bold text-foreground">{t("public.gallery.title")}</h2>
        {!loading && photos.length > 0 && (
          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground-muted">
            {photos.length}
          </span>
        )}
      </div>

      {loading ? (
        <div
          aria-busy="true"
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <span className="sr-only" role="status">
            {t("public.gallery.loading")}
          </span>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="danger" className="mt-3">
          <p>{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 min-h-[44px]"
            onClick={onRetry}
          >
            {t("common.retry")}
          </Button>
        </Alert>
      ) : photos.length === 0 ? (
        <p className="mt-2 text-foreground-muted">
          {t("public.gallery.empty")}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="group overflow-hidden rounded-2xl border border-border/80 bg-surface-muted shadow-1"
            >
              <div className="overflow-hidden">
                <img
                  src={resolveUploadUrl(photo.imagePath) ?? ""}
                  alt={photo.caption ?? t("public.gallery.photoAlt")}
                  loading="lazy"
                  className="h-44 w-full object-cover transition-transform duration-slow ease-out motion-safe:group-hover:scale-105"
                />
              </div>
              {photo.caption && (
                <p className="border-t border-border/60 bg-surface px-3 py-2 text-xs font-medium text-foreground-muted">
                  {photo.caption}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
