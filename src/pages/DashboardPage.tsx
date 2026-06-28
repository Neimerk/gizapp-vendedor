import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigate, Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, ReceiptText, Package, AlertTriangle,
  Clock, CheckCircle, XCircle, Truck, Store as StoreIcon,
  ChevronRight, BarChart2, ArrowRight, Star, Activity,
  PackageX, ImageOff, Lightbulb, ShoppingBag, Zap,
} from "lucide-react";
import {
  getStoreById, getStoreProducts, toggleStoreOpen,
  type Store, type StoreProduct,
} from "../services/gizApi";
import { getAuth } from "../services/auth";
import { useOrdersStore } from "../stores/ordersStore";
import { Sparkline } from "../components/dashboard/Sparkline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function isWithinDays(d: Date, days: number) {
  return Date.now() - d.getTime() < days * 86_400_000;
}
function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ── Animation variants ────────────────────────────────────────────────────────

const FADE_UP = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 30 } },
};
const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

// ── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 850) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * ease));
      if (p < 1) requestAnimationFrame(tick);
      else setV(target);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return v;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, spark, trend, trendLabel, isMonetary = false, sub,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  spark?: number[];
  trend?: number;
  trendLabel?: string;
  isMonetary?: boolean;
  sub?: string;
}) {
  const counted = useCountUp(Math.round(value));
  const formatted = isMonetary ? fmtBRL(counted) : counted.toLocaleString("pt-BR");
  const positiveTrend = (trend ?? 0) >= 0;

  return (
    <motion.div
      variants={FADE_UP}
      whileHover={{ y: -3, boxShadow: "0 16px 48px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="relative overflow-hidden rounded-2xl bg-white"
      style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }}
      />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: `${color}14` }}
          >
            <Icon size={16} style={{ color }} />
          </div>
          {trend !== undefined && (
            <span
              className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black"
              style={{
                background: positiveTrend ? "#f0fdf4" : "#fef2f2",
                color: positiveTrend ? "#15803d" : "#dc2626",
              }}
            >
              {positiveTrend ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">
          {label}
        </p>
        <p className="text-2xl font-black text-[#0f172a]">{formatted}</p>
        {trendLabel && <p className="mt-0.5 text-[10px] text-[#94a3b8]">{trendLabel}</p>}
        {sub && <p className="mt-1 text-xs text-[#64748b]">{sub}</p>}
      </div>
      {spark && spark.length >= 2 && (
        <div className="pointer-events-none absolute bottom-2 right-2 opacity-60">
          <Sparkline data={spark} color={color} w={80} h={32} />
        </div>
      )}
    </motion.div>
  );
}

// ── Status constants ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<number, string> = {
  0: "Pendente", 1: "Aceito", 2: "Preparando", 3: "A caminho", 4: "Entregue", 5: "Cancelado",
};
const STATUS_COLOR: Record<number, string> = {
  0: "#f59e0b", 1: "#8b5cf6", 2: "#3b82f6", 3: "#f97316", 4: "#16a34a", 5: "#ef4444",
};
const STATUS_BG: Record<number, string> = {
  0: "#fffbeb", 1: "#f5f3ff", 2: "#eff6ff", 3: "#fff7ed", 4: "#f0fdf4", 5: "#fef2f2",
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const auth = getAuth();
  const canSell =
    auth?.role === "Seller" ||
    auth?.role === "Admin" ||
    (auth?.role === "Courier" && !!auth?.storeId);

  const { orders, loading: ordersLoading } = useOrdersStore();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!canSell) return;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          getStoreProducts(),
          auth?.storeId ? getStoreById(auth.storeId) : Promise.resolve(null),
        ]);
        setProducts(p);
        setStore(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLocalLoading(false);
      }
    })();
  }, [canSell]);

  const handleToggleOpen = useCallback(async () => {
    if (!store || toggling) return;
    const next = !store.isOpen;
    setToggling(true);
    try {
      await toggleStoreOpen(store.id, next);
      setStore({ ...store, isOpen: next });
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(false);
    }
  }, [store, toggling]);

  if (!canSell) return <Navigate to="/entregas" replace />;

  const loading = ordersLoading || localLoading;

  // ── Computed data ──────────────────────────────────────────────────────────

  const computed = useMemo(() => {
    const now = new Date();

    const rev = (filter: (o: (typeof orders)[0]) => boolean) =>
      orders.filter(o => o.status !== 5 && filter(o)).reduce((s, o) => s + o.total, 0);

    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

    const revenueToday = rev(o => isSameDay(new Date(o.createdAt), now));
    const revenueYesterday = rev(o => isSameDay(new Date(o.createdAt), yesterday));
    const revenueWeek = rev(o => isWithinDays(new Date(o.createdAt), 7));
    const revenueMonth = rev(o => isWithinDays(new Date(o.createdAt), 30));
    const todayTrend = revenueYesterday > 0
      ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
      : 0;

    const revByDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      return rev(o => isSameDay(new Date(o.createdAt), d));
    });

    const pending = orders.filter(o => o.status === 0).length;
    const active = orders.filter(o => [1, 2, 3].includes(o.status)).length;
    const done = orders.filter(o => o.status === 4).length;
    const cancelled = orders.filter(o => o.status === 5).length;
    const cancelledToday = orders.filter(
      o => o.status === 5 && isSameDay(new Date(o.createdAt), now)
    ).length;

    const lastOrder = orders[0] ?? null;

    const activeP = products.filter(p => p.available).length;
    const lowStockList = products.filter(p => p.available && p.stock > 0 && p.stock <= 5);
    const outOfStockList = products.filter(p => p.available && p.stock === 0);
    const noImageList = products.filter(p => p.available && !p.imageUrl);
    const unavailableP = products.filter(p => !p.available).length;

    // Peak hour
    const hourMap: Record<number, number> = {};
    orders.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const peakHour = Object.entries(hourMap).sort(([, a], [, b]) => b - a)[0]?.[0];

    // Insights
    const insights: { emoji: string; text: string; color: string; bg: string }[] = [];
    if (outOfStockList.length > 0) insights.push({
      emoji: "📦", color: "#ef4444", bg: "#fef2f2",
      text: `${outOfStockList.length} produto${outOfStockList.length > 1 ? "s" : ""} esgotado${outOfStockList.length > 1 ? "s" : ""} e visível${outOfStockList.length > 1 ? "is" : ""} no shopping — risco de perder pedidos.`,
    });
    if (lowStockList.length > 0) insights.push({
      emoji: "⚠️", color: "#f59e0b", bg: "#fffbeb",
      text: `Estoque baixo em: ${lowStockList.slice(0, 2).map(p => p.name).join(", ")}${lowStockList.length > 2 ? ` +${lowStockList.length - 2}` : ""}.`,
    });
    if (noImageList.length > 0) insights.push({
      emoji: "📸", color: "#8b5cf6", bg: "#f5f3ff",
      text: `${noImageList.length} produto${noImageList.length > 1 ? "s" : ""} sem foto — produtos com imagem convertem até 3× mais.`,
    });
    if (todayTrend > 15) insights.push({
      emoji: "🚀", color: "#16a34a", bg: "#f0fdf4",
      text: `Faturamento de hoje ${todayTrend.toFixed(0)}% acima de ontem. Ótimo desempenho!`,
    });
    if (peakHour) insights.push({
      emoji: "⏰", color: "#3b82f6", bg: "#eff6ff",
      text: `Horário de pico histórico: ${peakHour}h. Garanta estoque disponível nesse período.`,
    });
    if (cancelledToday > 2) insights.push({
      emoji: "💡", color: "#f97316", bg: "#fff7ed",
      text: `${cancelledToday} pedidos cancelados hoje. Verifique demora no preparo ou entrega.`,
    });
    if (insights.length === 0) insights.push({
      emoji: "🎯", color: "#16a34a", bg: "#f0fdf4",
      text: "Divulgue sua loja no BrasUX Shopping para atrair mais clientes da sua região.",
    });

    // Alerts
    const alerts: { type: "error" | "warning" | "info"; text: string; to: string; action: string }[] = [];
    if (outOfStockList.length > 0) alerts.push({ type: "error", text: `${outOfStockList.length} produto${outOfStockList.length > 1 ? "s" : ""} esgotado${outOfStockList.length > 1 ? "s" : ""} e visível${outOfStockList.length > 1 ? "is" : ""} no shopping`, to: "/produtos", action: "Corrigir agora" });
    if (pending > 0) alerts.push({ type: "warning", text: `${pending} pedido${pending > 1 ? "s" : ""} aguardando sua confirmação`, to: "/pedidos", action: "Confirmar" });
    if (lowStockList.length > 0) alerts.push({ type: "warning", text: `${lowStockList.length} produto${lowStockList.length > 1 ? "s" : ""} com estoque crítico (≤ 5 unid.)`, to: "/produtos", action: "Ver produtos" });
    if (noImageList.length > 0) alerts.push({ type: "info", text: `${noImageList.length} produto${noImageList.length > 1 ? "s" : ""} sem imagem`, to: "/produtos", action: "Adicionar fotos" });

    return {
      revenueToday, revenueWeek, revenueMonth, todayTrend, revByDay,
      pending, active, done, cancelled, lastOrder,
      activeP, lowStock: lowStockList.length, outOfStock: outOfStockList.length,
      noImage: noImageList.length, unavailableP,
      insights, alerts,
    };
  }, [orders, products]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      const dayOrders = orders.filter(o => o.status !== 5 && isSameDay(new Date(o.createdAt), d));
      return {
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        day: d.getDate(),
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        count: dayOrders.length,
        isToday: isSameDay(d, now),
      };
    });
  }, [orders]);
  const maxChart = Math.max(...chartDays.map(d => d.revenue), 1);

  // ── Skeleton ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-3xl bg-[#f1f5f9]" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-[#f1f5f9]" />)}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#f1f5f9]" />)}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#f1f5f9]" />)}
        </div>
        <div className="h-52 rounded-2xl bg-[#f1f5f9]" />
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3 h-80 rounded-2xl bg-[#f1f5f9]" />
          <div className="xl:col-span-2 h-80 rounded-2xl bg-[#f1f5f9]" />
        </div>
      </div>
    );
  }

  const ALERT_STYLES = {
    error: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", dot: "#ef4444" },
    warning: { bg: "#fffbeb", border: "#fde68a", color: "#b45309", dot: "#f59e0b" },
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", dot: "#3b82f6" },
  } as const;

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="show" className="space-y-6 pb-8">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div variants={FADE_UP}>
        <div
          className="relative overflow-hidden rounded-3xl p-6 md:p-8"
          style={{
            background: "linear-gradient(140deg, #0f172a 0%, #064e3b 55%, #16a34a 100%)",
            boxShadow: "0 8px 40px rgba(22,163,74,0.22), 0 2px 8px rgba(0,0,0,0.16)",
          }}
        >
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.025]" />
          <div className="pointer-events-none absolute -bottom-16 right-12 h-48 w-48 rounded-full bg-[#16a34a]/10" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#4ade80]/20 to-transparent" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#4ade80]">
                Central Operacional · BrasUX Loja
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Olá, {auth?.name?.split(" ")[0] ?? "lojista"} 👋
              </h1>
              <p className="mt-1 text-sm text-white/45">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {store && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleToggleOpen}
                  disabled={toggling}
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-black backdrop-blur-sm transition-all disabled:opacity-60"
                  style={
                    store.isOpen
                      ? { background: "rgba(74,222,128,0.14)", border: "1px solid rgba(74,222,128,0.28)", color: "#4ade80" }
                      : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full transition-all"
                    style={{
                      background: store.isOpen ? "#4ade80" : "rgba(255,255,255,0.3)",
                      boxShadow: store.isOpen ? "0 0 8px #4ade80" : "none",
                    }}
                  />
                  <StoreIcon size={13} />
                  {toggling ? "Atualizando…" : store.isOpen ? "Loja aberta" : "Loja fechada"}
                </motion.button>
              )}

              {computed.lastOrder && (
                <div
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3 backdrop-blur-sm"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <Clock size={13} className="shrink-0 text-white/35" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Último pedido</p>
                    <p className="text-xs font-black text-white/75">{timeAgo(computed.lastOrder.createdAt)}</p>
                  </div>
                </div>
              )}

              {store?.rating != null && (
                <div
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3 backdrop-blur-sm"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  <Star size={13} className="shrink-0 text-[#fbbf24]" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Avaliação</p>
                    <p className="text-xs font-black text-white/75">{store.rating.toFixed(1)} estrelas</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Alerts ────────────────────────────────────────────────────────── */}
      {computed.alerts.length > 0 && (
        <motion.div variants={FADE_UP} className="space-y-2">
          {computed.alerts.map((alert, i) => {
            const s = ALERT_STYLES[alert.type];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.dot }} />
                <p className="flex-1 text-sm font-semibold" style={{ color: s.color }}>{alert.text}</p>
                <Link
                  to={alert.to}
                  className="shrink-0 rounded-xl px-3 py-1 text-xs font-black transition-opacity hover:opacity-70"
                  style={{ background: s.dot, color: "#fff" }}
                >
                  {alert.action}
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── KPIs — Financeiro ─────────────────────────────────────────────── */}
      <div>
        <motion.p variants={FADE_UP} className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#94a3b8]">
          Financeiro
        </motion.p>
        <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Faturamento hoje" value={computed.revenueToday} icon={TrendingUp} color="#16a34a" spark={computed.revByDay} trend={computed.todayTrend || undefined} trendLabel="vs. ontem" isMonetary />
          <KpiCard label="Últimos 7 dias" value={computed.revenueWeek} icon={BarChart2} color="#8b5cf6" spark={computed.revByDay} isMonetary />
          <KpiCard label="Últimos 30 dias" value={computed.revenueMonth} icon={Activity} color="#3b82f6" spark={computed.revByDay} isMonetary />
        </motion.div>
      </div>

      {/* ── KPIs — Operacional ────────────────────────────────────────────── */}
      <div>
        <motion.p variants={FADE_UP} className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#94a3b8]">
          Operacional
        </motion.p>
        <motion.div variants={STAGGER} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Pendentes" value={computed.pending} icon={Clock} color="#f59e0b" sub="Aguardando ação" />
          <KpiCard label="Em andamento" value={computed.active} icon={Truck} color="#3b82f6" sub="Aceitos e em preparo" />
          <KpiCard label="Entregues" value={computed.done} icon={CheckCircle} color="#16a34a" sub="Total histórico" />
          <KpiCard label="Cancelados" value={computed.cancelled} icon={XCircle} color="#ef4444" sub="Total histórico" />
        </motion.div>
      </div>

      {/* ── KPIs — Produtos ──────────────────────────────────────────────── */}
      <div>
        <motion.p variants={FADE_UP} className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#94a3b8]">
          Produtos
        </motion.p>
        <motion.div variants={STAGGER} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Ativos" value={computed.activeP} icon={ShoppingBag} color="#16a34a" sub="Disponíveis no shopping" />
          <KpiCard label="Estoque baixo" value={computed.lowStock} icon={AlertTriangle} color="#f59e0b" sub="≤ 5 unidades" />
          <KpiCard label="Esgotados" value={computed.outOfStock} icon={PackageX} color="#ef4444" sub="Sem estoque (ativo)" />
          <KpiCard label="Sem foto" value={computed.noImage} icon={ImageOff} color="#8b5cf6" sub="Perda de conversão" />
        </motion.div>
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────────────────── */}
      <motion.div
        variants={FADE_UP}
        className="overflow-hidden rounded-2xl bg-white"
        style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
              <BarChart2 size={15} className="text-[#16a34a]" />
            </div>
            <div>
              <h2 className="font-black text-[#0f172a]">Faturamento — 7 dias</h2>
              <p className="text-[11px] text-[#94a3b8]">
                Total: {fmtBRL(computed.revenueWeek)} · excluindo cancelados
              </p>
            </div>
          </div>
          <Link to="/pedidos" className="text-xs font-black text-[#16a34a] hover:text-[#15803d]">
            Ver pedidos →
          </Link>
        </div>
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-end gap-3" style={{ height: 128 }}>
            {chartDays.map((d) => {
              const pct = (d.revenue / maxChart) * 100;
              return (
                <div key={d.label + d.day} className="group relative flex flex-1 flex-col items-center gap-1">
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-center shadow-lg group-hover:block" style={{ zIndex: 20, minWidth: 90 }}>
                    <p className="text-xs font-black text-[#0f172a]">{fmtBRL(d.revenue)}</p>
                    <p className="text-[9px] text-[#94a3b8]">{d.count} pedido{d.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex w-full flex-col items-center justify-end" style={{ height: 100 }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, d.revenue > 0 ? 3 : 0)}%` }}
                      transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.05 }}
                      className="w-full rounded-t-lg"
                      style={{
                        background: d.isToday
                          ? "linear-gradient(180deg, #16a34a 0%, #15803d 100%)"
                          : "#e9eef4",
                        minHeight: d.revenue > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                  <p
                    className="text-[10px] font-bold capitalize"
                    style={{ color: d.isToday ? "#16a34a" : "#94a3b8" }}
                  >
                    {d.label}
                  </p>
                  <p className="text-[9px] font-semibold" style={{ color: d.isToday ? "#15803d" : "#cbd5e1" }}>
                    {d.day}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Orders + Insights ─────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-5">

        {/* Orders panel */}
        <motion.div
          variants={FADE_UP}
          className="overflow-hidden rounded-2xl bg-white xl:col-span-3"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f172a]/5">
                <ReceiptText size={15} className="text-[#0f172a]" />
              </div>
              <div>
                <h2 className="font-black text-[#0f172a]">Pedidos recentes</h2>
                <p className="text-[11px] text-[#94a3b8]">Últimos {Math.min(orders.length, 8)} pedidos</p>
              </div>
            </div>
            <Link to="/pedidos" className="flex items-center gap-1 text-xs font-black text-[#16a34a] hover:text-[#15803d]">
              Ver todos <ArrowRight size={13} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}
              >
                <ShoppingBag size={24} className="text-[#cbd5e1]" />
              </div>
              <div>
                <p className="font-black text-[#94a3b8]">Nenhum pedido recebido ainda</p>
                <p className="mt-1 text-xs text-[#cbd5e1]">
                  Divulgue sua loja no BrasUX Shopping e receba seus primeiros clientes.
                </p>
              </div>
              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href="https://brasux.store"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                <Zap size={14} /> Promover minha loja
              </motion.a>
            </div>
          ) : (
            <div>
              {orders.slice(0, 8).map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[#fafbfc]"
                  style={{ borderBottom: idx < Math.min(orders.length, 8) - 1 ? "1px solid #f8fafc" : "none" }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${STATUS_COLOR[order.status]}12` }}>
                    <Package size={14} style={{ color: STATUS_COLOR[order.status] }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#0f172a]">{order.customerName}</p>
                    <p className="text-[11px] text-[#94a3b8]">
                      {new Date(order.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                      {order.items.length > 0 && ` · ${order.items.length} item${order.items.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="rounded-xl px-2.5 py-1 text-[10px] font-black"
                      style={{ background: STATUS_BG[order.status], color: STATUS_COLOR[order.status] }}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                    <span className="font-black text-[#0f172a]" style={{ fontSize: 13 }}>
                      {fmtBRL(order.total)}
                    </span>
                    <ChevronRight size={13} className="text-[#e2e8f0]" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Insights + Status pills */}
        <div className="flex flex-col gap-4 xl:col-span-2">

          {/* Status distribution */}
          <motion.div
            variants={FADE_UP}
            className="grid grid-cols-2 gap-3"
          >
            {[
              { label: "Pendentes", count: computed.pending, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: Clock },
              { label: "Em preparo", count: computed.active, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", icon: Truck },
              { label: "Entregues", count: computed.done, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: CheckCircle },
              { label: "Cancelados", count: computed.cancelled, color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: XCircle },
            ].map(s => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400 }}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 text-center"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <Icon size={16} style={{ color: s.color }} />
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* AI Insights */}
          <motion.div
            variants={FADE_UP}
            className="flex-1 overflow-hidden rounded-2xl bg-white"
            style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <div className="flex items-center gap-2.5 border-b border-[#f1f5f9] px-5 py-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6]/10">
                <Lightbulb size={13} className="text-[#8b5cf6]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0f172a]">BrasUX Insights</h3>
                <p className="text-[10px] text-[#94a3b8]">Baseado nos seus dados</p>
              </div>
            </div>
            <div className="divide-y divide-[#f8fafc]">
              {computed.insights.slice(0, 4).map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  className="flex items-start gap-3 px-5 py-3.5"
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ background: ins.bg }}
                  >
                    {ins.emoji}
                  </span>
                  <p className="text-xs leading-relaxed text-[#475569]">{ins.text}</p>
                </motion.div>
              ))}
            </div>
            {computed.insights.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Lightbulb size={20} className="text-[#cbd5e1]" />
                <p className="text-xs text-[#94a3b8]">Insights disponíveis após os primeiros pedidos.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
