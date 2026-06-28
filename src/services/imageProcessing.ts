export type ProcessedImage = {
  file: File;
  previewUrl: string; // object URL — revogue após uso com URL.revokeObjectURL
  originalBytes: number;
  processedBytes: number;
  width: number;
  height: number;
};

const MAX_DIM = 1200;
const WEBP_QUALITY = 0.85;
const MAX_INPUT_BYTES = 20 * 1024 * 1024; // 20 MB

// MIME types aceitos — validados por conteúdo no backend, por tipo aqui no cliente
const ACCEPTED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif", "image/avif",
  "", // HEIC/HEIF em alguns browsers retorna string vazia
]);

export async function processToWebP(source: File): Promise<ProcessedImage> {
  if (source.size > MAX_INPUT_BYTES) {
    throw new Error(
      `Arquivo muito grande (${fmtBytes(source.size)}). Limite: ${fmtBytes(MAX_INPUT_BYTES)}.`
    );
  }
  if (!ACCEPTED_TYPES.has(source.type)) {
    throw new Error(`Tipo de arquivo não suportado: ${source.type || "desconhecido"}.`);
  }

  const originalBytes = source.size;
  const img = await decodeImage(source);

  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não disponível neste navegador.");

  // Fundo branco para imagens com transparência (PNG → WebP)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  const file = new File([blob], "produto.webp", { type: "image/webp" });
  const previewUrl = URL.createObjectURL(file);

  return {
    file,
    previewUrl,
    originalBytes,
    processedBytes: file.size,
    width: w,
    height: h,
  };
}

function decodeImage(source: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler esta imagem."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Falha ao converter canvas para blob.")),
      type,
      quality
    );
  });
}

// ── Utilitários de formatação ────────────────────────────────────────────────

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

export function savingPct(original: number, processed: number): number {
  return Math.max(0, Math.round((1 - processed / original) * 100));
}
