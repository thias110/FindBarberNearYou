import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

// Abstraction minimale du stockage local (issue #8). Les chemins stockés en
// base sont relatifs à `UPLOAD_DIR` (ex. `avatars/<uuid>.webp`) et servis
// publiquement sous `/uploads/<path>`. Le nom de fichier est TOUJOURS généré
// côté serveur : aucun nom fourni par le client n'est utilisé.

export type UploadFolder = "avatars" | "gallery";

/** Répertoire racine absolu des uploads (créé à la demande lors du save). */
export function resolveUploadDir(): string {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

// Empêche toute remontée hors de la racine des uploads (défense en profondeur ;
// les chemins viennent de la base, jamais du client).
function resolveInsideRoot(relativePath: string): string {
  const root = resolveUploadDir();
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
    throw new Error(`Chemin d'upload invalide : ${relativePath}`);
  }
  return absolutePath;
}

/** Écrit un buffer WebP et retourne son chemin relatif public. */
export async function save(
  buffer: Buffer,
  folder: UploadFolder,
): Promise<string> {
  const relativePath = path.posix.join(folder, `${randomUUID()}.webp`);
  const absolutePath = resolveInsideRoot(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return relativePath;
}

/** Supprime un fichier uploadé (silencieux s'il a déjà disparu). */
export async function remove(relativePath: string): Promise<void> {
  if (!relativePath) return;
  await rm(resolveInsideRoot(relativePath), { force: true });
}

/** Construit l'URL publique relative servie par `/uploads`. */
export function publicUploadPath(relativePath: string): string {
  return `/uploads/${relativePath}`;
}
