import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, TrendingUp, ShoppingCart, DollarSign,
  Package, CreditCard, Lock, ArrowRight, Calendar,
  Star, Award, RefreshCw,
} from "lucide-react";
import { useOrdersStore } from "../stores/ordersStore";
import { getAuth } from "../services/auth";
import type { Order } from "../services/gizApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

type Period = "7" | "30" | "90" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7":   "7 dias",
  "30":  "30 dias",
  "90":  "90 dias",
  "all": "Todo período",
};

function filterByPeriod(orders: Order[], period: Period): Order[] {
  if (period === "all") return orders;
  const cutoff = daysAgo(Number(period));
  return orders.filter(o => new Date(o.createdAt) >= cutoff);
}

const STATUS_LABEL: Record<number, string> = {
  0: "Pendente", 1: "Aceito", 2: "Preparando",
  3: "Saiu p/ entrega", 4: "Entregue", 5: "Cancelado",
};

// ── Upsell screen for free plan ───────────────────────────────────────────────

function UpsellScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#16a34a]/10 to-[#15803d]/20">
        <Lock size={36} className="text-[#16a34a]" />
      </div>
      <h2 className="text-2xl font-black text-[#0f172a]">Relatórios de Vendas</h2>
      <p className="mt-2 max-w-sm text-sm text-[#64748b]">
        Acesse métricas detalhadas, análise de produtos e evolução de receita.
        Disponível nos planos <strong>Básico</strong>, <strong>Premium</strong> e <strong>White Label</strong>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 w-full max-w-lg text-left">
        {[
          { icon: TrendingUp,   label: "Receita por período",        desc: "7, 30 e 90 dias" },
          { icon: Package,      label: "Produtos mais vendidos",      desc: "Ranking por volume" },
          { icon: CreditCard,   label: "Formas de pagamento",        desc: "Análise por método" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
              <Icon size={15} className="text-[#16a34a]" />
            </div>
            <p className="text-xs font-black text-[#0f172a]">{label}</p>
            <p className="text-[11px] text-[#94a3b8]">{desc}</p>
          </div>
        ))}
      </div>

      <Link
        to="/plano"
        className="mt-8 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25 transition-all hover:shadow-[#16a34a]/40 active:scale-[0.98]"
      >
        Ver planos <ArrowRight size={15} />
      </Link>
    </div>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative w-full">
            <div
              className="w-full rounded-t-lg bg-[#16a34a]/80 transition-all"
              style={{ height: `${(value / max) * 112}px`, minHeight: value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="text-[9px] font-bold text-[#94a3b8] truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = "#16a34a",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
        <Icon size={17} style={{ color }} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{label}</p>
      <p className="mt-0.5 text-2xl font-black text-[#0f172a]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesReportPage() {
  const auth = getAuth();
  const { orders, loading, refresh } = useOrdersStore();
  const [period, setPeriod] = useState<Period>("30");
  const [refreshing, setRefreshing] = useState(false);

  const isPaid = auth?.plan && auth.plan !== "free";
  if (!isPaid) return <UpsellScreen />;

  const filtered = useMemo(() => filterByPeriod(orders, period), [orders, period]);
  const delivered = useMemo(() => filtered.filter(o => o.status === 4), [filtered]);
  const cancelled = useMemo(() => filtered.filter(o => o.status === 5), [filtered]);
  const active     = useMemo(() => filtered.filter(o => o.status > 0 && o.status < 5), [filtered]);

  const revenue    = useMemo(() => delivered.reduce((s, o) => s + Number(o.total), 0), [delivered]);
  const avgTicket  = useMemo(() => delivered.length > 0 ? revenue / delivered.length : 0, [revenue, delivered]);

  // Top produtos por unidades vendidas
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const order of delivered) {
      for (const item of order.items) {
        const cur = map.get(item.productName) ?? { name: item.productName, qty: 0, revenue: 0 };
        map.set(item.productName, {
          name: item.productName,
          qty: cur.qty + item.quantity,
          revenue: cur.revenue + Number(item.totalPrice),
        });
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [delivered]);

  // Métodos de pagamento
  const paymentMethods = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of delivered) {
      map.set(order.paymentMethod, (map.get(order.paymentMethod) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => ({ method, count, pct: Math.round((count / delivered.length) * 100) }));
  }, [delivered]);

  // Receita por dia (últimos N dias)
  const dailyRevenue = useMemo(() => {
    const days = period === "all" ? 30 : Number(period);
    const bins: { label: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = daysAgo(i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const dayRevenue = delivered
        .filter(o => { const t = new Date(o.createdAt); return t >= d && t < next; })
        .reduce((s, o) => s + Number(o.total), 0);
      bins.push({
        label: days <= 30
          ? `${d.getDate()}/${d.getMonth() + 1}`
          : `${d.getDate()}/${d.getMonth() + 1}`,
        value: dayRevenue,
      });
    }
    // Para 90 dias agrupa por semana para não ficar muito apertado
    if (days === 90) {
      const weekly: { label: string; value: number }[] = [];
      for (let i = 0; i < bins.length; i += 7) {
        const chunk = bins.slice(i, i + 7);
        weekly.push({
          label: chunk[0].label,
          value: chunk.reduce((s, b) => s + b.value, 0),
        });
      }
      return weekly;
    }
    // Para 30 dias mostra a cada 2 dias para não ter muita label
    if (days === 30) {
      return bins.filter((_, i) => i % 2 === 0 || i === bins.length - 1);
    }
    return bins;
  }, [delivered, period]);

  // Status distribution
  const statusDist = useMemo(() => {
    const map = new Map<number, number>();
    for (const o of filtered) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Inteligência de Negócio</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Relatórios</h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-bold text-[#64748b] shadow-sm transition-colors hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing || loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              period === key
                ? "bg-[#16a34a] text-white shadow-sm"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            <Calendar size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Receita"
          value={fmtBRL(revenue)}
          sub={`${delivered.length} pedido${delivered.length !== 1 ? "s" : ""} entregue${delivered.length !== 1 ? "s" : ""}`}
          color="#16a34a"
        />
        <StatCard
          icon={ShoppingCart}
          label="Total de pedidos"
          value={String(filtered.length)}
          sub={`${active.length} em andamento`}
          color="#2563eb"
        />
        <StatCard
          icon={TrendingUp}
          label="Ticket médio"
          value={fmtBRL(avgTicket)}
          sub="pedidos entregues"
          color="#7c3aed"
        />
        <StatCard
          icon={BarChart3}
          label="Cancelamentos"
          value={String(cancelled.length)}
          sub={filtered.length > 0 ? `${Math.round((cancelled.length / filtered.length) * 100)}% do total` : "0%"}
          color="#ef4444"
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
            <TrendingUp size={15} className="text-[#16a34a]" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#0f172a]">Evolução da receita</h2>
            <p className="text-[11px] text-[#94a3b8]">Apenas pedidos entregues · {PERIOD_LABELS[period]}</p>
          </div>
        </div>
        {delivered.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-2xl bg-[#f8fafc]">
            <p className="text-xs text-[#94a3b8]">Nenhum pedido entregue no período</p>
          </div>
        ) : (
          <BarChart data={dailyRevenue} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f59e0b]/10">
              <Award size={15} className="text-[#f59e0b]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#0f172a]">Produtos mais vendidos</h2>
              <p className="text-[11px] text-[#94a3b8]">Por unidades · {PERIOD_LABELS[period]}</p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl bg-[#f8fafc]">
              <p className="text-xs text-[#94a3b8]">Sem dados no período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => {
                const maxQty = topProducts[0].qty;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-center text-[10px] font-black text-[#94a3b8]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-[#0f172a]">{p.name}</span>
                        <span className="shrink-0 text-[10px] font-black text-[#64748b]">
                          {p.qty} un.
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-[#f59e0b]"
                          style={{ width: `${(p.qty / maxQty) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-[10px] font-black text-[#16a34a]">
                      {fmtBRL(p.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment methods + status */}
        <div className="flex flex-col gap-4">
          {/* Payment */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563eb]/10">
                <CreditCard size={15} className="text-[#2563eb]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#0f172a]">Formas de pagamento</h2>
                <p className="text-[11px] text-[#94a3b8]">Pedidos entregues</p>
              </div>
            </div>
            {paymentMethods.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Sem dados no período</p>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map(({ method, count, pct }) => (
                  <div key={method} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a] capitalize">{method}</span>
                        <span className="text-[10px] font-black text-[#64748b]">{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order status distribution */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7c3aed]/10">
                <Star size={15} className="text-[#7c3aed]" />
              </div>
              <h2 className="text-sm font-black text-[#0f172a]">Distribuição por status</h2>
            </div>
            {statusDist.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Sem pedidos no período</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {statusDist.map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                    <span className="text-lg font-black text-[#0f172a]">{count}</span>
                    <span className="text-[10px] font-bold text-[#64748b] leading-tight">
                      {STATUS_LABEL[status] ?? `Status ${status}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan badge */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="flex items-center gap-1.5 rounded-full border border-[#16a34a]/20 bg-[#f0fdf4] px-3 py-1">
          <Star size={10} className="text-[#16a34a]" />
          <span className="text-[10px] font-black text-[#16a34a] uppercase tracking-wide">
            {auth?.plan === "whitelabel" ? "White Label" : auth?.plan === "pro" ? "Premium" : "Básico"} · Relatórios ativados
          </span>
        </div>
      </div>
    </div>
  );
}
