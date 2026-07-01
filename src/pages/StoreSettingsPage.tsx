import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, MapPin, Store as StoreIcon, Upload, X, Trash2, AlertTriangle, Banknote, Clock } from "lucide-react";

import {
  getStoreById,
  updateStore,
  uploadProductImage,
  deleteAccount,
  getAsaasAccountStatus,
  connectAsaasAccount,
  getStoreHours,
  updateStoreHours,
  type Store,
  type UpdateStorePayload,
  type AsaasAccountInfo,
  type StoreHour,
} from "../services/gizApi";
import { getAuth, logout } from "../services/auth";
import { clearAllCaches } from "../services/gizApi";
import { sanitizeText, sanitizeUF } from "../utils/sanitize";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";

const inputCls =
  "w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";


export default function StoreSettingsPage() {
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // selected product-type slugs (persisted in store.category as "slug1,slug2,…")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Store hours state
  const [hours, setHours] = useState<StoreHour[]>([]);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Asaas subaccount state (only for CNPJ vendors)
  const auth = getAuth();
  const isCnpj = auth?.documentType === "cnpj";
  const [asaasAccount, setAsaasAccount] = useState<AsaasAccountInfo | null>(null);
  const [asaasLoading, setAsaasLoading] = useState(false);
  const [asaasConnecting, setAsaasConnecting] = useState(false);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [asaasSuccess, setAsaasSuccess] = useState(false);
  const [showAsaasForm, setShowAsaasForm] = useState(false);
  const [asaasForm, setAsaasForm] = useState({
    cpfCnpj: "", name: "", email: "", phone: "",
    address: "", addressNumber: "", complement: "", province: "", postalCode: "",
  });

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        const storeId = auth?.storeId;
        if (!storeId) throw new Error("Loja não encontrada para este usuário.");
        const data = await getStoreById(storeId);
        setStore(data);
        if (data.category) {
          setSelectedTypes(data.category.split(",").map((s) => s.trim()).filter(Boolean));
        }
        // Pre-fill Asaas form with store data
        setAsaasForm(f => ({
          ...f,
          name:          data.name ?? "",
          email:         data.email ?? "",
          phone:         data.phone ?? data.whatsapp ?? "",
          address:       data.address ?? "",
          addressNumber: data.number ?? "",
          complement:    data.complement ?? "",
          province:      data.neighborhood ?? "",
          postalCode:    data.zipCode ?? "",
        }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    async function loadHours() {
      const storeId = auth?.storeId;
      if (!storeId) return;
      try {
        const h = await getStoreHours(storeId);
        setHours(h);
      } catch { /* usa padrão vazio */ }
    }

    async function loadAsaasAccount() {
      if (!isCnpj) return;
      setAsaasLoading(true);
      try {
        const status = await getAsaasAccountStatus();
        if (status.connected && status.account) setAsaasAccount(status.account);
      } catch { /* ignore */ } finally {
        setAsaasLoading(false);
      }
    }

    void loadStore();
    void loadAsaasAccount();
    void loadHours();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveHours() {
    const storeId = auth?.storeId;
    if (!storeId || hours.length !== 7) return;
    setHoursSaving(true);
    setHoursError(null);
    setHoursSaved(false);
    try {
      const updated = await updateStoreHours(storeId, hours);
      setHours(updated);
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 3000);
    } catch (e) {
      setHoursError(e instanceof Error ? e.message : "Erro ao salvar horários.");
    } finally {
      setHoursSaving(false);
    }
  }

  function setHour(day: number, field: keyof StoreHour, value: string | boolean) {
    setHours(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h));
  }

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
          address: sanitizeText(data.logradouro) || store.address || "",
          neighborhood: sanitizeText(data.bairro) || store.neighborhood || "",
          city: sanitizeText(data.localidade) || store.city || "",
          state: sanitizeUF(data.uf) || store.state || "",
        });
      }
    } catch {
      // ignore CEP lookup errors
    } finally {
      setCepLoading(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !store) return;
    setLogoUploadError(null);
    try {
      setLogoUploading(true);
      const url = await uploadProductImage(file);
      setStore({ ...store, logoUrl: url });
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : "Erro ao enviar logo.");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !store) return;
    setBannerUploadError(null);
    try {
      setBannerUploading(true);
      const url = await uploadProductImage(file);
      setStore({ ...store, bannerUrl: url });
    } catch (err) {
      setBannerUploadError(err instanceof Error ? err.message : "Erro ao enviar banner.");
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!store) return;
    setSaveError(null);
    try {
      setSaving(true);
      // Payload restrito — exclui campos server-managed (rating, featured, active, etc.)
      const payload: UpdateStorePayload = {
        name: store.name,
        description: store.description,
        category: selectedTypes.join(","),
        phone: store.phone,
        whatsapp: store.whatsapp,
        email: store.email,
        address: store.address,
        number: store.number,
        complement: store.complement,
        neighborhood: store.neighborhood,
        city: store.city,
        state: store.state,
        zipCode: store.zipCode,
        deliveryFee: store.deliveryFee,
        deliveryTimeMin: store.deliveryTimeMin,
        deliveryTimeMax: store.deliveryTimeMax,
        isOpen: store.isOpen,
        logoUrl: store.logoUrl,
        bannerUrl: store.bannerUrl,
      };
      await updateStore(store.id, payload);
      setStore({ ...store, category: selectedTypes.join(",") });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Erro ao atualizar loja.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAsaasConnect() {
    setAsaasError(null);
    const cnpj = asaasForm.cpfCnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) { setAsaasError("Informe um CNPJ válido (14 dígitos)."); return; }
    if (!asaasForm.name.trim()) { setAsaasError("Nome da empresa é obrigatório."); return; }
    if (!asaasForm.email.trim()) { setAsaasError("E-mail é obrigatório."); return; }
    if (!asaasForm.phone.trim()) { setAsaasError("Telefone é obrigatório."); return; }
    if (!asaasForm.postalCode.replace(/\D/g, "")) { setAsaasError("CEP é obrigatório."); return; }

    setAsaasConnecting(true);
    try {
      await connectAsaasAccount({ ...asaasForm, cpfCnpj: asaasForm.cpfCnpj });
      setAsaasSuccess(true);
      setShowAsaasForm(false);
      const status = await getAsaasAccountStatus();
      if (status.connected && status.account) setAsaasAccount(status.account);
      setTimeout(() => setAsaasSuccess(false), 4000);
    } catch (err) {
      setAsaasError(err instanceof Error ? err.message : "Erro ao conectar conta.");
    } finally {
      setAsaasConnecting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      clearAllCaches();
      logout();
      navigate("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir conta.");
      setDeleting(false);
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

      {/* Aparência no Shopping */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f59e0b]/10">
            <ImageIcon size={16} className="text-[#f59e0b]" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#0f172a]">Aparência no BrasUX Shopping</h2>
            <p className="text-xs text-[#64748b]">Como sua loja aparece para os clientes no app</p>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Logo da loja
            </label>
            <span className="text-[10px] text-[#94a3b8]">Recomendado: 200 × 200 px</span>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] transition-colors hover:border-[#16a34a]/40"
              onClick={() => !logoUploading && logoInputRef.current?.click()}
            >
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={22} className="text-[#cbd5e1]" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/40">
                {logoUploading
                  ? <Loader2 size={16} className="animate-spin text-white opacity-0 group-hover:opacity-100" />
                  : <Upload size={16} className="text-white opacity-0 group-hover:opacity-100" />
                }
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0f172a]">
                {store.logoUrl ? "Logo configurado" : "Sem logo"}
              </p>
              <p className="mt-0.5 text-xs text-[#94a3b8]">
                Aparece no card da loja e no cabeçalho do shopping.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-bold text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {store.logoUrl ? "Trocar" : "Enviar logo"}
                </button>
                {store.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setStore({ ...store, logoUrl: undefined })}
                    className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <X size={12} /> Remover
                  </button>
                )}
              </div>
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          {logoUploadError && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
              <AlertCircle size={13} className="shrink-0 text-red-500" />
              <p className="text-xs font-semibold text-red-700">{logoUploadError}</p>
            </div>
          )}
        </div>

        {/* Banner */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
              Banner da loja
            </label>
            <span className="text-[10px] text-[#94a3b8]">Recomendado: 1200 × 400 px</span>
          </div>

          <div
            className="group relative cursor-pointer overflow-hidden rounded-2xl"
            style={{ aspectRatio: "3 / 1" }}
            onClick={() => !store.bannerUrl && !bannerUploading && bannerInputRef.current?.click()}
          >
            {store.bannerUrl ? (
              <img
                src={store.bannerUrl}
                alt="Banner da loja"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-2 select-none"
                style={{
                  background: "linear-gradient(135deg, #0f172a 0%, #14532d 55%, #16a34a 100%)",
                }}
              >
                <p className="text-2xl font-black tracking-tight text-white drop-shadow-lg px-6 text-center">
                  {store.name}
                </p>
                <p className="text-[11px] font-semibold text-white/40">
                  Clique para adicionar seu banner
                </p>
              </div>
            )}

            {/* Overlay de ações */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/0 transition-all duration-200 group-hover:bg-black/45">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); bannerInputRef.current?.click(); }}
                disabled={bannerUploading}
                className="flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-black text-[#0f172a] opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:bg-white disabled:opacity-50"
              >
                {bannerUploading
                  ? <><Loader2 size={13} className="animate-spin" /> Enviando…</>
                  : <><Upload size={13} /> {store.bannerUrl ? "Trocar banner" : "Adicionar banner"}</>
                }
              </button>
              {store.bannerUrl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setStore({ ...store, bannerUrl: undefined }); }}
                  disabled={bannerUploading}
                  className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-xs font-black text-white opacity-0 shadow-lg transition-all group-hover:opacity-100 hover:bg-red-500 disabled:opacity-50"
                >
                  <X size={13} /> Remover
                </button>
              )}
            </div>
          </div>

          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerUpload}
          />

          {bannerUploadError && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
              <AlertCircle size={13} className="shrink-0 text-red-500" />
              <p className="text-xs font-semibold text-red-700">{bannerUploadError}</p>
            </div>
          )}

          <p className="mt-2 text-[11px] text-[#94a3b8]">
            {store.bannerUrl
              ? "Passe o mouse sobre o banner para trocar ou remover."
              : "Sem banner personalizado — o nome da loja é exibido automaticamente."}
          </p>
        </div>
      </div>

      {/* Basic info */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
            <StoreIcon size={16} className="text-[#16a34a]" />
          </div>
          <h2 className="text-base font-black text-[#0f172a]">Informações básicas</h2>
        </div>

        {/* Documento do responsável — exibe versão mascarada (nunca o número completo) */}
        {(() => {
          const auth = getAuth();
          const masked = auth?.documentMasked;
          const label = (auth?.documentType ?? "cpf").toUpperCase();
          if (!masked) return null;
          return (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">{label} do responsável</p>
                <p className="mt-0.5 font-black text-[#0f172a]">{masked}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[10px] font-black text-[#16a34a] ring-1 ring-[#16a34a]/20">
                Verificado
              </span>
            </div>
          );
        })()}

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
                value={store.number ?? ""}
                onChange={(e) => setStore({ ...store, number: e.target.value })}
                className={inputCls}
                placeholder="123"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                Complemento
              </label>
              <input
                value={store.complement ?? ""}
                onChange={(e) => setStore({ ...store, complement: e.target.value })}
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

      {/* Conta de Recebimento — somente para CNPJ */}
      {isCnpj && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7c3aed]/10">
              <Banknote size={16} className="text-[#7c3aed]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0f172a]">Conta de Recebimento</h2>
              <p className="text-xs text-[#64748b]">Habilita split automático de pagamentos pelo Asaas</p>
            </div>
            {asaasLoading && <Loader2 size={14} className="ml-auto animate-spin text-[#94a3b8]" />}
          </div>

          {asaasAccount ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
                <CheckCircle2 size={16} className="shrink-0 text-[#16a34a]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#0f172a]">Conta conectada</p>
                  <p className="truncate text-xs text-[#16a34a]">{asaasAccount.accountName ?? "—"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-[10px] font-black text-[#16a34a]">
                  KYC: {asaasAccount.kycStatus ?? "—"}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">
                Split ativado — pagamentos do marketplace serão repassados automaticamente para sua conta.
              </p>
            </div>
          ) : !showAsaasForm ? (
            <div className="space-y-3">
              {asaasSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2">
                  <CheckCircle2 size={13} className="shrink-0 text-[#16a34a]" />
                  <p className="text-xs font-semibold text-[#16a34a]">Conta conectada com sucesso!</p>
                </div>
              )}
              <p className="text-sm text-[#64748b]">
                Empresas (CNPJ) podem registrar uma subconta Asaas para receber automaticamente o repasse de vendas via split de pagamento.
              </p>
              <button
                type="button"
                onClick={() => setShowAsaasForm(true)}
                className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-black text-white hover:bg-[#6d28d9]"
              >
                <Banknote size={14} /> Conectar conta de recebimento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">CNPJ</label>
                  <input
                    value={asaasForm.cpfCnpj}
                    onChange={e => setAsaasForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                    className={inputCls}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Nome da empresa</label>
                  <input
                    value={asaasForm.name}
                    onChange={e => setAsaasForm(f => ({ ...f, name: e.target.value }))}
                    className={inputCls}
                    placeholder="Razão social ou nome fantasia"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">E-mail</label>
                  <input
                    type="email"
                    value={asaasForm.email}
                    onChange={e => setAsaasForm(f => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                    placeholder="empresa@exemplo.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Telefone</label>
                  <input
                    value={asaasForm.phone}
                    onChange={e => setAsaasForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">CEP</label>
                  <input
                    value={asaasForm.postalCode}
                    onChange={e => setAsaasForm(f => ({ ...f, postalCode: e.target.value }))}
                    className={inputCls}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Endereço</label>
                  <input
                    value={asaasForm.address}
                    onChange={e => setAsaasForm(f => ({ ...f, address: e.target.value }))}
                    className={inputCls}
                    placeholder="Rua / Avenida"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Número</label>
                  <input
                    value={asaasForm.addressNumber}
                    onChange={e => setAsaasForm(f => ({ ...f, addressNumber: e.target.value }))}
                    className={inputCls}
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Bairro</label>
                  <input
                    value={asaasForm.province}
                    onChange={e => setAsaasForm(f => ({ ...f, province: e.target.value }))}
                    className={inputCls}
                    placeholder="Nome do bairro"
                  />
                </div>
              </div>

              {asaasError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                  <AlertCircle size={13} className="shrink-0 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{asaasError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAsaasForm(false); setAsaasError(null); }}
                  className="flex-1 rounded-2xl border border-[#e2e8f0] py-2.5 text-xs font-black text-[#64748b] hover:bg-[#f8fafc]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleAsaasConnect()}
                  disabled={asaasConnecting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#7c3aed] py-2.5 text-xs font-black text-white hover:bg-[#6d28d9] disabled:opacity-60"
                >
                  {asaasConnecting ? <><Loader2 size={13} className="animate-spin" /> Conectando…</> : "Conectar conta"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Horários de Funcionamento ─────────────────────────────────────── */}
      {hours.length === 7 && (
        <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f0fdf4]">
              <Clock size={16} className="text-[#16a34a]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#0f172a]">Horários de Funcionamento</h2>
              <p className="text-xs text-[#94a3b8]">O status "aberto/fechado" é atualizado automaticamente</p>
            </div>
          </div>

          <div className="space-y-2">
            {hours.map(h => (
              <div key={h.day} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${h.isOpen ? "bg-[#f0fdf4]" : "bg-[#f8fafc]"}`}>
                {/* Toggle aberto/fechado */}
                <button
                  type="button"
                  onClick={() => setHour(h.day, "isOpen", !h.isOpen)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${h.isOpen ? "bg-[#16a34a]" : "bg-[#cbd5e1]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${h.isOpen ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>

                {/* Nome do dia */}
                <span className={`w-16 text-sm font-black ${h.isOpen ? "text-[#0f172a]" : "text-[#94a3b8]"}`}>
                  {h.label.slice(0, 3)}
                </span>

                {h.isOpen ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="time"
                      value={h.openTime}
                      onChange={e => setHour(h.day, "openTime", e.target.value)}
                      className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                    />
                    <span className="text-xs font-bold text-[#94a3b8]">até</span>
                    <input
                      type="time"
                      value={h.closeTime}
                      onChange={e => setHour(h.day, "closeTime", e.target.value)}
                      className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                    />
                  </div>
                ) : (
                  <span className="flex-1 text-xs font-semibold text-[#cbd5e1]">Fechado</span>
                )}
              </div>
            ))}
          </div>

          {hoursError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
              <AlertCircle size={13} className="shrink-0 text-red-500" />
              <p className="text-xs font-semibold text-red-700">{hoursError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveHours}
            disabled={hoursSaving}
            className={`mt-4 w-full rounded-2xl py-3 text-sm font-black text-white transition-all disabled:opacity-60 ${hoursSaved ? "bg-[#16a34a]" : "bg-gradient-to-r from-[#16a34a] to-[#15803d]"}`}
          >
            {hoursSaving ? "Salvando…" : hoursSaved ? "✓ Horários salvos!" : "Salvar horários"}
          </button>
        </div>
      )}

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

      {/* Danger zone */}
      <div className="rounded-3xl border border-red-100 bg-red-50/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-red-700">Zona de Perigo</h2>
            <p className="text-xs text-red-500">Ações irreversíveis</p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-red-100 bg-white p-4">
          <div>
            <p className="text-sm font-black text-[#0f172a]">Excluir minha conta</p>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Remove permanentemente sua conta, loja e todos os dados associados. Esta ação não pode ser desfeita.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); setDeleteError(null); }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-600 transition-colors hover:bg-red-100"
          >
            <Trash2 size={13} /> Excluir conta
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,17,32,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h2 className="text-xl font-black text-[#0f172a]">Excluir conta definitivamente?</h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Todos os seus dados, produtos e histórico de pedidos serão removidos permanentemente.
              Para confirmar, digite o nome da sua loja:
            </p>
            <p className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-sm font-black text-[#0f172a]">
              {store.name}
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={`Digite "${store.name}"`}
              className="mt-3 w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-red-300 placeholder:text-[#cbd5e1]"
            />
            {deleteError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                <AlertCircle size={13} className="shrink-0 text-red-500" />
                <p className="text-xs font-semibold text-red-700">{deleteError}</p>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] transition-colors hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== store.name || deleting}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Excluindo…</> : "Excluir conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
