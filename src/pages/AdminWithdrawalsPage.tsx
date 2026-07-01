import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, RefreshCw, Loader2,
  Banknote, User, Clock, AlertCircle,
} from "lucide-react";
import { getAdminWithdrawals, updateWithdrawal, type Withdrawal } from "../services/gizApi";

const STATUS_TABS = [
  { value: "pending",    label: "Pendentes" },
  { value: "processing", label: "Em processo" },
  { value: "paid",       label: "Pagos" },
  { value: "failed",     label: "Falhos" },
  { value: "cancelled",  label: "Cancelados" },
];

const OWNER_TYPE_LABEL: Record<string, string> = {
  vendor:  "Lojista",
  courier: "Entregador",
};

const PIX_TYPE_LABEL: Record<string, string> = {
  cpf:    "CPF",
  cnpj:   "CNPJ",
  phone:  "Telefone",
  email:  "E-mail",
  random: "Chave aleatória",
};

function formatBRL(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-BR");
}

export default function AdminWithdrawalsPage() {
  const [tab,        setTab]        = useState("pending");
  const [items,      setItems]      = useState<Withdrawal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [actionId,   setActionId]   = useState<string | null>(null);
  const [actionErr,  setActionErr]  = useState<string | null>(null);
  const [pixRef,     setPixRef]     = useState<Record<string, string>>({});
  const [notes,      setNotes]      = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await getAdminWithdrawals(tab));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tab]);

  async function handleAction(id: string, status: "paid" | "failed" | "cancelled") {
    setActionId(id);
    setActionErr(null);
    try {
      await updateWithdrawal(id, status, pixRef[id], notes[id]);
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Administração</p>
        <h1 className="mt-1 text-2xl font-black text-[#0f172a]">Gestão de Saques</h1>
        <p className="mt-0.5 text-sm text-[#94a3b8]">Aprovar e processar solicitações de saque de lojistas e entregadores</p>
      </div>

      {/* Status tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              tab === t.value
                ? "bg-[#16a34a] text-white shadow-sm"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={() => void load()} disabled={loading}
          className="ml-auto flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-black text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {actionErr && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={14} /> {actionErr}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#16a34a]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Banknote size={40} className="text-[#cbd5e1]" />
          <p className="font-black text-[#94a3b8]">Nenhum saque {STATUS_TABS.find(t => t.value === tab)?.label.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(w => (
            <div key={w.id} className="rounded-3xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-[#f8fafc] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0fdf4]">
                    <User size={16} className="text-[#16a34a]" />
                  </div>
                  <div>
                    <p className="font-black text-[#0f172a]">{w.ownerName}</p>
                    <p className="text-xs text-[#94a3b8]">
                      {OWNER_TYPE_LABEL[w.ownerType] ?? w.ownerType} · {w.ownerEmail}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#0f172a]">{formatBRL(w.amountNet)}</p>
                  {w.withdrawalFee > 0 && (
                    <p className="text-[10px] text-[#94a3b8]">
                      Bruto: {formatBRL(w.amountGross)} · Taxa: {formatBRL(w.withdrawalFee)}
                    </p>
                  )}
                </div>
              </div>

              {/* PIX info */}
              <div className="grid grid-cols-2 gap-4 px-6 py-4 text-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Chave PIX</p>
                  <p className="mt-0.5 font-black text-[#0f172a]">{w.pixKey}</p>
                  <p className="text-xs text-[#94a3b8]">{PIX_TYPE_LABEL[w.pixKeyType] ?? w.pixKeyType}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Solicitado em</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#64748b]">
                    <Clock size={11} /> {formatDate(w.createdAt)}
                  </div>
                  {w.processedAt && (
                    <p className="text-xs text-[#94a3b8]">Processado: {formatDate(w.processedAt)}</p>
                  )}
                </div>
                {w.notes && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Notas</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">{w.notes}</p>
                  </div>
                )}
                {w.gatewayReference && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Comprovante / Ref.</p>
                    <p className="mt-0.5 font-mono text-xs text-[#64748b]">{w.gatewayReference}</p>
                  </div>
                )}
              </div>

              {/* Actions — só para pending/processing */}
              {(w.status === "pending" || w.status === "processing") && (
                <div className="border-t border-[#f8fafc] px-6 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Comprovante / Ref. do PIX
                      </label>
                      <input
                        type="text"
                        placeholder="ID da transação ou comprovante"
                        value={pixRef[w.id] ?? ""}
                        onChange={e => setPixRef(prev => ({ ...prev, [w.id]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                        Notas internas
                      </label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={notes[w.id] ?? ""}
                        onChange={e => setNotes(prev => ({ ...prev, [w.id]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#0f172a] outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleAction(w.id, "paid")}
                      disabled={actionId === w.id}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                    >
                      {actionId === w.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <CheckCircle2 size={14} />}
                      PIX Enviado ✓
                    </button>
                    <button
                      onClick={() => void handleAction(w.id, "failed")}
                      disabled={actionId === w.id}
                      className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-black text-red-600 hover:bg-red-100 disabled:opacity-60"
                    >
                      <XCircle size={14} /> Falhou
                    </button>
                    <button
                      onClick={() => void handleAction(w.id, "cancelled")}
                      disabled={actionId === w.id}
                      className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-black text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
