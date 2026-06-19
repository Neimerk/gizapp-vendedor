import {
  TrendingUp, ReceiptText, Package, AlertTriangle,
  ArrowRight, Clock, CheckCircle, XCircle, Truck,
  Store as StoreIcon, ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  getOrders, getStoreById, getStoreProducts,
  type Order, type Store, type StoreProduct,
} from "../services/gizApi";
import { getAuth } from "../services/auth";

const STATUS_MAP: Record<number, { label: string; dot: string }> = {
  0: { label: "Pendente",        dot: "#f59e0b" },
  1: { label: "Aceito",          dot: "#8b5cf6" },
  2: { label: "Preparando",      dot: "#3b82f6" },
  3: { label: "Saiu p/ entrega", dot: "#f97316" },
  4: { label: "Entregue",        dot: "#16a34a" },
  5: { label: "Cancelado",       dot: "#ef4444" },
};

function fmtBRL(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function isToday(d: string) {
  const n = new Date(), t = new Date(d);
  return (
    n.getDate() === t.getDate() &&
    n.getMonth() === t.getMonth() &&
    n.getFullYear() === t.getFullYear()
  );
}

export default function DashboardPage() {
  const auth = getAuth();
  const canSell =
    auth?.role === "Seller" ||
    auth?.role === "Admin" ||
    (auth?.role === "Courier" && !!auth?.storeId);

  if (!canSell) return <Navigate to="/entregas" replace />;

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, p, s] = await Promise.all([
          getOrders(),
          getStoreProducts(),
          auth?.storeId ? getStoreById(auth.storeId) : Promise.resolve(null),
        ]);
        setOrders(o);
        setProducts(p);
        setStore(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const revenueToday = todayOrders
      .filter((o) => o.status !== 5)
      .reduce((s, o) => s + o.total, 0);
    const pending = orders.filter((o) => [0, 1, 2, 3].includes(o.status)).length;
    const active = products.filter((p) => p.available).length;
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
    return { revenueToday, pending, active, lowStock };
  }, [orders, products]);

  const statusCounts = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === 0).length,
      active: orders.filter((o) => [1, 2, 3].includes(o.status)).length,
      done: orders.filter((o) => o.status === 4).length,
      cancelled: orders.filter((o) => o.status === 5).length,
    }),
    [orders]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
            />
          ))}
        </div>
        <div
          className="h-72 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
        />
      </div>
    );
  }

  const STAT_CARDS = [
    {
      label: "Faturamento hoje",
      value: fmtBRL(stats.revenueToday),
      icon: TrendingUp,
      color: "#16a34a",
      glow: "rgba(22,163,74,0.25)",
      bg: "rgba(22,163,74,0.1)",
    },
    {
      label: "Em andamento",
      value: String(stats.pending),
      icon: ReceiptText,
      color: "#8b5cf6",
      glow: "rgba(139,92,246,0.25)",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Produtos ativos",
      value: String(stats.active),
      icon: Package,
      color: "#3b82f6",
      glow: "rgba(59,130,246,0.25)",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      label: "Estoque baixo",
      value: String(stats.lowStock),
      icon: AlertTriangle,
      color: "#f59e0b",
      glow: "rgba(245,158,11,0.25)",
      bg: "rgba(245,158,11,0.1)",
    },
  ];

  const STATUS_PILLS = [
    { label: "Pendentes",  count: statusCounts.pending,   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)",  icon: Clock },
    { label: "Em preparo", count: statusCounts.active,    color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.2)",  icon: Truck },
    { label: "Entregues",  count: statusCounts.done,      color: "#16a34a", bg: "rgba(22,163,74,0.1)",   border: "rgba(22,163,74,0.2)",   icon: CheckCircle },
    { label: "Cancelados", count: statusCounts.cancelled, color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">
            Central Operacional
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">
            Olá, {auth?.name?.split(" ")[0] ?? "lojista"} 👋
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        {store && (
          <Link
            to="/loja"
            className="flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all hover:scale-[1.02]"
            style={
              store.isOpen
                ? {
                    background: "rgba(22,163,74,0.12)",
                    border: "1px solid rgba(22,163,74,0.25)",
                    color: "#4ade80",
                  }
                : {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#64748b",
                  }
            }
          >
            <StoreIcon size={14} />
            {store.isOpen ? "Loja aberta" : "Loja fechada"}
            <span
              className={`h-2 w-2 rounded-full ${store.isOpen ? "bg-[#4ade80]" : "bg-[#475569]"}`}
              style={
                store.isOpen
                  ? { boxShadow: "0 0 6px rgba(74,222,128,0.8)" }
                  : {}
              }
            />
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl"
                style={{ background: s.glow }}
              />
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white/40">{s.label}</p>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ background: s.bg }}
                  >
                    <Icon size={15} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-2xl font-black leading-none text-white">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_PILLS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 rounded-2xl py-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <Icon size={16} style={{ color: s.color }} />
              <p className="text-2xl font-black" style={{ color: s.color }}>
                {s.count}
              </p>
              <p
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: s.color, opacity: 0.7 }}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent orders */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <h2 className="font-black text-white">Pedidos recentes</h2>
            <p className="text-xs text-white/30">
              Últimos {Math.min(orders.length, 8)} pedidos do negócio
            </p>
          </div>
          <Link
            to="/pedidos"
            className="flex items-center gap-1 text-xs font-black text-[#16a34a] transition-colors hover:text-[#4ade80]"
          >
            Ver todos <ArrowRight size={13} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <ReceiptText size={24} className="text-white/20" />
            </div>
            <div>
              <p className="font-black text-white/40">Nenhum pedido recebido ainda</p>
              <p className="mt-1 text-xs text-white/20">
                Novos pedidos aparecem aqui em tempo real via BrasUX
              </p>
            </div>
          </div>
        ) : (
          <div>
            {orders.slice(0, 8).map((order, idx) => {
              const s = STATUS_MAP[order.status];
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderBottom:
                      idx < Math.min(orders.length, 8) - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <Package size={14} className="text-white/40" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">
                      {order.customerName}
                    </p>
                    <p className="text-[11px] text-white/30">
                      {new Date(order.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                      style={{
                        background: `${s?.dot}18`,
                        color: s?.dot,
                        border: `1px solid ${s?.dot}30`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: s?.dot }}
                      />
                      {s?.label}
                    </span>
                    <span className="text-sm font-black text-white">
                      {fmtBRL(order.total)}
                    </span>
                    <ChevronRight size={14} className="text-white/20" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
