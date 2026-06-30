import { useState } from "react";
import {
  Check, X, ArrowUp, ArrowDown, ChevronDown, ChevronUp,
  Package, Star, Store, Loader2, AlertTriangle, ExternalLink,
  Crown, Zap, Headphones, Globe, Shield, Code2, Users, BarChart3,
} from "lucide-react";
import { getAuth, updateAuthPlan } from "../services/auth";
import { changePlan } from "../services/gizApi";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PlanId = "free" | "start" | "pro" | "whitelabel";

type PlanMeta = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  limits: { products: string; featured: string; stores: string; categories: string; support: string };
  features: string[];
};

type CompareRow = {
  icon?: React.ElementType;
  category?: string;
  label: string;
  free: string | boolean;
  start: string | boolean;
  pro: string | boolean;
  whitelabel: string | boolean;
};

// ── Dados ─────────────────────────────────────────────────────────────────────

const PLANS: PlanMeta[] = [
  {
    id: "free" as PlanId,
    name: "Free",
    price: "R$0",
    period: "/mês",
    description: "Para quem está começando sem compromisso.",
    limits: { products: "50", featured: "3", stores: "1", categories: "3", support: "Comunidade" },
    features: [
      "50 produtos ativos",
      "3 destaques no Shopping",
      "3 categorias de loja",
      "1 loja por CPF/CNPJ",
      "Dashboard básico",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
    ],
  },
  {
    id: "start" as PlanId,
    name: "Básico",
    price: "R$49",
    period: "/mês",
    description: "Para lojistas que precisam de mais visibilidade.",
    limits: { products: "300", featured: "15", stores: "3", categories: "15", support: "E-mail" },
    features: [
      "300 produtos ativos",
      "15 destaques no Shopping",
      "15 categorias de loja",
      "Até 3 lojas por CPF/CNPJ",
      "Dashboard completo",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios básicos",
      "Suporte via e-mail",
    ],
  },
  {
    id: "pro" as PlanId,
    name: "Premium",
    price: "R$99",
    period: "/mês",
    description: "Para crescer com analytics avançados e múltiplas lojas.",
    badge: "Mais popular",
    limits: { products: "1.000", featured: "30", stores: "10", categories: "∞", support: "Prioritário" },
    features: [
      "1.000 produtos ativos",
      "30 destaques no Shopping",
      "Categorias ilimitadas",
      "Até 10 lojas por CPF/CNPJ",
      "Dashboard premium + insights",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios avançados com IA",
      "Acesso à API REST",
      "Suporte prioritário",
    ],
  },
  {
    id: "whitelabel" as PlanId,
    name: "White Label",
    price: "Consulte",
    period: "",
    description: "Solução enterprise com sua marca, domínio próprio e SLA garantido.",
    badge: "Enterprise",
    limits: { products: "∞", featured: "∞", stores: "∞", categories: "∞", support: "Dedicado 24/7" },
    features: [
      "Produtos ilimitados",
      "Destaques ilimitados",
      "Categorias ilimitadas",
      "Lojas ilimitadas",
      "Dashboard customizado",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios + BI integrado",
      "API REST + Webhooks",
      "Suporte dedicado 24/7",
      "Marca e logo próprios",
      "Domínio personalizado",
      "SLA 99,9% garantido",
      "Integração ERP/SAP",
      "Gerente de conta",
    ],
  },
];

const COMPARE: CompareRow[] = [
  { icon: Package, category: "Catálogo", label: "Produtos ativos", free: "50", start: "300", pro: "1.000", whitelabel: "Ilimitado" },
  { label: "Categorias de loja", free: "3", start: "15", pro: "Ilimitadas", whitelabel: "Ilimitadas" },
  { icon: Star, category: "Vitrine", label: "Destaques no Shopping", free: "3", start: "15", pro: "30", whitelabel: "Ilimitados" },
  { icon: Store, category: "Lojas", label: "Lojas por CPF/CNPJ", free: "1", start: "Até 3", pro: "Até 10", whitelabel: "Ilimitadas" },
  { icon: BarChart3, category: "Analytics", label: "Dashboard de KPIs", free: "Básico", start: "Completo", pro: "Premium", whitelabel: "Customizado" },
  { label: "Relatórios", free: false, start: "Básico", pro: "Avançado + IA", whitelabel: "BI integrado" },
  { icon: Zap, category: "Pedidos", label: "Pedidos por mês", free: "Ilimitados", start: "Ilimitados", pro: "Ilimitados", whitelabel: "Ilimitados" },
  { label: "WebSocket tempo real", free: true, start: true, pro: true, whitelabel: true },
  { label: "Gestão de entregas", free: true, start: true, pro: true, whitelabel: true },
  { icon: Code2, category: "API", label: "Acesso à API REST", free: false, start: false, pro: true, whitelabel: true },
  { label: "Webhooks", free: false, start: false, pro: false, whitelabel: true },
  { label: "Integração ERP/SAP", free: false, start: false, pro: false, whitelabel: true },
  { icon: Globe, category: "Marca", label: "Domínio personalizado", free: false, start: false, pro: false, whitelabel: true },
  { label: "Logo e marca próprios", free: false, start: false, pro: false, whitelabel: true },
  { icon: Shield, category: "SLA", label: "Uptime garantido (SLA)", free: false, start: false, pro: false, whitelabel: "99,9%" },
  { icon: Headphones, category: "Suporte", label: "Canal de suporte", free: "Comunidade", start: "E-mail", pro: "Prioritário", whitelabel: "Dedicado 24/7" },
  { icon: Users, category: "Conta", label: "Gerente de conta", free: false, start: false, pro: false, whitelabel: true },
];

const PLAN_ORDER: PlanId[] = ["free", "start", "pro", "whitelabel"];

function rank(id: PlanId) { return PLAN_ORDER.indexOf(id); }
function cellVal(row: CompareRow, id: PlanId): string | boolean {
  const key = id as keyof Pick<CompareRow, "free" | "start" | "pro" | "whitelabel">;
  return row[key] as string | boolean;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PlanManagementPage() {
  const auth = getAuth();
  const rawPlan = auth?.plan ?? "free";
  // Migrate legacy IDs that may still be in sessionStorage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialPlan: PlanId = ((rawPlan as any) === "basic" ? "start" : (rawPlan as any) === "premium" ? "pro" : (rawPlan as any) === "white" ? "whitelabel" : rawPlan) as PlanId;

  const [localPlan, setLocalPlan] = useState<PlanId>(initialPlan);
  const [pending, setPending]     = useState<PlanMeta | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const currentMeta = PLANS.find(p => p.id === localPlan)!;
  const isWhiteLabel = localPlan === "whitelabel";

  function getAction(plan: PlanMeta): "current" | "upgrade" | "downgrade" | "contact" {
    if (plan.id === "whitelabel") return "contact";
    if (plan.id === localPlan) return "current";
    return rank(plan.id) > rank(localPlan) ? "upgrade" : "downgrade";
  }

  async function handleChangePlan(target: PlanMeta) {
    if (target.id === "whitelabel" || target.id === localPlan) return;
    setLoading(true);
    setError(null);
    try {
      await changePlan(target.id as "free" | "start" | "pro" | "whitelabel");
      updateAuthPlan(target.id as "free" | "start" | "pro" | "whitelabel");
      setLocalPlan(target.id);
      setSuccess(`Plano alterado para ${target.name} com sucesso!`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar plano.");
    } finally {
      setLoading(false);
      setPending(null);
      setShowCancel(false);
    }
  }

  const freePlan = PLANS.find(p => p.id === "free")!;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Conta</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Plano e Assinatura</h1>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
          <Check size={16} className="shrink-0 text-green-600" />
          <p className="text-sm font-semibold text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 text-red-500" />
          <p className="text-sm font-semibold text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Plano atual ─────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 shadow-sm"
        style={{
          background: isWhiteLabel
            ? "linear-gradient(135deg, #0f172a, #1e293b)"
            : localPlan === "free"
            ? "white"
            : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
          border: localPlan === "free" ? "1px solid #e2e8f0" : "none",
          boxShadow: isWhiteLabel
            ? "0 12px 40px rgba(0,0,0,0.35)"
            : localPlan === "free"
            ? "0 2px 8px rgba(0,0,0,0.05)"
            : "0 12px 40px rgba(22,163,74,0.18)",
        }}
      >
        {/* Top row */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1"
              style={{
                background: isWhiteLabel ? "rgba(74,222,128,0.12)" : "rgba(22,163,74,0.1)",
              }}
            >
              <Crown size={11} style={{ color: isWhiteLabel ? "#4ade80" : "#16a34a" }} />
              <span
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: isWhiteLabel ? "#4ade80" : "#16a34a" }}
              >
                Plano atual
              </span>
            </div>
            <h2
              className="text-2xl font-black"
              style={{ color: isWhiteLabel ? "white" : "#0f172a" }}
            >
              {currentMeta.name}
            </h2>
            <p
              className="mt-0.5 text-sm"
              style={{ color: isWhiteLabel ? "rgba(255,255,255,0.5)" : "#64748b" }}
            >
              {currentMeta.description}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-3xl font-black"
              style={{ color: isWhiteLabel ? "white" : "#0f172a" }}
            >
              {currentMeta.price}
            </p>
            {currentMeta.period && (
              <p
                className="text-sm"
                style={{ color: isWhiteLabel ? "rgba(255,255,255,0.35)" : "#94a3b8" }}
              >
                {currentMeta.period}
              </p>
            )}
            {localPlan === "free" && (
              <p className="mt-1 text-xs font-semibold text-[#94a3b8]">Gratuito para sempre</p>
            )}
          </div>
        </div>

        {/* Métricas chave */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Produtos", value: currentMeta.limits.products, icon: Package },
            { label: "Destaques", value: currentMeta.limits.featured, icon: Star },
            { label: "Lojas", value: currentMeta.limits.stores, icon: Store },
            { label: "Suporte", value: currentMeta.limits.support, icon: Headphones },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl p-3"
              style={{
                background: isWhiteLabel
                  ? "rgba(255,255,255,0.06)"
                  : localPlan === "free"
                  ? "#f8fafc"
                  : "rgba(255,255,255,0.55)",
              }}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Icon size={11} style={{ color: isWhiteLabel ? "#4ade80" : "#94a3b8" }} />
                <p
                  className="text-[10px] font-black uppercase tracking-wide"
                  style={{ color: isWhiteLabel ? "rgba(255,255,255,0.3)" : "#94a3b8" }}
                >
                  {label}
                </p>
              </div>
              <p
                className="text-base font-black"
                style={{ color: isWhiteLabel ? "white" : "#0f172a" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards de plano ───────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-lg font-black text-[#0f172a]">Escolha seu plano</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const action  = getAction(plan);
            const isCur   = action === "current";
            const isWhite = plan.id === "whitelabel";
            const isUp    = action === "upgrade";

            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-3xl p-5 transition-all hover:-translate-y-0.5"
                style={{
                  border: isCur
                    ? "2px solid #16a34a"
                    : isWhite
                    ? "2px solid rgba(255,255,255,0.08)"
                    : "2px solid #e2e8f0",
                  background: isWhite
                    ? "linear-gradient(160deg, #0f172a, #1e293b)"
                    : isCur
                    ? "linear-gradient(160deg, #f0fdf4, #dcfce7)"
                    : "white",
                  boxShadow: isCur
                    ? "0 8px 28px rgba(22,163,74,0.18)"
                    : isWhite
                    ? "0 8px 28px rgba(0,0,0,0.28)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Badge */}
                {isCur && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#16a34a] px-3 py-1 text-[10px] font-black text-white shadow-sm">
                    ✓ Plano atual
                  </div>
                )}
                {!isCur && plan.badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-black text-white shadow-sm"
                    style={{ background: isWhite ? "#1e293b" : "#16a34a" }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Cabeçalho */}
                <div className="mb-4">
                  <p
                    className="mb-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ color: isWhite ? "rgba(255,255,255,0.35)" : "#94a3b8" }}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span
                      className="text-2xl font-black"
                      style={{ color: isWhite ? "white" : "#0f172a" }}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className="mb-0.5 text-sm"
                        style={{ color: isWhite ? "rgba(255,255,255,0.3)" : "#94a3b8" }}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1.5 text-xs leading-relaxed"
                    style={{ color: isWhite ? "rgba(255,255,255,0.45)" : "#64748b" }}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* CTA */}
                {isWhite ? (
                  <a
                    href="https://wa.me/5500000000000?text=Quero+saber+mais+sobre+o+White+Label+BrasUX"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition-all active:scale-95"
                    style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
                  >
                    <ExternalLink size={13} /> Falar com equipe
                  </a>
                ) : isCur ? (
                  <div
                    className="mb-4 rounded-xl py-2.5 text-center text-sm font-black"
                    style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}
                  >
                    ✓ Plano atual
                  </div>
                ) : isUp ? (
                  <button
                    onClick={() => { setError(null); setPending(plan); }}
                    disabled={loading}
                    className="mb-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 12px rgba(22,163,74,0.35)" }}
                  >
                    <ArrowUp size={13} /> Fazer upgrade
                  </button>
                ) : (
                  <button
                    onClick={() => { setError(null); setPending(plan); }}
                    disabled={loading}
                    className="mb-4 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-black transition-all active:scale-95 disabled:opacity-60"
                    style={{ borderColor: "#e2e8f0", color: "#64748b", background: "white" }}
                  >
                    <ArrowDown size={13} /> Fazer downgrade
                  </button>
                )}

                {/* Features (top 5) */}
                <ul className="mt-auto space-y-2">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check
                        size={13}
                        className="mt-0.5 shrink-0"
                        style={{ color: isWhite ? "#4ade80" : "#16a34a" }}
                      />
                      <span style={{ color: isWhite ? "rgba(255,255,255,0.65)" : "#475569" }}>{f}</span>
                    </li>
                  ))}
                  {plan.features.length > 5 && (
                    <li
                      className="pt-0.5 text-xs"
                      style={{ color: isWhite ? "rgba(255,255,255,0.25)" : "#94a3b8" }}
                    >
                      + {plan.features.length - 5} recursos incluídos
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Toggle comparativo ──────────────────────────────────────────── */}
      <button
        onClick={() => setShowCompare(!showCompare)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white py-3.5 text-sm font-bold text-[#64748b] shadow-sm transition-colors hover:bg-[#f8fafc]"
      >
        {showCompare
          ? <><ChevronUp size={16} /> Ocultar comparativo completo</>
          : <><ChevronDown size={16} /> Ver comparativo completo</>
        }
      </button>

      {/* ── Tabela comparativa ──────────────────────────────────────────── */}
      {showCompare && (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0]">
                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-[#94a3b8]">
                  Recurso
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    className="px-4 py-4 text-center text-xs font-black"
                    style={{ color: p.id === localPlan ? "#16a34a" : p.id === "whitelabel" ? "#0f172a" : "#64748b" }}
                  >
                    {p.name}
                    {p.id === localPlan && (
                      <span className="ml-1.5 rounded-full bg-[#16a34a] px-2 py-0.5 text-[9px] font-black text-white">
                        atual
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc] ${
                    row.category ? "border-t-2 border-t-[#e2e8f0]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    {row.category && (
                      <div className="mb-1 flex items-center gap-1.5">
                        {row.icon && <row.icon size={11} className="text-[#94a3b8]" />}
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">
                          {row.category}
                        </span>
                      </div>
                    )}
                    <span className="font-medium text-[#0f172a]">{row.label}</span>
                  </td>
                  {(["free", "start", "pro", "whitelabel"] as PlanId[]).map((pid) => {
                    const val = cellVal(row, pid);
                    return (
                      <td
                        key={pid}
                        className={`px-4 py-3 text-center ${pid === localPlan ? "bg-[#f0fdf4]/60" : ""}`}
                      >
                        {val === false
                          ? <X size={15} className="mx-auto text-[#cbd5e1]" />
                          : val === true
                          ? <Check size={15} className="mx-auto text-[#16a34a]" />
                          : <span className="text-xs font-semibold text-[#475569]">{val}</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cancelar assinatura ─────────────────────────────────────────── */}
      {localPlan !== "free" && localPlan !== "whitelabel" && (
        <div className="rounded-3xl border border-orange-100 bg-orange-50/40 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
              <AlertTriangle size={15} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-orange-700">Cancelar assinatura</h2>
              <p className="text-xs text-orange-500">Seu plano voltará para Free imediatamente</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-orange-100 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#0f172a]">Cancelar plano {currentMeta.name}</p>
              <p className="mt-0.5 text-xs text-[#64748b]">
                Seu plano voltará para Free. Produtos além de 50, destaques acima de 3 e lojas extras
                serão desativados automaticamente.
              </p>
            </div>
            <button
              onClick={() => { setError(null); setShowCancel(true); }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black text-orange-700 transition-colors hover:bg-orange-100"
            >
              Cancelar assinatura
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: alterar plano ─────────────────────────────────────────── */}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,17,32,0.65)", backdropFilter: "blur(5px)" }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div
              className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: getAction(pending) === "upgrade" ? "#f0fdf4" : "#fff7ed" }}
            >
              {getAction(pending) === "upgrade"
                ? <ArrowUp size={22} className="text-[#16a34a]" />
                : <ArrowDown size={22} className="text-orange-500" />
              }
            </div>

            <h2 className="mt-3 text-xl font-black text-[#0f172a]">
              {getAction(pending) === "upgrade" ? "Upgrade" : "Downgrade"} para {pending.name}?
            </h2>

            <p className="mt-2 text-sm text-[#64748b]">
              {getAction(pending) === "upgrade"
                ? `Seu plano será alterado para ${pending.name} (${pending.price}${pending.period}). Você terá acesso imediato a todos os recursos.`
                : `Seu plano será alterado para ${pending.name}. Recursos que excedam os novos limites serão desativados automaticamente.`
              }
            </p>

            {/* Resumo dos limites */}
            <div
              className="mt-3 rounded-2xl p-4"
              style={{
                background: getAction(pending) === "upgrade" ? "#f0fdf4" : "#fff7ed",
                border: getAction(pending) === "upgrade" ? "1px solid #bbf7d0" : "1px solid #fed7aa",
              }}
            >
              <p
                className="mb-2 text-[10px] font-black uppercase tracking-widest"
                style={{ color: getAction(pending) === "upgrade" ? "#16a34a" : "#ea580c" }}
              >
                Limites do plano {pending.name}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Produtos", val: pending.limits.products },
                  { label: "Destaques", val: pending.limits.featured },
                  { label: "Lojas", val: pending.limits.stores },
                  { label: "Suporte", val: pending.limits.support },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center">
                    <p
                      className="text-base font-black"
                      style={{ color: getAction(pending) === "upgrade" ? "#0f172a" : "#9a3412" }}
                    >
                      {val}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: getAction(pending) === "upgrade" ? "#64748b" : "#c2410c" }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                <AlertTriangle size={13} className="shrink-0 text-red-500" />
                <p className="text-xs font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setPending(null); setError(null); }}
                disabled={loading}
                className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] transition-colors hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleChangePlan(pending)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition-colors disabled:opacity-60"
                style={{
                  background: getAction(pending) === "upgrade"
                    ? "linear-gradient(135deg, #16a34a, #15803d)"
                    : "#f59e0b",
                }}
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Alterando…</>
                  : getAction(pending) === "upgrade"
                  ? "Confirmar upgrade"
                  : "Confirmar downgrade"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: cancelar assinatura ───────────────────────────────────── */}
      {showCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,17,32,0.65)", backdropFilter: "blur(5px)" }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
              <AlertTriangle size={22} className="text-orange-600" />
            </div>

            <h2 className="mt-3 text-xl font-black text-[#0f172a]">Cancelar assinatura?</h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Seu plano voltará para <strong>Free</strong> imediatamente e os seguintes limites
              serão aplicados:
            </p>

            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <ul className="space-y-1.5 text-xs font-semibold text-orange-700">
                <li>• Máximo de 50 produtos ativos (excedentes desativados)</li>
                <li>• Máximo de 3 destaques no Shopping (excedentes removidos)</li>
                <li>• Máximo de 3 categorias de loja</li>
                <li>• Apenas 1 loja por CPF/CNPJ</li>
                <li>• Suporte apenas via comunidade</li>
              </ul>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                <AlertTriangle size={13} className="shrink-0 text-red-500" />
                <p className="text-xs font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setShowCancel(false); setError(null); }}
                disabled={loading}
                className="flex-1 rounded-2xl border border-[#e2e8f0] bg-white py-3 text-sm font-black text-[#64748b] transition-colors hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Manter plano
              </button>
              <button
                onClick={() => handleChangePlan(freePlan)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-sm font-black text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Cancelando…</>
                  : "Confirmar cancelamento"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
