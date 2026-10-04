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

  async function handleDelete(photo: OwnBarberPhoto) {
    if (!window.confirm("Supprimer cette photo ?")) return;
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
    }
  }

  const limitReached = photos.length >= LIMITS.galleryMaxPhotos;
  const maxMegabytes = Math.round(LIMITS.uploadMaxBytes / 1_048_576);

  return (
    <div className="min-h-screen bg-brand-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Ma galerie</h1>
          <p className="mt-1 text-sm text-gray-600">
            <Link to="/pro/dashboard" className="text-brand-700 underline">
              Retour au tableau de bord
            </Link>
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-gray-500">
            Chargement…
          </div>
        ) : profileMissing ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-gray-700">
              Créez d'abord votre profil professionnel pour gérer votre galerie.
            </p>
            <Link
              to="/pro/profile"
              className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white"
            >
              Créer mon profil
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 rounded-lg border border-brand-700 px-3 py-1 text-brand-700"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-3 rounded-2xl bg-white p-6 shadow"
            >
              <h2 className="font-semibold text-brand-900">
                Ajouter une photo
              </h2>
              <p className="text-sm text-gray-600">
                {photos.length} / {LIMITS.galleryMaxPhotos} photos · JPEG, PNG
                ou WebP, {maxMegabytes} Mo max.
              </p>

              <label className="block text-sm text-gray-700">
                Image
                <input
                  type="file"
                  accept={UPLOAD_IMAGE_MIME_TYPES.join(",")}
                  disabled={uploading || limitReached}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-1 block w-full text-sm"
                />
              </label>

              <label className="block text-sm text-gray-700">
                Légende (facultative)
                <input
                  type="text"
                  value={caption}
                  maxLength={LIMITS.galleryCaption}
                  disabled={uploading || limitReached}
                  onChange={(event) => setCaption(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              {limitReached && (
                <p className="text-sm text-amber-700">
                  La limite de {LIMITS.galleryMaxPhotos} photos est atteinte.
                  Supprimez une photo pour en ajouter une autre.
                </p>
              )}

              <button
                type="submit"
                disabled={uploading || limitReached}
                className="rounded-lg bg-brand-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {uploading ? "Envoi…" : "Ajouter la photo"}
              </button>
            </form>

            {message && (
              <p
                className={`rounded-lg p-3 text-sm ${
                  message.kind === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </p>
            )}

            {photos.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-gray-600">
                Aucune photo pour le moment.
              </div>
            ) : (
              // Grille responsive, sans carrousel.
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="overflow-hidden rounded-xl bg-white shadow"
                  >
                    <img
                      src={resolveUploadUrl(photo.imagePath) ?? ""}
                      alt={photo.caption ?? "Photo de galerie"}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                    <div className="space-y-2 p-3">
                      {photo.caption && (
                        <p className="text-sm text-gray-700">{photo.caption}</p>
                      )}
                      <button
                        type="button"
                        disabled={deletingId === photo.id}
                        onClick={() => void handleDelete(photo)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
                      >
                        {deletingId === photo.id ? "Suppression…" : "Supprimer"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
