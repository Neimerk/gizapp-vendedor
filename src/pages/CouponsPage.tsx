import { useEffect, useState } from "react";
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { getCoupons, createCoupon, toggleCoupon, deleteCoupon, type Coupon } from "../services/gizApi";

function formatBRL(v: number) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }

const EMPTY_FORM = {
  code: "", description: "", discountType: "percent" as "percent" | "fixed",
  discountValue: "", minOrderValue: "", maxUses: "", validFrom: "", validUntil: "",
};

export default function CouponsPage() {
  const [coupons,   setCoupons]   = useState<Coupon[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState<string | null>(null);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setCoupons(await getCoupons()); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveErr(null);
    try {
      await createCoupon({
        code:           form.code,
        description:    form.description || undefined,
        discountType:   form.discountType,
        discountValue:  Number(form.discountValue),
        minOrderValue:  form.minOrderValue ? Number(form.minOrderValue) : undefined,
        maxUses:        form.maxUses ? Number(form.maxUses) : undefined,
        validFrom:      form.validFrom || undefined,
        validUntil:     form.validUntil || undefined,
      });
      setShowForm(false); setForm(EMPTY_FORM); await load();
    } catch (e) { setSaveErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: string, active: boolean) {
    setToggling(id);
    try { setCoupons(prev => prev.map(c => c.id === id ? { ...c, active } : c)); await toggleCoupon(id, active); }
    catch { await load(); }
    finally { setToggling(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir cupom?")) return;
    setDeleting(id);
    try { await deleteCoupon(id); setCoupons(prev => prev.filter(c => c.id !== id)); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro."); }
    finally { setDeleting(null); }
  }

  const inp = "w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30";

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Marketing</p>
          <h1 className="mt-1 text-2xl font-black text-[#0f172a]">Cupons de Desconto</h1>
          <p className="mt-0.5 text-sm text-[#94a3b8]">Crie cupons para atrair e fidelizar clientes</p>
        </div>
        <button onClick={() => { setShowForm(true); setSaveErr(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 4px 12px rgba(22,163,74,.3)" }}>
          <Plus size={14} /> Novo cupom
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,17,32,.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#0f172a]">Novo Cupom</h2>
              <button onClick={() => setShowForm(false)} className="rounded-xl p-1.5 hover:bg-[#f8fafc]"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Código *</label>
                  <input required className={inp} value={form.code} placeholder="EX: DESCONTO10"
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Tipo *</label>
                  <select required className={inp} value={form.discountType}
                    onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "percent"|"fixed" }))}>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    {form.discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"} *
                  </label>
                  <input required type="number" min="0.01" step="0.01" className={inp} value={form.discountValue}
                    onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Pedido mínimo (R$)</label>
                  <input type="number" min="0" step="0.01" className={inp} value={form.minOrderValue} placeholder="0"
                    onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Máx. de usos</label>
                  <input type="number" min="1" className={inp} value={form.maxUses} placeholder="Ilimitado"
                    onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Válido de</label>
                  <input type="date" className={inp} value={form.validFrom}
                    onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Válido até</label>
                  <input type="date" className={inp} value={form.validUntil}
                    onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Descrição interna</label>
                  <input className={inp} value={form.description} placeholder="Opcional"
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              {saveErr && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                  <AlertCircle size={13} className="shrink-0 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{saveErr}</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-2xl border border-[#e2e8f0] py-3 text-sm font-black text-[#64748b] hover:bg-[#f8fafc]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  {saving ? "Criando…" : "Criar cupom"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#16a34a]" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Tag size={40} className="text-[#cbd5e1]" />
          <p className="font-black text-[#94a3b8]">Nenhum cupom criado ainda</p>
          <p className="text-sm text-[#cbd5e1]">Crie seu primeiro cupom para aumentar as vendas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(c => {
            const expired = c.validUntil && new Date(c.validUntil) < new Date();
            return (
              <div key={c.id} className={`rounded-3xl border p-5 transition-all ${c.active && !expired ? "border-[#e2e8f0] bg-white shadow-sm" : "border-[#f1f5f9] bg-[#f8fafc]"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${c.active && !expired ? "bg-[#f0fdf4]" : "bg-[#f1f5f9]"}`}>
                      <Tag size={16} className={c.active && !expired ? "text-[#16a34a]" : "text-[#94a3b8]"} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-[#0f172a]">{c.code}</span>
                        {expired && <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">Expirado</span>}
                        {!c.active && !expired && <span className="rounded-lg bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-black text-[#94a3b8]">Inativo</span>}
                      </div>
                      <p className="text-xs text-[#94a3b8]">{c.description || (c.discountType === "percent" ? `${c.discountValue}% de desconto` : `${formatBRL(c.discountValue)} de desconto`)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(c.id, !c.active)} disabled={toggling === c.id}
                      className="text-[#94a3b8] hover:text-[#16a34a] transition-colors disabled:opacity-50">
                      {toggling === c.id ? <Loader2 size={18} className="animate-spin" /> : c.active ? <ToggleRight size={22} className="text-[#16a34a]" /> : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      className="text-[#94a3b8] hover:text-red-500 transition-colors disabled:opacity-50">
                      {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-xl bg-[#f0fdf4] px-3 py-1 text-xs font-black text-[#16a34a]">
                    {c.discountType === "percent" ? `${c.discountValue}%` : formatBRL(c.discountValue)}
                  </span>
                  {c.minOrderValue > 0 && <span className="rounded-xl bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">mín. {formatBRL(c.minOrderValue)}</span>}
                  <span className="rounded-xl bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">{c.usesCount}{c.maxUses ? `/${c.maxUses}` : ""} usos</span>
                  {c.validUntil && <span className="rounded-xl bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">até {formatDate(c.validUntil)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
