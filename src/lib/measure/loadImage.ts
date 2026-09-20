// ── MaßWerk · Bild laden (JPG, PNG, BMP, GIF, WebP, TIFF) & Persistenz ──────
import type { Pt } from "./types";

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  name: string;
  /** komprimierte Kopie für die lokale Sitzung (kann null sein bei Riesenbildern) */
  storageDataUrl: string | null;
}

const MAX_STORAGE_DIM = 2600;

/** Dekodiert eine TIFF-Datei per UTIF (Browser unterstützen TIFF nicht nativ). */
async function decodeTiff(file: File): Promise<HTMLCanvasElement> {
  const UTIF = (await import("utif")).default;
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error("TIFF leer");
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const w = ifds[0].width as number;
  const h = ifds[0].height as number;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  return canvas;
}

function isTiff(file: File): boolean {
  return (
    file.type === "image/tiff" ||
    /\.tiff?$/i.test(file.name)
  );
}

/** Lädt eine Bilddatei in ein zeichenbares Objekt. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  let source: CanvasImageSource;
  let width = 0;
  let height = 0;

  if (isTiff(file)) {
    const canvas = await decodeTiff(file);
    source = canvas;
    width = canvas.width;
    height = canvas.height;
  } else {
    try {
      const bmp = await createImageBitmap(file);
      source = bmp;
      width = bmp.width;
      height = bmp.height;
    } catch {
      // Fallback für exotische Formate
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = () => rej(new Error("decode"));
          el.src = url;
        });
        source = img;
        width = img.naturalWidth;
        height = img.naturalHeight;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  return {
    source,
    width,
    height,
    name: file.name || "Bild",
    storageDataUrl: toStorageDataUrl(source, width, height),
  };
}

/** Komprimierte JPEG-Kopie für den LocalStorage (Sitzungs-Wiederherstellung). */
export function toStorageDataUrl(
  source: CanvasImageSource,
  w: number,
  h: number,
): string | null {
  const scale = Math.min(1, MAX_STORAGE_DIM / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, cw, ch);
  try {
    const url = canvas.toDataURL("image/jpeg", 0.82);
    // LocalStorage-Limit grob respektieren (~3,5 MB Payload)
    if (url.length > 3_500_000) return null;
    return url;
  } catch {
    return null;
  }
}

/** Stellt ein Bild aus einer gespeicherten Data-URL wieder her. */
export async function loadFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = () => rej(new Error("restore"));
    el.src = dataUrl;
  });
}

/** Liest eine Bild-Datei aus einem DataTransfer (Drop/Paste). Null wenn kein Bild. */
export function imageFileFromDataTransfer(dt: DataTransfer): File | null {
  const items = Array.from(dt.items ?? []);
  const imgItem = items.find((i) => i.kind === "file" && i.type.startsWith("image/"));
  if (imgItem) {
    const f = imgItem.getAsFile();
    if (f) return f;
  }
  const files = Array.from(dt.files ?? []);
  return (
    files.find(
      (f) =>
        f.type.startsWith("image/") ||
        /\.tiff?$/i.test(f.name) ||
        /\.masswerk$/i.test(f.name),
    ) ?? null
  );
}

export type { Pt };
