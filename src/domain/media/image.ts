/**
 * Image checks for uploads (brief §6.3, §12: "Validate file type and size; do not trust filename
 * extensions"). The type comes from the file's first bytes, never from its name or the browser's
 * declared type. SVG, GIF, HEIC and everything else are refused.
 */
import { MAX_IMAGE_BYTES } from "../restaurants/config";

export type SniffedImage =
  | { mime: "image/png"; ext: "png" }
  | { mime: "image/jpeg"; ext: "jpg" }
  | { mime: "image/webp"; ext: "webp" };

const at = (b: Uint8Array, offset: number, signature: readonly number[]) =>
  b.length >= offset + signature.length && signature.every((v, i) => b[offset + i] === v);

export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (at(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", ext: "png" };
  if (at(bytes, 0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  // "RIFF" ···· "WEBP"
  if (at(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && at(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export type ImageCheck = { ok: true; image: SniffedImage } | { ok: false; message: string };

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, message: "Choose an image to upload." };
  if (bytes.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: "That image is larger than 2 MB. Choose a smaller one or resize it.",
    };
  }
  const image = sniffImage(bytes);
  if (!image) {
    return {
      ok: false,
      message: "That file isn’t a PNG, JPEG or WebP image. Choose one of those and try again.",
    };
  }
  return { ok: true, image };
}
