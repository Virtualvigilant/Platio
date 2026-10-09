import { describe, expect, it } from "vitest";
import { checkImage, sniffImage } from "./image";

const bytes = (...values: number[]) => new Uint8Array(values);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50);
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const GIF = new TextEncoder().encode("GIF89a....");

describe("sniffImage", () => {
  it("recognizes PNG, JPEG and WebP by their first bytes", () => {
    expect(sniffImage(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImage(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImage(WEBP)).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("refuses SVG, GIF, RIFF files that aren't WebP, and truncated headers", () => {
    expect(sniffImage(SVG)).toBeNull();
    expect(sniffImage(GIF)).toBeNull();
    expect(
      sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20)),
    ).toBeNull();
    expect(sniffImage(bytes(0x89, 0x50))).toBeNull();
  });
});

describe("checkImage", () => {
  it("explains empty, oversized and wrong-type files", () => {
    expect(checkImage(new Uint8Array())).toMatchObject({
      ok: false,
      message: "Choose an image to upload.",
    });
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    expect(checkImage(big)).toMatchObject({ ok: false, message: expect.stringMatching(/2 MB/) });
    expect(checkImage(SVG)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/PNG, JPEG or WebP/),
    });
    expect(checkImage(PNG)).toEqual({ ok: true, image: { mime: "image/png", ext: "png" } });
  });
});
