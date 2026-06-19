import {
  PackagePlus,
  Search,
  Trash2,
  X,
  ImagePlus,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  addProductFromCatalog,
  clearStoreProducts,
  getCatalogProducts,
  getProductImageUrl,
  getStoreProducts,
  removeStoreProduct,
  updateStoreProduct,
  updateStoreProductImage,
  type CatalogProduct,
  type StoreProduct,
} from "../services/gizApi";
import { getSellerStoreId } from "../services/gizApi";
import Pagination from "../components/ui/Pagination";
import { usePagination } from "../hooks/usePagination";
import ImagePickerModal from "../components/ui/ImagePickerModal";

// ── Types ────────────────────────────────────────────────────────────────────

type LocalProduct = StoreProduct & {
  _modified: boolean;
  _imageAlt: string;
};

type CatalogSetup = {
  product: CatalogProduct;
  price: string;
  stock: string;
};

const PAGE_SIZE = 20;
const CATALOG_PAGE_SIZE = 24;

function toLocal(p: StoreProduct): LocalProduct {
  return { ...p, _modified: false, _imageAlt: p.imageAlt ?? "" };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");

  // Image picker
  const [imagePickerProduct, setImagePickerProduct] = useState<LocalProduct | null>(null);
  const [savingImageId, setSavingImageId] = useState("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<LocalProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);

  // Catalog modal
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSetup, setCatalogSetup] = useState<CatalogSetup | null>(null);
  const [addingId, setAddingId] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await getStoreProducts();
      // Só carrega produtos que o lojista EXPLICITAMENTE ativou
      // Produtos pré-carregados do catálogo ficam com available=false e são ignorados
      setProducts(data.filter(p => p.available).map(toLocal));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog(s = "") {
    try {
      setCatalogLoading(true);
      const data = await getCatalogProducts(s);
      setCatalogProducts(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar catálogo.");
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    if (!catalogOpen) return;
    const t = setTimeout(() => loadCatalog(catalogSearch), 400);
    return () => clearTimeout(t);
  }, [catalogSearch, catalogOpen]);

  // ── Local mutations ────────────────────────────────────────────────────────

  function patch(id: string, changes: Partial<LocalProduct>) {
    setProducts(cur =>
      cur.map(p => p.id === id ? { ...p, ...changes, _modified: true } : p)
    );
  }

  function adjustStock(id: string, delta: number) {
    setProducts(cur =>
      cur.map(p =>
        p.id === id
          ? { ...p, stock: Math.max(0, p.stock + delta), _modified: true }
          : p
      )
    );
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(product: LocalProduct) {
    try {
      setSavingId(product.id);
      await updateStoreProduct(product.id, {
        price: product.price,
        promotionalPrice: product.promotionalPrice,
        stock: product.stock,
        available: product.available,
        imageAlt: product._imageAlt || undefined,
      });
      setProducts(cur =>
        cur.map(p => p.id === product.id ? { ...p, _modified: false } : p)
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar produto.");
    } finally {
      setSavingId("");
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleClearStore() {
    try {
      setClearing(true);
      const storeId = getSellerStoreId();
      await clearStoreProducts(storeId);
      setProducts([]);
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erro ao limpar loja.");
    } finally {
      setClearing(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await removeStoreProduct(deleteTarget.id);
      // Soft ou hard delete: remove sempre da lista visível (só mostramos available=true)
      setProducts(cur => cur.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao remover produto.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Image ──────────────────────────────────────────────────────────────────

  async function handleImageConfirmed(imageUrl: string) {
    if (!imagePickerProduct) return;
    const pid = imagePickerProduct.id;
    setImagePickerProduct(null);
    setSavingImageId(pid);
    try {
      await updateStoreProductImage(pid, imageUrl);
      setProducts(cur =>
        cur.map(p => p.id === pid ? { ...p, imageUrl } : p)
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar imagem.");
    } finally {
      setSavingImageId("");
    }
  }

  // ── Catalog add ────────────────────────────────────────────────────────────

  function openSetup(product: CatalogProduct) {
    setCatalogSetup({ product, price: product.price?.toFixed(2) ?? "0.00", stock: "1" });
  }

  async function handleConfirmAdd() {
    if (!catalogSetup) return;
    try {
      setAddingId(catalogSetup.product.id);
      const added = await addProductFromCatalog(catalogSetup.product.id);
      // Update price/stock right after adding
      await updateStoreProduct(added.id, {
        price: parseFloat(catalogSetup.price) || 0,
        stock: parseInt(catalogSetup.stock) || 0,
        available: true,
      });
      await loadProducts();
      setCatalogSetup(null);
      setCatalogOpen(false);
      setCatalogSearch("");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erro ao adicionar produto.");
    } finally {
      setAddingId("");
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  // Produtos inativos que o lojista desativou (não os pré-seeded, que nunca entram no state)
  const unavailableCount = products.filter(p => !p.available).length;

  const filtered = useMemo(() => {
    const base = showUnavailable ? products : products.filter(p => p.available);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q)
    );
  }, [products, search, showUnavailable]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  const catalogFiltered = useMemo(() => catalogProducts, [catalogProducts]);
  const {
    page: catPage,
    setPage: setCatPage,
    totalPages: catTotalPages,
    pageItems: catItems,
  } = usePagination(catalogFiltered, CATALOG_PAGE_SIZE);

  const modifiedCount = products.filter(p => p._modified).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Operação Comercial</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Produtos</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#64748b]">
              {products.filter(p => p.available).length} ativo{products.filter(p => p.available).length !== 1 ? "s" : ""} na loja
            </span>
            {unavailableCount > 0 && (
              <button
                type="button"
                onClick={() => setShowUnavailable(v => !v)}
                className="text-xs font-bold text-[#94a3b8] underline underline-offset-2 hover:text-[#64748b]"
              >
                {showUnavailable ? "Ocultar" : `+ ${unavailableCount} inativo${unavailableCount !== 1 ? "s" : ""}`}
              </button>
            )}
            {modifiedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600 ring-1 ring-amber-200">
                <AlertCircle size={10} />
                {modifiedCount} não salvo{modifiedCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600 hover:bg-red-100"
            >
              <Trash2 size={16} />
              Limpar loja
            </button>
          )}
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25"
          >
            <PackagePlus size={18} />
            Adicionar produtos
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0 text-[#94a3b8]" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, categoria ou marca..."
          className="w-full bg-transparent text-sm font-semibold text-[#0f172a] outline-none placeholder:text-[#cbd5e1]"
        />
        {search && (
          <button onClick={() => setSearch("")} className="shrink-0 text-[#94a3b8] hover:text-[#64748b]">
            <X size={15} />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search} onClearSearch={() => setSearch("")} onAddProduct={() => setCatalogOpen(true)} />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                saving={savingId === product.id}
                savingImage={savingImageId === product.id}
                onPatch={(changes) => patch(product.id, changes)}
                onAdjustStock={(d) => adjustStock(product.id, d)}
                onSave={() => handleSave(product)}
                onDelete={() => setDeleteTarget(product)}
                onOpenImagePicker={() => setImagePickerProduct(product)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Image picker modal */}
      {imagePickerProduct && (
        <ImagePickerModal
          productName={imagePickerProduct.name}
          currentImageUrl={imagePickerProduct.imageUrl}
          onConfirm={handleImageConfirmed}
          onClose={() => setImagePickerProduct(null)}
        />
      )}

      {/* Clear store confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-lg font-black text-[#0f172a]">Limpar todos os produtos?</h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Todos os <strong>{products.length} produtos</strong> serão removidos da loja. Produtos com pedidos vinculados serão apenas desativados.
              <br /><br />
              Use para resetar a loja e começar do zero com produtos reais.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b]"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearStore}
                disabled={clearing}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {clearing ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Limpando…</>
                ) : (
                  <><Trash2 size={14} /> Limpar tudo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Catalog modal */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          {catalogSetup ? (
            <SetupModal
              setup={catalogSetup}
              adding={addingId === catalogSetup.product.id}
              onChangePrice={p => setCatalogSetup(s => s ? { ...s, price: p } : s)}
              onChangeStock={s => setCatalogSetup(st => st ? { ...st, stock: s } : st)}
              onConfirm={handleConfirmAdd}
              onBack={() => setCatalogSetup(null)}
            />
          ) : (
            <CatalogModal
              products={catItems}
              loading={catalogLoading}
              search={catalogSearch}
              onSearch={q => { setCatalogSearch(q); setCatPage(1); }}
              page={catPage}
              totalPages={catTotalPages}
              totalItems={catalogFiltered.length}
              onPageChange={setCatPage}
              storeProductIds={new Set(products.map(p => p.productId))}
              onSelect={openSetup}
              onClose={() => { setCatalogOpen(false); setCatalogSearch(""); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  product,
  saving,
  savingImage,
  onPatch,
  onAdjustStock,
  onSave,
  onDelete,
  onOpenImagePicker,
}: {
  product: LocalProduct;
  saving: boolean;
  savingImage: boolean;
  onPatch: (changes: Partial<LocalProduct>) => void;
  onAdjustStock: (delta: number) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenImagePicker: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-all ${
      product._modified
        ? "border-amber-300 shadow-amber-100"
        : "border-[#e8eaf0]"
    }`}>
      <div className="flex gap-5 p-5">
        {/* Image column */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
            <img
              src={getProductImageUrl(product.imageUrl)}
              alt={product._imageAlt || product.name}
              className="h-full w-full object-contain"
              onError={e => { e.currentTarget.src = "/placeholder.png"; }}
            />
            {savingImage && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#16a34a] border-t-transparent" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenImagePicker}
            disabled={savingImage}
            className="flex items-center gap-1 rounded-xl bg-[#0f172a] px-2.5 py-1.5 text-[10px] font-black text-white disabled:opacity-60"
          >
            <ImagePlus size={11} />
            Foto
          </button>
        </div>

        {/* Info + fields */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-black text-[#0f172a] leading-tight" title={product.name}>
                {product.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-[#64748b]">
                {product.category}{product.brand ? ` · ${product.brand}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
              product.available
                ? "bg-[#f0fdf4] text-[#16a34a] ring-1 ring-[#16a34a]/20"
                : "bg-red-50 text-red-600 ring-1 ring-red-200"
            }`}>
              {product.available ? "Disponível" : "Indisponível"}
            </span>
          </div>

          {/* Fields grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Price */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Preço</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94a3b8]">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.price}
                  onChange={e => onPatch({ price: Number(e.target.value) })}
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2 pl-8 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                />
              </div>
            </div>

            {/* Promo */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Promoção</label>
              <div className="relative">
                <Tag size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.promotionalPrice ?? ""}
                  onChange={e =>
                    onPatch({ promotionalPrice: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="—"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2 pl-7 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:font-normal placeholder:text-[#cbd5e1]"
                />
              </div>
            </div>

            {/* Stock */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Estoque</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAdjustStock(-1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                >
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={product.stock}
                  onChange={e => onPatch({ stock: Math.max(0, Number(e.target.value)) })}
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                />
                <button
                  type="button"
                  onClick={() => onAdjustStock(+1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a] transition-colors hover:bg-[#dcfce7]"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* Active toggle */}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Status</label>
              <button
                type="button"
                onClick={() => onPatch({ available: !product.available })}
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-xs font-black transition-colors ${
                  product.available
                    ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
                    : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full ${product.available ? "bg-[#16a34a]" : "bg-[#cbd5e1]"}`} />
                {product.available ? "Ativo" : "Inativo"}
              </button>
            </div>
          </div>

          {/* SEO Alt text */}
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Alt da imagem (SEO)
            </label>
            <input
              type="text"
              value={product._imageAlt}
              onChange={e => onPatch({ _imageAlt: e.target.value } as Partial<LocalProduct>)}
              placeholder="Descreva a imagem para buscadores e acessibilidade…"
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
            />
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-[#94a3b8]">
              {product._modified && (
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <AlertCircle size={10} />
                  Alterações não salvas
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 size={12} />
                Excluir
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white transition-colors disabled:opacity-60 ${
                  product._modified
                    ? "bg-gradient-to-r from-[#16a34a] to-[#15803d] shadow-sm shadow-[#16a34a]/25"
                    : "bg-[#0f172a]"
                }`}
              >
                {saving ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando…
                  </>
                ) : product._modified ? (
                  <>
                    <CheckCircle2 size={12} />
                    Salvar
                  </>
                ) : (
                  "Salvo"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({
  name,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h2 className="text-lg font-black text-[#0f172a]">Excluir da loja?</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          "<span className="font-semibold text-[#0f172a]">{name}</span>" será removido da sua loja. O produto continua no catálogo global.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] transition-colors hover:bg-[#f8fafc]"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {deleting ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Excluindo…</>
            ) : (
              <><Trash2 size={14} /> Confirmar exclusão</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SetupModal (pre-add config) ───────────────────────────────────────────────

function SetupModal({
  setup,
  adding,
  onChangePrice,
  onChangeStock,
  onConfirm,
  onBack,
}: {
  setup: CatalogSetup;
  adding: boolean;
  onChangePrice: (v: string) => void;
  onChangeStock: (v: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
          <img
            src={setup.product.imageUrl ? `/images/${setup.product.imageUrl.split('/').slice(-2).join('/')}` : "/placeholder.png"}
            alt={setup.product.name}
            className="h-12 w-12 object-contain"
            onError={e => { e.currentTarget.src = "/placeholder.png"; }}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-black text-[#0f172a]">{setup.product.name}</p>
          <p className="text-xs text-[#64748b]">{setup.product.category}</p>
        </div>
      </div>

      <h2 className="mb-4 text-base font-black text-[#0f172a]">Configurar antes de adicionar</h2>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
            Preço de venda (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={setup.price}
            onChange={e => onChangePrice(e.target.value)}
            className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
            Estoque inicial (unidades)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeStock(String(Math.max(0, parseInt(setup.stock) - 1)))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white"
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min="0"
              value={setup.stock}
              onChange={e => onChangeStock(e.target.value)}
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
            />
            <button
              type="button"
              onClick={() => onChangeStock(String(parseInt(setup.stock) + 1))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-2xl border border-[#e2e8f0] py-3 text-sm font-black text-[#64748b]"
        >
          ← Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={adding}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {adding ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Adicionando…</>
          ) : (
            <><PackagePlus size={15} /> Adicionar à loja</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── CatalogModal ──────────────────────────────────────────────────────────────

function CatalogModal({
  products,
  loading,
  search,
  onSearch,
  page,
  totalPages,
  totalItems,
  onPageChange,
  storeProductIds,
  onSelect,
  onClose,
}: {
  products: CatalogProduct[];
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  storeProductIds: Set<string>;
  onSelect: (p: CatalogProduct) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
        <div>
          <h2 className="text-xl font-black text-[#0f172a]">Catálogo global</h2>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Busque e configure o preço + estoque antes de adicionar à sua loja.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-[#e2e8f0] px-6 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5">
          <Search size={15} className="text-[#94a3b8]" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar no catálogo..."
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#cbd5e1]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#f8fafc]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center font-bold text-[#64748b]">Nenhum produto encontrado.</div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {products.map(product => {
                const inStore = storeProductIds.has(product.id);
                return (
                  <div key={product.id} className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <div className="flex gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                        <img
                          src={getProductImageUrl(product.imageUrl)}
                          alt={product.name}
                          className="h-14 w-14 object-contain"
                          onError={e => { e.currentTarget.src = "/placeholder.png"; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-xs font-black text-[#0f172a]">{product.name}</h3>
                        <p className="mt-0.5 text-[10px] text-[#64748b]">
                          {product.category}{product.brand ? ` · ${product.brand}` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => !inStore && onSelect(product)}
                          disabled={inStore}
                          className={`mt-2 rounded-lg px-3 py-1 text-[10px] font-black text-white disabled:opacity-60 ${
                            inStore ? "bg-[#94a3b8]" : "bg-[#16a34a] hover:bg-[#15803d]"
                          }`}
                        >
                          {inStore ? "Já na loja" : "Configurar →"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={24}
              onPageChange={onPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch,
  onClearSearch,
  onAddProduct,
}: {
  hasSearch: boolean;
  onClearSearch: () => void;
  onAddProduct: () => void;
}) {
  if (hasSearch) {
    return (
      <div className="rounded-3xl border border-[#e8eaf0] bg-white p-12 text-center">
        <p className="font-black text-[#0f172a]">Nenhum produto encontrado</p>
        <button onClick={onClearSearch} className="mt-2 text-sm font-bold text-[#16a34a]">
          Limpar busca
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0fdf4]">
        <PackagePlus size={28} className="text-[#16a34a]" />
      </div>
      <h3 className="text-lg font-black text-[#0f172a]">Nenhum produto na loja</h3>
      <p className="mt-1 text-sm text-[#64748b]">
        Adicione produtos do catálogo global para começar a vender.
      </p>
      <button
        onClick={onAddProduct}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25"
      >
        <PackagePlus size={16} />
        Adicionar primeiro produto
      </button>
    </div>
  );
}
