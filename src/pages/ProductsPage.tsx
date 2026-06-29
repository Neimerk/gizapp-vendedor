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
  Star,
  Upload,
  Link,
  ImageIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router-dom";

import {
  addProductFromCatalog,
  clearStoreProducts,
  createProduct,
  getFeaturedSlugs,
  getProductImageUrl,
  getStoreById,
  getStoreProducts,
  invalidateProductsCache,
  removeStoreProduct,
  removeProductFromShopping,
  syncProductToShopping,
  updateStoreProduct,
  updateStoreProductImage,
  type StoreProduct,
} from "../services/gizApi";
import { getSellerStoreId } from "../services/gizApi";
import { getAuth } from "../services/auth";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";
import Pagination from "../components/ui/Pagination";
import { usePagination } from "../hooks/usePagination";
import ImagePickerModal from "../components/ui/ImagePickerModal";

// ── Types ────────────────────────────────────────────────────────────────────

type LocalProduct = StoreProduct & {
  _modified: boolean;
  _imageAlt: string;
  _featured: boolean;
};

type NewProductForm = {
  name: string;
  category: string;
  brand: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
  promotionalPrice: string;
  stock: string;
  available: boolean;
};

const EMPTY_FORM: NewProductForm = {
  name: "",
  category: "",
  brand: "",
  description: "",
  imageUrl: "",
  imageAlt: "",
  price: "0.00",
  promotionalPrice: "",
  stock: "1",
  available: true,
};

const PAGE_SIZE = 20;

const PLAN_LIMITS      = { free: 30,  basic: 100, premium: 300      } as const;
const FEATURED_LIMITS  = { free: 3,   basic: 15,  premium: 30       } as const;
const CATEGORY_LIMITS  = { free: 3,   basic: 15,  premium: Infinity  } as const;

function toLocal(p: StoreProduct): LocalProduct {
  return { ...p, _modified: false, _imageAlt: p.imageAlt ?? "", _featured: false };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const auth = getAuth();
  const STORE_PLAN    = (auth?.plan ?? "basic") as keyof typeof PLAN_LIMITS;
  const MAX_PRODUCTS  = PLAN_LIMITS[STORE_PLAN];
  const MAX_FEATURED  = FEATURED_LIMITS[STORE_PLAN];
  const MAX_CATEGORIES = CATEGORY_LIMITS[STORE_PLAN];

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");

  // Image picker for existing products
  const [imagePickerProduct, setImagePickerProduct] = useState<LocalProduct | null>(null);
  const [savingImageId, setSavingImageId] = useState("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<LocalProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);

  // Add product modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Toasts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function loadProducts() {
    try {
      setLoading(true);
      const storeId = getSellerStoreId();
      const [data, featuredSlugs, store] = await Promise.all([
        getStoreProducts(),
        getFeaturedSlugs(storeId),
        getStoreById(storeId).catch(() => null),
      ]);
      if (store) setStoreName(store.name);
      const slugSet = new Set(featuredSlugs);
      setProducts(
        data.map(p => ({
          ...toLocal(p),
          _featured: slugSet.has(p.slug),
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  const modifiedCount = products.filter(p => p._modified).length;

  // Bloqueia navegação interna se houver alterações não salvas
  const blocker = useBlocker(modifiedCount > 0);

  // Bloqueia reload/fechar aba se houver alterações não salvas
  useEffect(() => {
    if (modifiedCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [modifiedCount]);

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
        category: product.category,
      });
      invalidateProductsCache();
      setProducts(cur =>
        cur.map(p => p.id === product.id ? { ...p, _modified: false } : p)
      );
      // Sincroniza alterações com o Shopping app
      syncProductToShopping({
        name: product.name, slug: product.slug, category: product.category,
        subCategory: product.subCategory, brand: product.brand,
        description: product.description, imageUrl: product.imageUrl,
        imageAlt: product._imageAlt || null,
        price: product.price, promotionalPrice: product.promotionalPrice ?? null,
        stock: product.stock, available: product.available,
        storeId: getSellerStoreId(), storeName,
      });
    } catch (e) {
      console.error(e);
      showError("Erro ao salvar produto.");
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
      invalidateProductsCache();
      setProducts([]);
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
      showError(e instanceof Error ? e.message : "Erro ao limpar loja.");
    } finally {
      setClearing(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await removeStoreProduct(deleteTarget.id);
      invalidateProductsCache();
      setProducts(cur => cur.filter(p => p.id !== deleteTarget.id));
      removeProductFromShopping(deleteTarget.slug, getSellerStoreId());
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      showError("Erro ao remover produto.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Featured ───────────────────────────────────────────────────────────────

  const featuredCount = products.filter(p => p._featured).length;
  const usedCategorySet = useMemo(() => new Set(products.map(p => p.category)), [products]);

  async function handleToggleFeatured(product: LocalProduct) {
    const isNowFeatured = !product._featured;
    if (isNowFeatured && featuredCount >= MAX_FEATURED) {
      showError(`Máximo de ${MAX_FEATURED} destaques no plano ${STORE_PLAN}.`);
      return;
    }
    setProducts(cur =>
      cur.map(p => p.id === product.id ? { ...p, _featured: isNowFeatured } : p)
    );
    const storeId = getSellerStoreId();
    // Sync com featured no payload — upsert atômico, sem race condition
    syncProductToShopping({
      name: product.name, slug: product.slug, category: product.category,
      subCategory: product.subCategory, brand: product.brand,
      description: product.description, imageUrl: product.imageUrl,
      imageAlt: product._imageAlt || null,
      price: product.price, promotionalPrice: product.promotionalPrice ?? null,
      stock: product.stock, available: product.available,
      featured: isNowFeatured,
      storeId, storeName,
    });
  }

  // ── Image ──────────────────────────────────────────────────────────────────

  async function handleImageConfirmed(imageUrl: string, imageAlt?: string) {
    if (!imagePickerProduct) return;
    const pid = imagePickerProduct.id;
    setImagePickerProduct(null);
    setSavingImageId(pid);
    try {
      await updateStoreProductImage(pid, imageUrl);
      setProducts(cur =>
        cur.map(p => p.id === pid ? {
          ...p,
          imageUrl,
          ...(imageAlt ? { _imageAlt: imageAlt, _modified: true } : {}),
        } : p)
      );
    } catch (e) {
      console.error(e);
      showError("Erro ao salvar imagem.");
    } finally {
      setSavingImageId("");
    }
  }

  // ── Add product ────────────────────────────────────────────────────────────

  async function handleAddProduct(form: NewProductForm) {
    if (products.length >= MAX_PRODUCTS) {
      showError(`Limite do plano ${STORE_PLAN}: máximo ${MAX_PRODUCTS} produtos.`);
      return;
    }
    try {
      setAdding(true);

      // 1. Cria produto no catálogo global
      const catalogProduct = await createProduct({
        name: form.name.trim(),
        category: form.category,
        brand: form.brand.trim() || undefined,
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl || undefined,
        imageAlt: form.imageAlt.trim() || undefined,
      });

      // 2. Adiciona à loja (retorna só mensagem, sem o objeto)
      await addProductFromCatalog(catalogProduct.id);

      // 3. Busca o store product recém-criado pelo productId (sempre fresh)
      const allStoreProducts = await getStoreProducts(undefined, true);
      const newSP = allStoreProducts.find(p => p.productId === catalogProduct.id);

      if (newSP) {
        const price = parseFloat(form.price) || 0;
        const promoPrice = form.promotionalPrice ? parseFloat(form.promotionalPrice) : null;
        const stock = parseInt(form.stock) || 0;

        // 4. Atualiza preço, estoque e disponibilidade
        await updateStoreProduct(newSP.id, {
          price, promotionalPrice: promoPrice,
          stock, available: form.available,
          imageAlt: form.imageAlt.trim() || undefined,
        });
        // 5. Atualiza imagem do store product se o usuário selecionou uma
        if (form.imageUrl) {
          await updateStoreProductImage(newSP.id, form.imageUrl);
        }
        // 6. Sincroniza imediatamente com o Shopping app
        syncProductToShopping({
          name: form.name.trim(), slug: catalogProduct.slug,
          category: form.category, subCategory: null,
          brand: form.brand.trim() || null,
          description: form.description.trim() || null,
          imageUrl: form.imageUrl || null,
          imageAlt: form.imageAlt.trim() || null,
          price, promotionalPrice: promoPrice,
          stock, available: form.available,
          storeId: getSellerStoreId(), storeName,
        });

        // 7. Atualiza estado local sem re-fetch (usa newSP + campos do form)
        const imageUrlFinal = form.imageUrl || newSP.imageUrl;
        setProducts(cur => [
          {
            ...toLocal({
              ...newSP,
              price,
              promotionalPrice: promoPrice,
              stock,
              available: form.available,
              imageUrl: imageUrlFinal ?? undefined,
              imageAlt: form.imageAlt.trim() || newSP.imageAlt,
            }),
            _featured: false,
          },
          ...cur,
        ]);
      } else {
        await loadProducts();
      }

      invalidateProductsCache();
      setAddModalOpen(false);
      showSuccess(`"${form.name.trim()}" adicionado à loja!`);
    } catch (e) {
      console.error(e);
      showError(e instanceof Error ? e.message : "Erro ao adicionar produto.");
    } finally {
      setAdding(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-[#16a34a]/20 bg-white px-5 py-3.5 shadow-xl shadow-black/10">
          <CheckCircle2 size={16} className="shrink-0 text-[#16a34a]" />
          <p className="text-sm font-semibold text-[#15803d]">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="ml-1 text-[#86efac] hover:text-[#16a34a]">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-red-200 bg-white px-5 py-3.5 shadow-xl shadow-black/10">
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="ml-1 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Operação Comercial</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Produtos</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#64748b]">
              {products.length}/{MAX_PRODUCTS} produto{products.length !== 1 ? "s" : ""} · plano {STORE_PLAN}
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
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-black text-yellow-600 ring-1 ring-yellow-200">
              <Star size={10} />
              {featuredCount}/{MAX_FEATURED} destaque{featuredCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600 ring-1 ring-blue-200">
              {usedCategorySet.size}/{MAX_CATEGORIES === Infinity ? "∞" : MAX_CATEGORIES} categori{usedCategorySet.size !== 1 ? "as" : "a"}
            </span>
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
            onClick={() => {
              if (products.length >= MAX_PRODUCTS) {
                showError(`Limite do plano ${STORE_PLAN}: máximo ${MAX_PRODUCTS} produtos. Faça upgrade para adicionar mais.`);
                return;
              }
              setAddModalOpen(true);
            }}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg ${
              products.length >= MAX_PRODUCTS
                ? "bg-[#94a3b8] shadow-gray-200 cursor-not-allowed"
                : "bg-gradient-to-r from-[#16a34a] to-[#15803d] shadow-[#16a34a]/25"
            }`}
          >
            <PackagePlus size={18} />
            Adicionar produto
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
        <EmptyState hasSearch={!!search} onClearSearch={() => setSearch("")} onAddProduct={() => setAddModalOpen(true)} />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                saving={savingId === product.id}
                savingImage={savingImageId === product.id}
                canFeatured={!product._featured && featuredCount < MAX_FEATURED}
                usedCategories={usedCategorySet}
                categoryLimit={MAX_CATEGORIES}
                onPatch={(changes) => patch(product.id, changes)}
                onAdjustStock={(d) => adjustStock(product.id, d)}
                onSave={() => handleSave(product)}
                onDelete={() => setDeleteTarget(product)}
                onOpenImagePicker={() => setImagePickerProduct(product)}
                onToggleFeatured={() => handleToggleFeatured(product)}
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

      {/* Image picker modal (existing products) */}
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

      {/* Add product modal */}
      {addModalOpen && (
        <AddProductModal
          adding={adding}
          onConfirm={handleAddProduct}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {/* Unsaved changes navigation blocker */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
              <AlertCircle size={22} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-black text-[#0f172a]">Alterações não salvas</h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Você tem <strong>{modifiedCount} produto{modifiedCount !== 1 ? "s" : ""}</strong> com
              alterações não salvas. Se sair agora, as mudanças serão perdidas.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] hover:bg-[#f8fafc]"
              >
                Ficar e salvar
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
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
  canFeatured,
  usedCategories,
  categoryLimit,
  onPatch,
  onAdjustStock,
  onSave,
  onDelete,
  onOpenImagePicker,
  onToggleFeatured,
}: {
  product: LocalProduct;
  saving: boolean;
  savingImage: boolean;
  canFeatured: boolean;
  usedCategories: Set<string>;
  categoryLimit: number;
  onPatch: (changes: Partial<LocalProduct>) => void;
  onAdjustStock: (delta: number) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenImagePicker: () => void;
  onToggleFeatured: () => void;
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
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }}
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
              <div className="flex items-center gap-2">
                <h3 className="truncate font-black text-[#0f172a] leading-tight" title={product.name}>
                  {product.name}
                </h3>
                {product._featured && (
                  <Star size={13} className="shrink-0 fill-yellow-400 text-yellow-400" />
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-[#64748b]">
                {product.category}{product.brand ? ` · ${product.brand}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleFeatured}
                disabled={!product._featured && !canFeatured}
                title={product._featured ? "Remover do destaque" : "Marcar como destaque"}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
                  product._featured
                    ? "bg-yellow-100 text-yellow-500 hover:bg-yellow-200"
                    : "bg-[#f1f5f9] text-[#94a3b8] hover:bg-yellow-50 hover:text-yellow-400"
                }`}
              >
                <Star size={13} className={product._featured ? "fill-yellow-400" : ""} />
              </button>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                product.available
                  ? "bg-[#f0fdf4] text-[#16a34a] ring-1 ring-[#16a34a]/20"
                  : "bg-red-50 text-red-600 ring-1 ring-red-200"
              }`}>
                {product.available ? "Disponível" : "Indisponível"}
              </span>
            </div>
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

          {/* Category */}
          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Categoria
            </label>
            <select
              value={product.category}
              onChange={e => {
                const newCat = e.target.value;
                const isNew = !usedCategories.has(newCat);
                if (isNew && usedCategories.size >= categoryLimit) return;
                onPatch({ category: newCat });
              }}
              className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20"
            >
              {categories.map(cat => {
                const isNew = !usedCategories.has(cat.slug);
                const blocked = isNew && usedCategories.size >= categoryLimit;
                return (
                  <option key={cat.slug} value={cat.slug} disabled={blocked}>
                    {cat.name}{blocked ? " — limite do plano" : ""}
                  </option>
                );
              })}
            </select>
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
          "<span className="font-semibold text-[#0f172a]">{name}</span>" será removido da sua loja.
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

// ── AddProductModal ───────────────────────────────────────────────────────────

function AddProductModal({
  adding,
  onConfirm,
  onClose,
}: {
  adding: boolean;
  onConfirm: (form: NewProductForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<NewProductForm>(EMPTY_FORM);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTab, setImagePickerTab] = useState<"upload" | "url" | "bank">("upload");

  function patch(changes: Partial<NewProductForm>) {
    setForm(f => ({ ...f, ...changes }));
  }

  function openPicker(tab: "upload" | "url" | "bank") {
    setImagePickerTab(tab);
    setImagePickerOpen(true);
  }

  const canSubmit = form.name.trim().length > 0 && form.category !== "";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="flex max-h-[95dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
            <div>
              <h2 className="text-base font-black text-[#0f172a]">Novo produto</h2>
              <p className="mt-0.5 text-xs text-[#94a3b8]">Preencha os dados e escolha a imagem</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            >
              <X size={17} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {/* Imagem — 3 opções sempre visíveis */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Imagem do produto
              </label>

              {form.imageUrl ? (
                /* Preview da imagem selecionada */
                <div className="relative overflow-hidden rounded-2xl border border-[#16a34a]/30 bg-[#f8fafc]">
                  <img
                    src={getProductImageUrl(form.imageUrl)}
                    alt={form.name || "produto"}
                    className="mx-auto block h-36 w-full object-contain"
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }}
                  />
                  {/* Trocar imagem — 3 opções sobrepostas ao hover */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity hover:opacity-100 rounded-2xl">
                    <button type="button" onClick={() => openPicker("upload")}
                      className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#0f172a]">
                      <Upload size={12} /> Upload
                    </button>
                    <button type="button" onClick={() => openPicker("bank")}
                      className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#0f172a]">
                      <ImageIcon size={12} /> Banco
                    </button>
                    <button type="button" onClick={() => openPicker("url")}
                      className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#0f172a]">
                      <Link size={12} /> URL
                    </button>
                  </div>
                </div>
              ) : (
                /* 3 opções lado a lado */
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => openPicker("upload")}
                    className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-[#16a34a]/30 bg-[#f0fdf4] px-3 py-5 text-center transition-all hover:border-[#16a34a] hover:bg-[#dcfce7] active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#16a34a]">
                      <Upload size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#0f172a]">Upload</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-[#64748b]">Foto ou arquivo do dispositivo</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openPicker("bank")}
                    className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-[#3b82f6]/30 bg-[#eff6ff] px-3 py-5 text-center transition-all hover:border-[#3b82f6] hover:bg-[#dbeafe] active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3b82f6]">
                      <ImageIcon size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#0f172a]">Banco GizApp</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-[#64748b]">+1.200 imagens de produtos</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openPicker("url")}
                    className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-[#8b5cf6]/30 bg-[#f5f3ff] px-3 py-5 text-center transition-all hover:border-[#8b5cf6] hover:bg-[#ede9fe] active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8b5cf6]">
                      <Link size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#0f172a]">URL</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-[#64748b]">Cole o link de uma imagem</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Nome do produto <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => patch({ name: e.target.value })}
                placeholder="Ex: Coca-Cola Lata 350ml"
                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Categoria <span className="text-red-400">*</span>
              </label>
              <select
                value={form.category}
                onChange={e => patch({ category: e.target.value })}
                className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20"
              >
                <option value="">Selecione uma categoria…</option>
                {categories.map(cat => (
                  <option key={cat.slug} value={cat.slug}>
                    {categoryIcons[cat.slug]} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand + Description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Marca</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={e => patch({ brand: e.target.value })}
                  placeholder="Ex: Coca-Cola, Nestlé…"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => patch({ description: e.target.value })}
                  placeholder="Descrição curta do produto…"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
                />
              </div>
            </div>

            {/* Price + Promo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                  Preço <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94a3b8]">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={e => patch({ price: e.target.value })}
                    className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-3 pl-9 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Preço promocional</label>
                <div className="relative">
                  <Tag size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.promotionalPrice}
                    onChange={e => patch({ promotionalPrice: e.target.value })}
                    placeholder="—"
                    className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-3 pl-8 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:font-normal placeholder:text-[#cbd5e1]"
                  />
                </div>
              </div>
            </div>

            {/* Stock + Available */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Estoque</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => patch({ stock: String(Math.max(0, parseInt(form.stock || "0") - 1)) })}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9]"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={e => patch({ stock: e.target.value })}
                    className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ stock: String(parseInt(form.stock || "0") + 1) })}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Status inicial</label>
                <button
                  type="button"
                  onClick={() => patch({ available: !form.available })}
                  className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-black transition-colors ${
                    form.available
                      ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
                      : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
                  }`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${form.available ? "bg-[#16a34a]" : "bg-[#cbd5e1]"}`} />
                  {form.available ? "Ativo" : "Inativo"}
                </button>
              </div>
            </div>

            {/* Alt text (only when image is selected) */}
            {form.imageUrl && (
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                  Alt da imagem (SEO)
                </label>
                <input
                  type="text"
                  value={form.imageAlt}
                  onChange={e => patch({ imageAlt: e.target.value })}
                  placeholder="Descreva a imagem para buscadores e acessibilidade…"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/20 placeholder:text-[#cbd5e1]"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 border-t border-[#e2e8f0] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] hover:bg-[#f8fafc]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(form)}
              disabled={adding || !canSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25 disabled:opacity-50"
            >
              {adding ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Adicionando…</>
              ) : (
                <><PackagePlus size={15} /> Adicionar produto</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image picker overlaid on top of the add modal */}
      {imagePickerOpen && (
        <ImagePickerModal
          productName={form.name || "Novo produto"}
          currentImageUrl={form.imageUrl}
          defaultTab={imagePickerTab}
          onConfirm={(url, alt, meta) => {
            patch({
              imageUrl: url,
              ...(alt ? { imageAlt: alt } : {}),
              ...(meta?.name && !form.name.trim() ? { name: meta.name } : {}),
              ...(meta?.brand && !form.brand.trim() ? { brand: meta.brand } : {}),
              ...(meta?.description && !form.description.trim() ? { description: meta.description } : {}),
            });
            setImagePickerOpen(false);
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      )}
    </>
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
        Adicione seu primeiro produto para começar a vender.
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
