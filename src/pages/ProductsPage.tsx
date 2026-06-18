import { PackagePlus, Search, Trash2, X, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  addProductFromCatalog,
  getCatalogProducts,
  getProductImageUrl,
  getStoreProducts,
  removeStoreProduct,
  updateStoreProduct,
  updateStoreProductImage,
  type CatalogProduct,
  type StoreProduct,
} from "../services/gizApi";
import Pagination from "../components/ui/Pagination";
import { usePagination } from "../hooks/usePagination";
import ImagePickerModal from "../components/ui/ImagePickerModal";

type EditableField = "price" | "promotionalPrice" | "stock" | "available";
type EditableValue = number | boolean | null;

const PAGE_SIZE = 20;
const CATALOG_PAGE_SIZE = 24;

export default function ProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [search, setSearch] = useState("");

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [addingProductId, setAddingProductId] = useState("");

  // Image picker modal
  const [imagePickerProduct, setImagePickerProduct] = useState<StoreProduct | null>(null);
  const [savingImageId, setSavingImageId] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await getStoreProducts();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog(s = "") {
    try {
      setCatalogLoading(true);
      const data = await getCatalogProducts(s);
      setCatalogProducts(data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar catálogo.");
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => { loadProducts().catch(console.error); }, []);

  useEffect(() => {
    if (!catalogOpen) return;
    const t = setTimeout(() => loadCatalog(catalogSearch).catch(console.error), 400);
    return () => clearTimeout(t);
  }, [catalogSearch, catalogOpen]);

  async function handleSave(product: StoreProduct) {
    try {
      setSavingId(product.id);
      await updateStoreProduct(product.id, {
        price: product.price,
        promotionalPrice: product.promotionalPrice,
        stock: product.stock,
        available: product.available,
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto.");
    } finally {
      setSavingId("");
    }
  }

  async function handleRemove(product: StoreProduct) {
    if (!confirm(`Excluir "${product.name}" da sua loja? Esta ação não pode ser desfeita.`)) return;
    try {
      setRemovingId(product.id);
      const result = await removeStoreProduct(product.id);
      if (result.softDeleted) {
        // Has linked orders — just mark as unavailable in local state
        setProducts((cur) =>
          cur.map((p) => p.id === product.id ? { ...p, available: false } : p)
        );
      } else {
        setProducts((cur) => cur.filter((p) => p.id !== product.id));
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao remover produto.");
    } finally {
      setRemovingId("");
    }
  }

  async function handleAddProduct(productId: string) {
    try {
      setAddingProductId(productId);
      await addProductFromCatalog(productId);
      await loadProducts();
      alert("Produto adicionado à loja.");
      setCatalogOpen(false);
      setCatalogSearch("");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Erro ao adicionar produto.");
    } finally {
      setAddingProductId("");
    }
  }

  async function handleImageConfirmed(imageUrl: string) {
    if (!imagePickerProduct) return;
    const productId = imagePickerProduct.id;
    setImagePickerProduct(null);
    setSavingImageId(productId);
    try {
      await updateStoreProductImage(productId, imageUrl);
      setProducts((cur) =>
        cur.map((p) => (p.id === productId ? { ...p, imageUrl } : p))
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Erro ao salvar imagem.");
    } finally {
      setSavingImageId("");
    }
  }

  function updateLocal(id: string, field: EditableField, value: EditableValue) {
    setProducts((cur) =>
      cur.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  function alreadyInStore(productId: string) {
    return products.some((p) => p.productId === productId);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  const catalogFiltered = useMemo(() => catalogProducts, [catalogProducts]);
  const {
    page: catPage,
    setPage: setCatPage,
    totalPages: catTotalPages,
    pageItems: catPageItems,
  } = usePagination(catalogFiltered, CATALOG_PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#0f172a]">Produtos</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            {products.length} produto{products.length !== 1 ? "s" : ""} na loja
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25"
        >
          <PackagePlus size={18} />
          Adicionar do catálogo
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0 text-[#94a3b8]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, categoria ou marca..."
          className="w-full bg-transparent text-sm font-semibold text-[#0f172a] outline-none placeholder:text-[#cbd5e1]"
        />
        {search && (
          <button onClick={() => setSearch("")} className="shrink-0 text-[#94a3b8] hover:text-[#64748b]">
            <X size={15} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-[#e8eaf0] bg-white p-12 text-center">
          <p className="font-black text-[#0f172a]">
            {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-sm font-bold text-[#16a34a]">
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pageItems.map((product) => (
              <div
                key={product.id}
                className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row">
                  {/* Image */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
                      <img
                        src={getProductImageUrl(product.imageUrl)}
                        alt={product.name}
                        className="h-20 w-20 object-contain"
                        onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePickerProduct(product)}
                      disabled={savingImageId === product.id}
                      className="flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60"
                    >
                      <ImagePlus size={12} />
                      {savingImageId === product.id ? "Salvando…" : "Imagem"}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-[#0f172a] leading-tight">{product.name}</h3>
                        <p className="mt-0.5 text-xs text-[#64748b]">
                          {product.category}{product.brand ? ` · ${product.brand}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          product.available
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {product.available ? "Disponível" : "Indisponível"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                          Preço
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.price}
                          onChange={(e) => updateLocal(product.id, "price", Number(e.target.value))}
                          className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                          Promoção
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.promotionalPrice ?? ""}
                          onChange={(e) =>
                            updateLocal(product.id, "promotionalPrice", e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                          Estoque
                        </label>
                        <input
                          type="number"
                          value={product.stock}
                          onChange={(e) => updateLocal(product.id, "stock", Number(e.target.value))}
                          className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#16a34a]/20"
                        />
                      </div>
                      <div className="flex items-end gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#0f172a]">
                          <input
                            type="checkbox"
                            checked={product.available}
                            onChange={(e) => updateLocal(product.id, "available", e.target.checked)}
                            className="h-4 w-4 accent-[#16a34a]"
                          />
                          Ativo
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(product)}
                        disabled={savingId === product.id || removingId === product.id}
                        className="rounded-xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
                      >
                        {savingId === product.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(product)}
                        disabled={removingId === product.id || savingId === product.id}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        {removingId === product.id ? "Removendo..." : "Excluir da loja"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

      {/* Catalog modal */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-[#0f172a]">Catálogo global</h2>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Busque e adicione produtos do catálogo à sua loja.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setCatalogOpen(false); setCatalogSearch(""); }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-[#e2e8f0] px-6 py-4">
              <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5">
                <Search size={15} className="text-[#94a3b8]" />
                <input
                  value={catalogSearch}
                  onChange={(e) => { setCatalogSearch(e.target.value); setCatPage(1); }}
                  placeholder="Buscar no catálogo..."
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#cbd5e1]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {catalogLoading ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#f8fafc]" />
                  ))}
                </div>
              ) : catPageItems.length === 0 ? (
                <div className="py-12 text-center font-bold text-[#64748b]">
                  Nenhum produto encontrado.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {catPageItems.map((product) => {
                      const added = alreadyInStore(product.id);
                      return (
                        <div
                          key={product.id}
                          className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                              <img
                                src={getProductImageUrl(product.imageUrl)}
                                alt={product.name}
                                className="h-14 w-14 object-contain"
                                onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-xs font-black text-[#0f172a]">
                                {product.name}
                              </h3>
                              <p className="mt-0.5 text-[10px] text-[#64748b]">
                                {product.category}{product.brand ? ` · ${product.brand}` : ""}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleAddProduct(product.id)}
                                disabled={added || addingProductId === product.id}
                                className={`mt-2 rounded-lg px-3 py-1 text-[10px] font-black text-white disabled:opacity-60 ${
                                  added ? "bg-[#94a3b8]" : "bg-[#0f172a]"
                                }`}
                              >
                                {added ? "Já adicionado" : addingProductId === product.id ? "Adicionando..." : "Adicionar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Pagination
                    page={catPage}
                    totalPages={catTotalPages}
                    totalItems={catalogFiltered.length}
                    pageSize={CATALOG_PAGE_SIZE}
                    onPageChange={setCatPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
