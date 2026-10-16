import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
import { buttonClasses } from "../../components/ui/buttonStyles";
import { PageContainer } from "../../components/ui/PageContainer";

// Lien stylé comme le bouton primaire du design system (aucun `ButtonLink`).
const PRIMARY_LINK_CLASS = buttonClasses("primary");

// Champ fichier restylé via les variantes `file:` de Tailwind (même contrôle,
// même comportement d'upload).
const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-xl border border-border-strong bg-surface text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground hover:file:bg-accent-hover focus-ring disabled:cursor-not-allowed disabled:opacity-50";

export function BarberGalleryPage() {
  const { t } = useTranslation("barber");
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
      setMessage({ kind: "error", text: t("gallery.chooseImage") });
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
      setMessage({ kind: "success", text: t("gallery.added") });
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
      setMessage({ kind: "success", text: t("gallery.deleted") });
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
      <PageContainer width="wide">
        <ProPageHeader
          title={t("gallery.title")}
          description={t("gallery.description")}
        />

        {loading ? (
          <Card className="space-y-4 p-6" aria-busy="true">
            <span className="sr-only" role="status">
              {t("gallery.loading")}
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
              {t("gallery.profileMissing")}
            </p>
            <Link to="/pro/profile" className={`${PRIMARY_LINK_CLASS} mt-4`}>
              {t("common.createProfile")}
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
              {t("common.retry")}
            </Button>
          </Alert>
        ) : (
          <>
            <Card className="p-6">
              <form
                onSubmit={(event) => void handleSubmit(event)}
                className="space-y-4"
              >
                <h2 className="text-lg font-bold text-foreground">
                  {t("gallery.form.title")}
                </h2>
                <p className="text-sm text-foreground-muted">
                  {t("gallery.form.count", {
                    count: photos.length,
                    max: LIMITS.galleryMaxPhotos,
                  })}
                </p>

                <Field
                  label={t("gallery.form.imageLabel")}
                  hint={t("gallery.form.imageHint", { max: maxMegabytes })}
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

                <Field label={t("gallery.form.captionLabel")}>
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
                    {t("gallery.form.limitReached", {
                      max: LIMITS.galleryMaxPhotos,
                    })}
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="min-h-[44px]"
                  isLoading={uploading}
                  disabled={uploading || limitReached}
                >
                  {uploading
                    ? t("gallery.form.uploading")
                    : t("gallery.form.submit")}
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
                  {t("gallery.empty")}
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
                        alt={photo.caption ?? t("gallery.photoAlt")}
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
                          {deletingId === photo.id
                            ? t("gallery.deleting")
                            : t("gallery.delete")}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </PageContainer>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("gallery.confirm.title")}
        confirmLabel={t("gallery.delete")}
        tone="danger"
        isLoading={deletingId !== null}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      >
        <p>{t("gallery.confirm.body")}</p>
      </ConfirmDialog>
    </div>
  );
}
