import { useState, useEffect, useCallback } from "react";
import {
  Wallet, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight,
  Loader2, AlertTriangle, X, Check, RefreshCw,
} from "lucide-react";
import {
  getVendorWallet, getVendorSubscription,
  requestVendorWithdrawal,
  type VendorWallet, type VendorSubscription,
} from "../services/wallet";

// ── Formatters ────────────────────────────────────────────────────────────────

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const PLAN_LABELS: Record<string, string> = {
  free:       "Free",
  start:      "Básico",
  pro:        "Premium",
  whitelabel: "White Label",
};

const PIX_TYPES = [
  { value: "cpf",    label: "CPF" },
  { value: "cnpj",   label: "CNPJ" },
  { value: "phone",  label: "Telefone" },
  { value: "email",  label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function WalletPage() {
  const [wallet, setWallet]       = useState<VendorWallet | null>(null);
  const [sub, setSub]             = useState<VendorSubscription | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Modal state
  const [amount, setAmount]         = useState("");
  const [pixType, setPixType]       = useState("cpf");
  const [pixKey, setPixKey]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalErr, setModalErr]     = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, s] = await Promise.all([getVendorWallet(), getVendorSubscription()]);
      setWallet(w);
      setSub(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar carteira.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleWithdraw() {
    setModalErr(null);
    const amtNum = parseFloat(amount.replace(",", "."));
    if (!amtNum || amtNum < 10) { setModalErr("Valor mínimo para saque: R$ 10,00."); return; }
    if (!pixKey.trim())         { setModalErr("Informe a chave PIX."); return; }
    if (wallet && amtNum > wallet.balance) { setModalErr("Saldo insuficiente."); return; }

    setSubmitting(true);
    try {
      await requestVendorWithdrawal(amtNum, pixKey.trim(), pixType);
      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setAmount("");
        setPixKey("");
        void load();
      }, 2000);
    } catch (e) {
      setModalErr(e instanceof Error ? e.message : "Erro ao solicitar saque.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle size={28} className="text-orange-400" />
        <p className="text-sm font-semibold text-[#64748b]">{error}</p>
        <p className="text-xs text-[#94a3b8]">Certifique-se de estar logado com sua conta BrasUX para acessar dados financeiros.</p>
        <button onClick={() => void load()}
          className="mt-2 flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-black text-white">
          <RefreshCw size={13} /> Tentar novamente
        </button>
      </div>
    );
  }

  const balance     = wallet?.balance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const held        = wallet?.held ?? 0;
  const txs         = wallet?.transactions ?? [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Financeiro</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Carteira</h1>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-black text-[#64748b] hover:border-[#cbd5e1]"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Cards de saldo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Saldo disponível */}
        <div
          className="rounded-3xl p-6"
          style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0" }}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: "rgba(22,163,74,0.12)" }}>
            <Wallet size={18} style={{ color: "#16a34a" }} />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Disponível</p>
          <p className="mt-1 text-3xl font-black text-[#0f172a]">{brl(balance)}</p>
          <button
            onClick={() => setShowModal(true)}
            disabled={balance <= 0}
            className="mt-4 w-full rounded-xl py-2.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 12px rgba(22,163,74,0.35)" }}
          >
            Solicitar saque
          </button>
        </div>

        {/* Retido */}
        <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50">
            <Clock size={18} className="text-orange-500" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Em repasse</p>
          <p className="mt-1 text-3xl font-black text-[#0f172a]">{brl(held)}</p>
          <p className="mt-2 text-xs text-[#94a3b8]">Pedidos aguardando liquidação</p>
        </div>

        {/* Total ganho */}
        <div className="rounded-3xl border border-[#e2e8f0] bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
            <TrendingUp size={18} className="text-blue-500" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Total recebido</p>
          <p className="mt-1 text-3xl font-black text-[#0f172a]">{brl(totalEarned)}</p>
          <p className="mt-2 text-xs text-[#94a3b8]">
            Comissão: {sub ? `${(sub.commissionRate * 100).toFixed(0)}%` : "—"} — Plano {PLAN_LABELS[sub?.plan ?? "free"] ?? sub?.plan}
          </p>
        </div>
      </div>

      {/* Extrato */}
      <div className="rounded-3xl border border-[#e2e8f0] bg-white">
        <div className="border-b border-[#f1f5f9] px-6 py-4">
          <h2 className="text-sm font-black text-[#0f172a]">Extrato</h2>
          <p className="text-xs text-[#94a3b8]">Últimas 50 movimentações</p>
        </div>

        {txs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#94a3b8]">Nenhuma movimentação ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#f1f5f9]">
            {txs.map(tx => {
              const isIn = tx.direction === "in";
              return (
                <li key={tx.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: isIn ? "#f0fdf4" : "#fff7ed" }}
                  >
                    {isIn
                      ? <ArrowDownLeft size={16} style={{ color: "#16a34a" }} />
                      : <ArrowUpRight  size={16} className="text-orange-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0f172a]">{tx.description}</p>
                    <p className="text-xs text-[#94a3b8]">{relativeDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-black"
                      style={{ color: isIn ? "#16a34a" : "#ef4444" }}
                    >
                      {isIn ? "+" : "−"}{brl(tx.amount)}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] capitalize">{tx.status}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal de saque */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,17,32,0.65)", backdropFilter: "blur(5px)" }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0fdf4]">
                  <Check size={22} className="text-[#16a34a]" />
                </div>
                <h2 className="text-xl font-black text-[#0f172a]">Saque solicitado!</h2>
                <p className="text-sm text-[#64748b]">
                  Seu saque será processado em até 1 dia útil via PIX.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#0f172a]">Solicitar saque</h2>
                  <button onClick={() => { setShowModal(false); setModalErr(null); }}
                    className="rounded-lg p-1.5 text-[#94a3b8] hover:text-[#0f172a]">
                    <X size={16} />
                  </button>
                </div>

                <p className="mb-4 text-xs text-[#94a3b8]">
                  Saldo disponível: <strong className="text-[#16a34a]">{brl(balance)}</strong>
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-black text-[#64748b]">Valor (R$)</label>
                    <input
                      type="number"
                      min="10"
                      max={balance}
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#16a34a]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-black text-[#64748b]">Tipo de chave PIX</label>
                    <select
                      value={pixType}
                      onChange={e => setPixType(e.target.value)}
                      className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#16a34a]"
                    >
                      {PIX_TYPES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-black text-[#64748b]">Chave PIX</label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={e => setPixKey(e.target.value)}
                      placeholder="Informe a chave PIX"
                      className="w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#16a34a]"
                    />
                  </div>
                </div>

                {modalErr && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                    <AlertTriangle size={13} className="shrink-0 text-red-500" />
                    <p className="text-xs font-semibold text-red-700">{modalErr}</p>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => { setShowModal(false); setModalErr(null); }}
                    disabled={submitting}
                    className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleWithdraw()}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                  >
                    {submitting ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : "Confirmar saque"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
