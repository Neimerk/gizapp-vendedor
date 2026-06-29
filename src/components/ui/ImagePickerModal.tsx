import { useEffect, useRef, useState } from "react";
import {
  Camera,
  FolderOpen,
  X,
  Search,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ImageIcon,
  Link,
} from "lucide-react";

import {
  getCatalogProducts,
  getWorkerImages,
  uploadProductImage,
  getProductImageUrl,
  type CatalogProduct,
} from "../../services/gizApi";
import {
  processToWebP,
  fmtBytes,
  savingPct,
  type ProcessedImage,
} from "../../services/imageProcessing";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "upload" | "url" | "bank";

type UploadState =
  | { phase: "idle" }
  | { phase: "processing" }
  | { phase: "ready"; result: ProcessedImage }
  | { phase: "uploading" }
  | { phase: "error"; message: string };

export type CatalogImageMeta = {
  name?: string;
  brand?: string;
  description?: string;
};

type Props = {
  productName: string;
  currentImageUrl?: string;
  defaultTab?: Tab;
  onConfirm: (imageUrl: string, imageAlt?: string, catalogMeta?: CatalogImageMeta) => void;
  onClose: () => void;
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ImagePickerModal({
  productName,
  currentImageUrl,
  defaultTab = "upload",
  onConfirm,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  // upload tab
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // bank tab
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bankLoaded = useRef(false);

  useEffect(() => {
    if (tab !== "bank") return;
    if (bankLoaded.current) return;
    bankLoaded.current = true;
    loadCatalog("");
  }, [tab]);

  useEffect(() => {
    if (tab !== "bank" || !bankLoaded.current) return;
    const t = setTimeout(() => loadCatalog(search), 380);
    return () => clearTimeout(t);
  }, [search, tab]);

  useEffect(() => {
    return () => {
      if (upload.phase === "ready") URL.revokeObjectURL(upload.result.previewUrl);
    };
  }, []);

  async function loadCatalog(q: string) {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      // Busca ambas as fontes em paralelo para garantir que imagens do worker
      // (URL completa e válida) sempre apareçam, mesmo que o catálogo da API
      // tenha imageUrls de CDNs externos que possam estar inacessíveis.
      const [workerResult, catalogResult] = await Promise.allSettled([
        getWorkerImages(q),
        getCatalogProducts(q),
      ]);

      const workerItems =
        workerResult.status === "fulfilled" ? workerResult.value : [];

      // Inclui itens do catálogo com qualquer URL absoluta (worker ou gizapp-api).
      // Exclui apenas paths relativos que não resolvem para uma imagem válida.
      const catalogItems =
        catalogResult.status === "fulfilled"
          ? catalogResult.value.filter((p) => p.imageUrl?.startsWith("http"))
          : [];

      // Merge sem duplicatas (por imageUrl)
      const seenUrls = new Set<string>();
      const merged: CatalogProduct[] = [];
      for (const item of [...catalogItems, ...workerItems]) {
        if (item.imageUrl && !seenUrls.has(item.imageUrl)) {
          seenUrls.add(item.imageUrl);
          merged.push(item);
        }
      }

      if (merged.length > 0) {
        setCatalog(merged);
      } else {
        const err =
          workerResult.status === "rejected" ? workerResult.reason : null;
        if (err) {
          setCatalogError(
            err instanceof Error ? err.message : "Erro ao carregar banco de imagens."
          );
        }
        setCatalog([]);
      }
    } finally {
      setCatalogLoading(false);
    }
  }

  async function handleFileChosen(file: File) {
    if (upload.phase === "ready") URL.revokeObjectURL(upload.result.previewUrl);
    setUpload({ phase: "processing" });
    try {
      const result = await processToWebP(file);
      setUpload({ phase: "ready", result });
    } catch (e) {
      setUpload({
        phase: "error",
        message: e instanceof Error ? e.message : "Erro ao processar imagem.",
      });
    }
  }

  async function handleConfirmUpload() {
    if (upload.phase !== "ready") return;
    const { result } = upload;
    setUpload({ phase: "uploading" });
    try {
      const url = await uploadProductImage(result.file);
      URL.revokeObjectURL(result.previewUrl);
      onConfirm(url);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Erro ao enviar imagem.";
      const msg = raw === "Failed to fetch"
        ? "Servidor indisponível. O serviço pode estar inicializando — aguarde alguns segundos e clique em Tentar novamente."
        : raw;
      setUpload({ phase: "error", message: msg });
    }
  }

  async function handleConfirmBank() {
    if (!selected?.imageUrl) return;
    setConfirming(true);
    try {
      onConfirm(selected.imageUrl, selected.imageAlt || undefined, {
        name: selected.name,
        brand: selected.brand,
        description: selected.description,
      });
    } finally {
      setConfirming(false);
    }
  }

  function resetUpload() {
    if (upload.phase === "ready") URL.revokeObjectURL(upload.result.previewUrl);
    setUpload({ phase: "idle" });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-black text-[#0f172a]">Imagem do produto</h2>
            <p className="mt-0.5 truncate text-xs text-[#64748b]">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] transition-colors hover:bg-[#e2e8f0]"
          >
            <X size={17} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-[#e2e8f0] px-6">
          {(
            [
              { key: "upload" as Tab, icon: Camera,     label: "Upload"          },
              { key: "url"    as Tab, icon: Link,       label: "URL"             },
              { key: "bank"   as Tab, icon: ImageIcon,  label: "Banco de imagens" },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-black transition-colors ${
                tab === t.key
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-[#94a3b8] hover:text-[#64748b]"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content — bank tab gerencia seu próprio scroll interno */}
        <div className={`min-h-0 flex-1 ${tab === "bank" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
          {tab === "upload" ? (
            <UploadTab
              upload={upload}
              cameraRef={cameraRef}
              fileRef={fileRef}
              currentImageUrl={currentImageUrl}
              onFileChosen={handleFileChosen}
              onReset={resetUpload}
              onConfirm={handleConfirmUpload}
              onSwitchToUrl={() => setTab("url")}
            />
          ) : tab === "url" ? (
            <UrlTab onConfirm={onConfirm} />
          ) : (
            <BankTab
              catalog={catalog}
              loading={catalogLoading}
              error={catalogError}
              search={search}
              onSearch={(q) => { setSearch(q); setSelected(null); }}
              onRetry={() => loadCatalog(search)}
              selected={selected}
              onSelect={setSelected}
              confirming={confirming}
              onConfirm={handleConfirmBank}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload tab ────────────────────────────────────────────────────────────────

function UploadTab({
  upload,
  cameraRef,
  fileRef,
  currentImageUrl,
  onFileChosen,
  onReset,
  onConfirm,
  onSwitchToUrl,
}: {
  upload: UploadState;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  currentImageUrl?: string;
  onFileChosen: (f: File) => void;
  onReset: () => void;
  onConfirm: () => void;
  onSwitchToUrl: () => void;
}) {
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onFileChosen(f);
    e.target.value = "";
  }

  return (
    <div className="p-6 space-y-5">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />
      <input ref={fileRef} type="file" accept="image/*, .heic, .heif" className="hidden" onChange={handleInput} />

      {upload.phase === "idle" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#16a34a]/30 bg-[#f0fdf4] p-6 transition-colors hover:border-[#16a34a] hover:bg-[#dcfce7] active:scale-[0.98]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16a34a]">
                <Camera size={26} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-[#0f172a]">Tirar foto</p>
                <p className="mt-0.5 text-[11px] text-[#64748b]">Abre a câmera do dispositivo</p>
              </div>
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] p-6 transition-colors hover:border-[#64748b] hover:bg-[#f1f5f9] active:scale-[0.98]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f172a]">
                <FolderOpen size={26} className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-[#0f172a]">Escolher arquivo</p>
                <p className="mt-0.5 text-[11px] text-[#64748b]">JPG, PNG, WebP, HEIC…</p>
              </div>
            </button>
          </div>

          {currentImageUrl && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <img
                src={getProductImageUrl(currentImageUrl)}
                alt="Imagem atual"
                className="h-14 w-14 rounded-xl object-cover"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }}
              />
              <div>
                <p className="text-xs font-black text-[#0f172a]">Imagem atual</p>
                <p className="text-[11px] text-[#64748b]">Selecione acima para substituir</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <p className="text-[11px] font-bold text-[#64748b]">
              🔧 <span className="font-black text-[#0f172a]">Processamento automático:</span>{" "}
              imagens são redimensionadas para até 1200×1200 px e convertidas para WebP antes de salvar.
            </p>
          </div>
        </>
      )}

      {upload.phase === "processing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0fdf4]">
            <RefreshCw size={28} className="animate-spin text-[#16a34a]" />
          </div>
          <div className="text-center">
            <p className="font-black text-[#0f172a]">Processando imagem…</p>
            <p className="mt-1 text-xs text-[#64748b]">Redimensionando e convertendo para WebP</p>
          </div>
        </div>
      )}

      {upload.phase === "ready" && (
        <ReadyPanel result={upload.result} onConfirm={onConfirm} onReplace={() => fileRef.current?.click()} />
      )}

      {upload.phase === "uploading" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#16a34a]/10">
            <RefreshCw size={28} className="animate-spin text-[#16a34a]" />
          </div>
          <div className="text-center">
            <p className="font-black text-[#0f172a]">Enviando imagem…</p>
            <p className="mt-1 text-xs text-[#64748b]">Aguarde, estamos salvando sua foto</p>
          </div>
        </div>
      )}

      {upload.phase === "error" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <div className="text-center px-4">
            <p className="font-black text-[#0f172a]">Falha no envio</p>
            <p className="mt-1 text-sm text-[#64748b]">{upload.message}</p>
          </div>
          <div className="flex flex-col gap-2 w-full px-6">
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-black text-[#64748b] hover:bg-[#f8fafc]"
            >
              <RotateCcw size={14} />
              Tentar novamente
            </button>
            <button
              onClick={onSwitchToUrl}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25"
            >
              <Link size={14} />
              Usar URL de imagem (alternativa)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ready panel ───────────────────────────────────────────────────────────────

function ReadyPanel({ result, onConfirm, onReplace }: { result: ProcessedImage; onConfirm: () => void; onReplace: () => void }) {
  const saving = savingPct(result.originalBytes, result.processedBytes);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
        <img src={result.previewUrl} alt="Prévia" className="mx-auto block max-h-64 w-full object-contain" />
      </div>
      <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Processamento</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatCell label="Original" value={fmtBytes(result.originalBytes)} />
          <div className="flex items-center justify-center"><ArrowRight size={16} className="text-[#16a34a]" /></div>
          <StatCell label="WebP final" value={fmtBytes(result.processedBytes)} accent />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f0fdf4] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-[#16a34a]" />
            <span className="text-xs font-black text-[#16a34a]">{result.width} × {result.height} px · WebP</span>
          </div>
          {saving > 0 && (
            <span className="rounded-full bg-[#16a34a] px-2 py-0.5 text-[10px] font-black text-white">-{saving}% menor</span>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onReplace} className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-black text-[#64748b]">
          <RotateCcw size={14} /> Trocar
        </button>
        <button onClick={onConfirm} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25">
          <CheckCircle2 size={16} /> Usar esta imagem
        </button>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${accent ? "text-[#16a34a]" : "text-[#0f172a]"}`}>{value}</p>
    </div>
  );
}

// ── URL tab ───────────────────────────────────────────────────────────────────

function UrlTab({ onConfirm }: { onConfirm: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);

  const trimmed = url.trim();
  const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
          URL da imagem
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setPreviewOk(null); }}
              placeholder="https://exemplo.com/imagem.jpg"
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-3 pl-9 pr-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
            />
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-[#94a3b8]">
          Cole o link direto de qualquer imagem pública (JPG, PNG, WebP…)
        </p>
      </div>

      {/* Preview */}
      {isUrl && (
        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
          {previewOk === false ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm font-semibold text-[#64748b]">Imagem não carregou</p>
              <p className="text-xs text-[#94a3b8]">Verifique se a URL é pública e aponta para uma imagem</p>
            </div>
          ) : (
            <img
              src={trimmed}
              alt="Prévia"
              className="mx-auto block max-h-56 w-full object-contain"
              onLoad={() => setPreviewOk(true)}
              onError={() => setPreviewOk(false)}
            />
          )}
        </div>
      )}

      {!isUrl && (
        <div className="flex flex-col items-center gap-3 py-8 text-center text-[#94a3b8]">
          <Link size={28} className="opacity-30" />
          <p className="text-sm">Cole uma URL acima para pré-visualizar</p>
        </div>
      )}

      <button
        onClick={() => onConfirm(trimmed)}
        disabled={!isUrl || previewOk === false}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25 disabled:opacity-40"
      >
        <CheckCircle2 size={16} />
        Usar esta imagem
      </button>
    </div>
  );
}

// ── Bank tab ──────────────────────────────────────────────────────────────────

function BankTab({
  catalog,
  loading,
  error,
  search,
  onSearch,
  onRetry,
  selected,
  onSelect,
  confirming,
  onConfirm,
}: {
  catalog: CatalogProduct[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (q: string) => void;
  onRetry: () => void;
  selected: CatalogProduct | null;
  onSelect: (p: CatalogProduct) => void;
  confirming: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search — fixo no topo */}
      <div className="shrink-0 border-b border-[#e2e8f0] bg-white px-6 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
          <Search size={14} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar no banco de imagens…"
            className="w-full bg-transparent text-sm font-semibold text-[#0f172a] outline-none placeholder:text-[#cbd5e1]"
          />
          {search && (
            <button onClick={() => onSearch("")} className="shrink-0 text-[#94a3b8]">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Grid — área scrollável no meio */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-[#f1f5f9]" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <AlertCircle size={26} className="text-red-400" />
            </div>
            <div>
              <p className="font-black text-[#0f172a]">Banco de imagens indisponível</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{error}</p>
            </div>
            <button
              onClick={onRetry}
              className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-black text-[#0f172a] hover:bg-[#f8fafc]"
            >
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        ) : catalog.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon size={32} className="mx-auto mb-3 text-[#cbd5e1]" />
            <p className="font-black text-[#64748b]">Nenhuma imagem encontrada</p>
            <p className="mt-1 text-xs text-[#94a3b8]">
              {search ? "Tente outro termo de busca" : "A API não retornou imagens para este catálogo"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalog.map((product) => {
              const isSelected = selected?.id === product.id;
              return (
                <button
                  key={product.id}
                  onClick={() => onSelect(product)}
                  className={`group overflow-hidden rounded-2xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-[#16a34a] shadow-md shadow-[#16a34a]/20"
                      : "border-transparent hover:border-[#16a34a]/40 hover:shadow-sm"
                  } bg-white`}
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f8fafc]">
                    <img
                      src={getProductImageUrl(product.imageUrl)}
                      alt={product.imageAlt || product.name}
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23f1f5f9'/%3E%3Cpath d='M3 9l4-4 4 4 4-5 6 8H3z' fill='%23e2e8f0'/%3E%3Ccircle cx='8.5' cy='8.5' r='2' fill='%23e2e8f0'/%3E%3C/svg%3E";
                      }}
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#16a34a] shadow">
                        <CheckCircle2 size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] font-black text-[#0f172a] line-clamp-1">{product.name}</p>
                    {product.imageAlt ? (
                      <p className="mt-0.5 text-[10px] text-[#94a3b8] line-clamp-2 leading-tight" title={product.imageAlt}>
                        {product.imageAlt}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] italic text-[#cbd5e1]">sem alt text</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer fixo — aparece logo acima do teclado/borda, onde o usuário está */}
      {selected && (
        <div className="shrink-0 border-t-2 border-[#16a34a]/20 bg-[#f0fdf4] px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={getProductImageUrl(selected.imageUrl)}
              alt={selected.imageAlt || selected.name}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[#0f172a]">{selected.name}</p>
              {selected.imageAlt && (
                <p className="truncate text-[10px] text-[#16a34a]">
                  🔍 {selected.imageAlt}
                </p>
              )}
            </div>
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30 disabled:opacity-60"
            >
              {confirming ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Usar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
