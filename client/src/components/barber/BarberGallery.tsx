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
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground">Galerie</h2>

      {loading ? (
        <div
          aria-busy="true"
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <span className="sr-only" role="status">
            Chargement de la galerie…
          </span>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 w-full rounded-xl" />
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
            Réessayer
          </Button>
        </Alert>
      ) : photos.length === 0 ? (
        <p className="mt-2 text-foreground-muted">
          Aucune photo pour le moment.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-xl bg-surface-muted"
            >
              <img
                src={resolveUploadUrl(photo.imagePath) ?? ""}
                alt={photo.caption ?? "Photo de réalisation"}
                loading="lazy"
                className="h-40 w-full object-cover"
              />
              {photo.caption && (
                <p className="p-2 text-xs text-foreground-muted">
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
