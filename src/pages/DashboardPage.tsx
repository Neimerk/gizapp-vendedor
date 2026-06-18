import {
  Package,
  ReceiptText,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";

import {
  getOrders,
  getStoreProducts,
  type Order,
  type StoreProduct,
} from "../services/gizApi";
import { getAuth } from "../services/auth";

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: "Pendente",         color: "bg-yellow-100 text-yellow-700" },
  1: { label: "Aceito",           color: "bg-blue-100 text-blue-700" },
  2: { label: "Preparando",       color: "bg-purple-100 text-purple-700" },
  3: { label: "Saiu p/ entrega",  color: "bg-orange-100 text-orange-700" },
  4: { label: "Entregue",         color: "bg-green-100 text-green-700" },
  5: { label: "Cancelado",        color: "bg-red-100 text-red-700" },
};

function formatMoney(value: number) {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

function isToday(date: string) {
  const n = new Date();
  const t = new Date(date);
  return n.getDate() === t.getDate() && n.getMonth() === t.getMonth() && n.getFullYear() === t.getFullYear();
}

export default function DashboardPage() {
  const auth = getAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const canSell = auth?.role === "Seller" || auth?.role === "Admin" || (auth?.role === "Courier" && !!auth?.storeId);
  if (!canSell) {
    return <Navigate to="/entregas" replace />;
  }

  useEffect(() => {
    async function load() {
      try {
        const [o, p] = await Promise.all([getOrders(), getStoreProducts()]);
        setOrders(o);
        setProducts(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const revenueToday = todayOrders.filter((o) => o.status !== 5).reduce((s, o) => s + o.total, 0);
    const pending = orders.filter((o) => [0, 1, 2, 3].includes(o.status)).length;
    const active = products.filter((p) => p.available).length;
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
    return { revenueToday, pending, active, lowStock };
  }, [orders, products]);

  const recentOrders = orders.slice(0, 8);

  const statusCounts = useMemo(() => ({
    pending: orders.filter((o) => o.status === 0).length,
    active:  orders.filter((o) => [1, 2, 3].includes(o.status)).length,
    done:    orders.filter((o) => o.status === 4).length,
    cancelled: orders.filter((o) => o.status === 5).length,
  }), [orders]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white shadow-sm" />)}
        </div>
        <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Central Operacional</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Dashboard</h1>
      </div>

      {/* Stats grid — 2 cols base, 4 em xl */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={<TrendingUp size={18} className="text-green-600" />}
          bg="bg-green-50"
          label="Faturamento hoje"
          value={formatMoney(stats.revenueToday)}
          small
        />
        <StatCard
          icon={<ReceiptText size={18} className="text-[#16a34a]" />}
          bg="bg-purple-50"
          label="Em andamento"
          value={String(stats.pending)}
        />
        <StatCard
          icon={<Package size={18} className="text-blue-600" />}
          bg="bg-blue-50"
          label="Produtos ativos"
          value={String(stats.active)}
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-orange-500" />}
          bg="bg-orange-50"
          label="Estoque baixo"
          value={String(stats.lowStock)}
          alert={stats.lowStock > 0}
        />
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <Clock size={14} />,        label: "Pendentes",  value: statusCounts.pending,   color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
          { icon: <Truck size={14} />,         label: "Em preparo", value: statusCounts.active,    color: "text-blue-600 bg-blue-50 border-blue-200" },
          { icon: <CheckCircle size={14} />,   label: "Entregues",  value: statusCounts.done,      color: "text-green-600 bg-green-50 border-green-200" },
          { icon: <XCircle size={14} />,       label: "Cancelados", value: statusCounts.cancelled, color: "text-red-500 bg-red-50 border-red-200" },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${s.color}`}>
            {s.icon}
            <div>
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#0f172a]">Pedidos recentes</h2>
            <p className="text-xs text-[#94a3b8]">Últimos {recentOrders.length} pedidos do negócio</p>
          </div>
          <Link
            to="/pedidos"
            className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] px-4 py-2 text-xs font-black text-[#64748b] hover:border-[#16a34a]/30 hover:text-[#16a34a]"
          >
            Ver todos <ArrowRight size={13} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] py-12 text-center">
            <ReceiptText size={28} className="mx-auto mb-3 text-[#cbd5e1]" />
            <p className="font-black text-[#64748b]">Nenhum pedido recebido ainda</p>
            <p className="mt-1 text-xs text-[#94a3b8]">Novos pedidos aparecem aqui em tempo real via BrasUX</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e8eaf0]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e8eaf0] bg-[#f8fafc]">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Cliente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Itens</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Total</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {recentOrders.map((order) => {
                  const st = statusMap[order.status];
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-[#f8fafc]">
                      <td className="px-4 py-3">
                        <p className="font-black text-[#0f172a]">{order.customerName}</p>
                        <p className="text-[11px] text-[#94a3b8]">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-[#64748b]">
                        {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                      </td>
                      <td className="px-4 py-3 font-black text-[#0f172a]">
                        {formatMoney(order.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#94a3b8]">
                        {new Date(order.createdAt).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon, bg, label, value, small, alert,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
  small?: boolean;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-3xl bg-white p-5 shadow-sm ${alert ? "ring-1 ring-orange-200" : ""}`}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${bg}`}>
        {icon}
      </div>
      <p className="text-xs font-bold text-[#94a3b8]">{label}</p>
      <p className={`mt-1 font-black text-[#0f172a] ${small ? "text-xl" : "text-3xl"}`}>{value}</p>
    </div>
  );
}
