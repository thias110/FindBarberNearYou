import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LIMITS, UPLOAD_IMAGE_MIME_TYPES } from "@findbarber/shared/constants";
import type { OwnBarberPhoto } from "@findbarber/shared/types";
import {
  ApiError,
  apiErrorMessage,
  barberApi,
  resolveUploadUrl,
  validateImageFile,
} from "../../lib/apiClient";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ProPageHeader } from "../../components/barber/ProPageHeader";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Champ fichier restylé via les variantes `file:` de Tailwind (même contrôle,
// même comportement d'upload).
const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-lg border border-border bg-surface text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export function BarberGalleryPage() {
  const [photos, setPhotos] = useState<OwnBarberPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OwnBarberPhoto | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfileMissing(false);
    barberApi
      .getPhotos()
      .then((res) => {
        if (!cancelled) setPhotos(res.photos);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 (session), 403 (rôle/CSRF) et 404 (profil) sont distingués.
        if (err instanceof ApiError && err.code === "BARBER_PROFILE_NOT_FOUND") {
          setProfileMissing(true);
        } else {
          setError(apiErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!file) {
      setMessage({ kind: "error", text: "Choisissez une image." });
      return;
    }
    const validation = validateImageFile(file);
    if (validation) {
      setMessage({ kind: "error", text: validation });
      return;
    }
    setUploading(true);
    try {
      await barberApi.addPhoto(file, caption);
      setFile(null);
      setCaption("");
      setMessage({ kind: "success", text: "Photo ajoutée." });
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      // 400 (format/légende), 409 (limite), 413 (taille) portés par le serveur.
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    const photo = pendingDelete;
    if (!photo) return;
    setDeletingId(photo.id);
    setMessage(null);
    try {
      await barberApi.deletePhoto(photo.id);
      setMessage({ kind: "success", text: "Photo supprimée." });
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  const limitReached = photos.length >= LIMITS.galleryMaxPhotos;
  const maxMegabytes = Math.round(LIMITS.uploadMaxBytes / 1_048_576);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <ProPageHeader
          title="Ma galerie"
          description="Photos de vos réalisations."
        />

        {loading ? (
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              Chargement de la galerie…
            </span>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </Card>
        ) : profileMissing ? (
          <Card className="p-6 text-center">
            <p className="text-foreground">
              Créez d'abord votre profil professionnel pour gérer votre galerie.
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              Créer mon profil
            </Link>
          </Card>
        ) : error ? (
          <Alert variant="danger">
            <p>{error}</p>
            <Button
              variant="secondary"
              className="mt-3 min-h-[44px]"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Réessayer
            </Button>
          </Alert>
        ) : (
          <>
            <Card className="p-6">
              <form
                onSubmit={(event) => void handleSubmit(event)}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">
                  Ajouter une photo
                </h2>
                <p className="text-sm text-foreground-muted">
                  {photos.length} / {LIMITS.galleryMaxPhotos} photos
                </p>

                <Field
                  label="Image"
                  hint={`JPEG, PNG ou WebP, ${maxMegabytes} Mo max.`}
                >
                  {(control) => (
                    <input
                      {...control}
                      type="file"
                      accept={UPLOAD_IMAGE_MIME_TYPES.join(",")}
                      disabled={uploading || limitReached}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                      className={FILE_INPUT_CLASS}
                    />
                  )}
                </Field>

                <Field label="Légende (facultative)">
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      value={caption}
                      maxLength={LIMITS.galleryCaption}
                      disabled={uploading || limitReached}
                      onChange={(event) => setCaption(event.target.value)}
                    />
                  )}
                </Field>

                {limitReached && (
                  <Alert variant="warning">
                    La limite de {LIMITS.galleryMaxPhotos} photos est atteinte.
                    Supprimez une photo pour en ajouter une autre.
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="min-h-[44px]"
                  isLoading={uploading}
                  disabled={uploading || limitReached}
                >
                  {uploading ? "Envoi…" : "Ajouter la photo"}
                </Button>
              </form>
            </Card>

            {message && (
              <Alert
                variant={message.kind === "success" ? "success" : "danger"}
              >
                {message.text}
              </Alert>
            )}

            {photos.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-foreground-muted">
                  Aucune photo pour le moment.
                </p>
              </Card>
            ) : (
              // Grille responsive, sans carrousel.
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <li key={photo.id}>
                    <Card className="overflow-hidden">
                      <img
                        src={resolveUploadUrl(photo.imagePath) ?? ""}
                        alt={photo.caption ?? "Photo de galerie"}
                        loading="lazy"
                        className="h-40 w-full object-cover"
                      />
                      <div className="space-y-2 p-3">
                        {photo.caption && (
                          <p className="text-sm text-foreground">
                            {photo.caption}
                          </p>
                        )}
                        <Button
                          variant="danger"
                          className="min-h-[44px]"
                          disabled={deletingId === photo.id}
                          isLoading={deletingId === photo.id}
                          onClick={() => setPendingDelete(photo)}
                        >
                          {deletingId === photo.id ? "Suppression…" : "Supprimer"}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer cette photo ?"
        confirmLabel="Supprimer"
        tone="danger"
        isLoading={deletingId !== null}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      >
        <p>Elle sera retirée de votre profil public.</p>
      </ConfirmDialog>
    </div>
  );
}
