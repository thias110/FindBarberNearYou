// Traitement des images envoyées (audit de sécurité) : seuls les vrais JPEG,
// PNG et WebP sont décodés, quel que soit le type annoncé par le navigateur,
// et la taille en pixels est bornée avant décodage (« bombe » de
// décompression : un petit fichier qui occupe des centaines de Mo en mémoire).
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { LIMITS } from "@findbarber/shared/constants";
import { toAvatarWebp, toGalleryWebp } from "../../server/src/lib/images";

function solid(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  });
}

describe("traitement des images", () => {
  it("convertit un JPEG, un PNG et un WebP ordinaires", async () => {
    for (const image of [
      await solid(800, 600).jpeg().toBuffer(),
      await solid(800, 600).png().toBuffer(),
      await solid(800, 600).webp().toBuffer(),
    ]) {
      const out = await toGalleryWebp(image);
      expect((await sharp(out).metadata()).format).toBe("webp");
    }
  });

  it("refuse un SVG, même présenté comme une image PNG", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(toAvatarWebp(svg)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });

  it("refuse une image trop grande en pixels sans la décoder", async () => {
    const side = Math.ceil(Math.sqrt(LIMITS.imageMaxInputPixels)) + 1;
    // Une couleur unie se compresse très bien : le fichier reste petit.
    const bomb = await solid(side, side).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(LIMITS.uploadMaxBytes);
    await expect(toGalleryWebp(bomb)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });
});
