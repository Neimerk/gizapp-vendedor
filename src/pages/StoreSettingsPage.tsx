import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MapPin, Store as StoreIcon } from "lucide-react";

import {
  getStoreById,
  updateStore,
  type Store,
} from "../services/gizApi";
import { getAuth } from "../services/auth";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";

const inputCls =
  "w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";

export default function StoreSettingsPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // selected product-type slugs (persisted in store.category as "slug1,slug2,…")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        const storeId = getAuth()?.storeId;
        if (!storeId) throw new Error("Loja não encontrada para este usuário.");
        const data = await getStoreById(storeId);
        setStore(data);
        if (data.category) {
          setSelectedTypes(data.category.split(",").map((s) => s.trim()).filter(Boolean));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadStore();
  }, []);

  function toggleType(slug: string) {
    setSelectedTypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function handleCepLookup(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8 || !store) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStore({
          ...store,
          zipCode: cep,
          address: data.logradouro || store.address || "",
          neighborhood: data.bairro || store.neighborhood || "",
          city: data.localidade || store.city || "",
          state: data.uf || store.state || "",
        });
      }
    } catch {
      // ignore CEP lookup errors
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSave() {
    if (!store) return;
    setSaveError(null);
    try {
      setSaving(true);
      const updated = { ...store, category: selectedTypes.join(",") };
      await updateStore(store.id, updated);
      setStore(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Erro ao atualizar loja.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !store) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Operação Comercial</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Minha Loja</h1>
      </div>

      {/* Basic info */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
            <StoreIcon size={16} className="text-[#16a34a]" />
          </div>
          <h2 className="text-base font-black text-[#0f172a]">Informações básicas</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Nome da loja
            </label>
            <input
              value={store.name}
              onChange={(e) => setStore({ ...store, name: e.target.value })}
              className={inputCls}
              placeholder="Nome da loja"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              WhatsApp
            </label>
            <input
              value={store.whatsapp ?? ""}
              onChange={(e) => setStore({ ...store, whatsapp: e.target.value })}
              className={inputCls}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Descrição
            </label>
            <textarea
              value={store.description ?? ""}
              onChange={(e) => setStore({ ...store, description: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Descreva sua loja…"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Taxa de entrega (R$)
            </label>
            <input
              type="number"
              value={store.deliveryFee}
              onChange={(e) => setStore({ ...store, deliveryFee: Number(e.target.value) })}
              className={inputCls}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Tempo mín. (min)
              </label>
              <input
                type="number"
                value={store.deliveryTimeMin}
                onChange={(e) => setStore({ ...store, deliveryTimeMin: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Tempo máx. (min)
              </label>
              <input
                type="number"
                value={store.deliveryTimeMax}
                onChange={(e) => setStore({ ...store, deliveryTimeMax: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={store.isOpen}
                  onChange={(e) => setStore({ ...store, isOpen: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className={`h-6 w-11 rounded-full transition-colors ${store.isOpen ? "bg-[#16a34a]" : "bg-[#e2e8f0]"}`}
                />
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${store.isOpen ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
              <div>
                <p className="text-sm font-black text-[#0f172a]">
                  {store.isOpen ? "Loja aberta" : "Loja fechada"}
                </p>
                <p className="text-xs text-[#64748b]">
                  {store.isOpen ? "Aceitando pedidos agora" : "Não aparecendo para clientes"}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563eb]/10">
            <MapPin size={16} className="text-[#2563eb]" />
          </div>
          <h2 className="text-base font-black text-[#0f172a]">Endereço da loja</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              CEP
            </label>
            <div className="relative">
              <input
                value={store.zipCode ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
                  setStore({ ...store, zipCode: v });
                  if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                }}
                className={`${inputCls} ${cepLoading ? "pr-10" : ""}`}
                placeholder="00000-000"
                inputMode="numeric"
              />
              {cepLoading && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8]" />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Rua / Avenida
            </label>
            <input
              value={store.address ?? ""}
              onChange={(e) => setStore({ ...store, address: e.target.value })}
              className={inputCls}
              placeholder="Nome da rua"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Número
              </label>
              <input
                value={(store as Store & { number?: string }).number ?? ""}
                onChange={(e) => setStore({ ...store, number: e.target.value } as Store & { number?: string })}
                className={inputCls}
                placeholder="123"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Complemento
              </label>
              <input
                value={(store as Store & { complement?: string }).complement ?? ""}
                onChange={(e) => setStore({ ...store, complement: e.target.value } as Store & { complement?: string })}
                className={inputCls}
                placeholder="Sala, bloco…"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Bairro
            </label>
            <input
              value={store.neighborhood ?? ""}
              onChange={(e) => setStore({ ...store, neighborhood: e.target.value })}
              className={inputCls}
              placeholder="Nome do bairro"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Cidade
            </label>
            <input
              value={store.city ?? ""}
              onChange={(e) => setStore({ ...store, city: e.target.value })}
              className={inputCls}
              placeholder="Sua cidade"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Estado (UF)
            </label>
            <input
              value={store.state ?? ""}
              onChange={(e) => setStore({ ...store, state: e.target.value.toUpperCase().slice(0, 2) })}
              className={inputCls}
              placeholder="SP"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      {/* Product types multi-select */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h2 className="text-base font-black text-[#0f172a]">Tipos de produtos que você vende</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Selecione todas as categorias de itens que sua loja oferece. Elas aparecem como navegação rápida na sua vitrine.
            </p>
          </div>
          <span className="ml-4 shrink-0 rounded-full bg-[#16a34a]/10 px-3 py-1 text-xs font-black text-[#16a34a]">
            {selectedTypes.length} selecionado{selectedTypes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Selected preview */}
        {selectedTypes.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-[#16a34a]/20 bg-[#16a34a]/5 p-3">
            {selectedTypes.map((slug) => {
              const cat = categories.find((c) => c.slug === slug);
              if (!cat) return null;
              return (
                <span
                  key={slug}
                  className="flex items-center gap-1.5 rounded-full bg-[#16a34a] px-3 py-1 text-xs font-black text-white"
                >
                  {categoryIcons[slug] ?? "✨"} {cat.name}
                  <button
                    onClick={() => toggleType(slug)}
                    className="ml-0.5 text-white/70 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Category grid */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {categories.map((cat) => {
            const active = selectedTypes.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                onClick={() => toggleType(cat.slug)}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all ${
                  active
                    ? "border-[#16a34a]/40 bg-[#16a34a]/8 ring-1 ring-[#16a34a]/30"
                    : "border-[#e2e8f0] bg-[#f8fafc] hover:border-[#16a34a]/20 hover:bg-[#16a34a]/4"
                }`}
              >
                {active && (
                  <CheckCircle2
                    size={14}
                    className="absolute right-2 top-2 text-[#16a34a]"
                  />
                )}
                <span className="text-2xl leading-none">
                  {categoryIcons[cat.slug] ?? "✨"}
                </span>
                <span
                  className={`text-[10px] font-black uppercase leading-tight tracking-wide ${
                    active ? "text-[#16a34a]" : "text-[#475569]"
                  }`}
                >
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 ${
          saved
            ? "bg-[#16a34a] shadow-green-200"
            : "bg-gradient-to-r from-[#16a34a] to-[#15803d] shadow-[#16a34a]/30"
        }`}
      >
        {saving ? "Salvando…" : saved ? "✓ Salvo com sucesso!" : "Salvar alterações"}
      </button>

      {saveError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm font-semibold text-red-700">{saveError}</p>
        </div>
      )}
    </div>
  );
}
