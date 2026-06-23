import {
  TrendingUp, ReceiptText, Package, AlertTriangle,
  ArrowRight, Clock, CheckCircle, XCircle, Truck,
  Store as StoreIcon, ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  getStoreById, getStoreProducts,
  type Store, type StoreProduct,
} from "../services/gizApi";
import { getAuth } from "../services/auth";
import { useOrdersStore } from "../stores/ordersStore";

const STATUS_DOT: Record<number, string> = {
  0: "#f59e0b", 1: "#8b5cf6", 2: "#3b82f6", 3: "#f97316", 4: "#16a34a", 5: "#ef4444",
};
const STATUS_LABEL: Record<number, string> = {
  0: "Pendente", 1: "Aceito", 2: "Preparando", 3: "Saiu p/ entrega", 4: "Entregue", 5: "Cancelado",
};

function fmtBRL(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function isToday(d: string) {
  const n = new Date(), t = new Date(d);
  return n.getDate() === t.getDate() && n.getMonth() === t.getMonth() && n.getFullYear() === t.getFullYear();
}

export default function DashboardPage() {
  const auth = getAuth();
  const canSell = auth?.role === "Seller" || auth?.role === "Admin" || (auth?.role === "Courier" && !!auth?.storeId);

  const { orders, loading: ordersLoading } = useOrdersStore();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    if (!canSell) return;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          getStoreProducts(),
          auth?.storeId ? getStoreById(auth.storeId) : Promise.resolve(null),
        ]);
        setProducts(p); setStore(s);
      } catch (e) { console.error(e); }
      finally { setLocalLoading(false); }
    })();
  }, [canSell]);

  const loading = ordersLoading || localLoading;

  if (!canSell) return <Navigate to="/entregas" replace />;

  const stats = useMemo(() => {
    const today = orders.filter(o => isToday(o.createdAt));
    return {
      revenueToday: today.filter(o => o.status !== 5).reduce((s, o) => s + o.total, 0),
      pending: orders.filter(o => [0,1,2,3].includes(o.status)).length,
      active: products.filter(p => p.available).length,
      lowStock: products.filter(p => p.stock > 0 && p.stock <= 5).length,
    };
  }, [orders, products]);

  const counts = useMemo(() => ({
    pending: orders.filter(o => o.status === 0).length,
    active:  orders.filter(o => [1,2,3].includes(o.status)).length,
    done:    orders.filter(o => o.status === 4).length,
    cancelled: orders.filter(o => o.status === 5).length,
  }), [orders]);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#f1f5f9]" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-[#f1f5f9]" />
    </div>
  );

  const STAT_CARDS = [
    { label: "Faturamento hoje", value: fmtBRL(stats.revenueToday), icon: TrendingUp,    color: "#16a34a", accent: "#16a34a" },
    { label: "Em andamento",     value: String(stats.pending),       icon: ReceiptText,   color: "#8b5cf6", accent: "#8b5cf6" },
    { label: "Produtos ativos",  value: String(stats.active),        icon: Package,       color: "#3b82f6", accent: "#3b82f6" },
    { label: "Estoque baixo",    value: String(stats.lowStock),      icon: AlertTriangle, color: "#f59e0b", accent: "#f59e0b" },
  ];

  const PILL_STATS = [
    { label: "Pendentes",  count: counts.pending,   color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: Clock },
    { label: "Em preparo", count: counts.active,    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", icon: Truck },
    { label: "Entregues",  count: counts.done,      color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: CheckCircle },
    { label: "Cancelados", count: counts.cancelled, color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Central Operacional</p>
          <h1 className="mt-1 text-2xl font-black text-[#0f172a]">
            Olá, {auth?.name?.split(" ")[0] ?? "lojista"} 👋
          </h1>
          <p className="mt-0.5 text-sm text-[#94a3b8]">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {store && (
          <Link
            to="/loja"
            className="flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all hover:shadow-sm"
            style={store.isOpen
              ? { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }
              : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" }
            }
          >
            <StoreIcon size={14} />
            {store.isOpen ? "Loja aberta" : "Loja fechada"}
            <span className="h-2 w-2 rounded-full" style={{ background: store.isOpen ? "#16a34a" : "#cbd5e1" }} />
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STAT_CARDS.map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="overflow-hidden rounded-2xl bg-white"
              style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)" }}
            >
              <div className="h-1 w-full" style={{ background: s.accent }} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#94a3b8]">{s.label}</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${s.color}14` }}>
                    <Icon size={15} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-black text-[#0f172a]">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PILL_STATS.map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 rounded-2xl py-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <Icon size={16} style={{ color: s.color }} />
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent orders */}
      <div
        className="overflow-hidden rounded-2xl bg-white"
        style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-6 py-4">
          <div>
            <h2 className="font-black text-[#0f172a]">Pedidos recentes</h2>
            <p className="text-xs text-[#94a3b8]">Últimos {Math.min(orders.length, 8)} pedidos</p>
          </div>
          <Link to="/pedidos" className="flex items-center gap-1 text-xs font-black text-[#16a34a] hover:text-[#15803d]">
            Ver todos <ArrowRight size={13} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8fafc]">
              <ReceiptText size={24} className="text-[#cbd5e1]" />
            </div>
            <div>
              <p className="font-black text-[#94a3b8]">Nenhum pedido recebido ainda</p>
              <p className="mt-1 text-xs text-[#cbd5e1]">Novos pedidos aparecem aqui em tempo real</p>
            </div>
          </div>
        ) : (
          orders.slice(0, 8).map((order, idx) => (
            <div
              key={order.id}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-[#f8fafc] transition-colors"
              style={{ borderBottom: idx < Math.min(orders.length, 8) - 1 ? "1px solid #f8fafc" : "none" }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f8fafc]">
                <Package size={14} className="text-[#94a3b8]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-black text-[#0f172a]">{order.customerName}</p>
                <p className="text-[11px] text-[#94a3b8]">
                  {new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                  style={{ background: `${STATUS_DOT[order.status]}14`, color: STATUS_DOT[order.status], border: `1px solid ${STATUS_DOT[order.status]}30` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[order.status] }} />
                  {STATUS_LABEL[order.status]}
                </span>
                <span className="text-sm font-black text-[#0f172a]">{fmtBRL(order.total)}</span>
                <ChevronRight size={14} className="text-[#cbd5e1]" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
