import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ReceiptText } from "lucide-react";

import OrderToast from "../components/ui/OrderToast";
import Pagination from "../components/ui/Pagination";
import { usePagination } from "../hooks/usePagination";
import { getOrders, updateOrderStatus, type Order } from "../services/gizApi";
import { playOrderSound } from "../services/audio";
import { ordersConnection, startOrdersConnection } from "../services/signalr";

const STATUS_LABEL: Record<number, string> = {
  0: "Pendente",
  1: "Aceito",
  2: "Preparando",
  3: "Saiu para entrega",
  4: "Entregue",
  5: "Cancelado",
};

const ORDER_ACCENT: Record<number, string> = {
  0: "#f59e0b", 1: "#8b5cf6", 2: "#3b82f6", 3: "#f97316", 4: "#16a34a", 5: "#ef4444",
};
const ORDER_BADGE_BG: Record<number, string> = {
  0: "#fffbeb", 1: "#f5f3ff", 2: "#eff6ff", 3: "#fff7ed", 4: "#f0fdf4", 5: "#fef2f2",
};
const ORDER_BADGE_COLOR: Record<number, string> = {
  0: "#b45309", 1: "#7c3aed", 2: "#1d4ed8", 3: "#c2410c", 4: "#15803d", 5: "#dc2626",
};
const ORDER_BADGE_BORDER: Record<number, string> = {
  0: "#fde68a", 1: "#ddd6fe", 2: "#bfdbfe", 3: "#fed7aa", 4: "#bbf7d0", 5: "#fecaca",
};

const FILTERS = [
  { label: "Todos",        value: "all"       },
  { label: "Pendentes",    value: "pending"   },
  { label: "Em andamento", value: "active"    },
  { label: "Entregues",    value: "done"      },
  { label: "Cancelados",   value: "cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["value"];

function formatMoney(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function getNextAction(status: number) {
  if (status === 0) return { label: "Aceitar",           value: 1 };
  if (status === 1) return { label: "Preparar",          value: 2 };
  if (status === 2) return { label: "Saiu para entrega", value: 3 };
  if (status === 3) return { label: "Entregar",          value: 4 };
  return null;
}

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  async function loadOrders(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
      else setRefreshing(false);
    }
  }

  async function handleStatus(orderId: string, status: number) {
    const scrollY = window.scrollY;
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, status);
      setOrders((cur) => cur.map((o) => (o.id === orderId ? { ...o, status } : o)));
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
    } catch (error) {
      console.error(error);
      setToastMessage(error instanceof Error ? error.message : "Erro ao atualizar pedido.");
      setToastVisible(true);
    } finally {
      setUpdatingId("");
    }
  }

  useEffect(() => {
    loadOrders(true);

    async function setupSignalR() {
      try {
        await startOrdersConnection();
        ordersConnection.off("OrderCreated");
        ordersConnection.off("OrderStatusUpdated");

        ordersConnection.on("OrderCreated", (newOrder: Order) => {
          setToastMessage("Novo pedido recebido no BrasUX Loja!");
          setToastVisible(true);
          playOrderSound();
          setOrders((cur) =>
            cur.some((o) => o.id === newOrder.id) ? cur : [newOrder, ...cur]
          );
        });

        ordersConnection.on("OrderStatusUpdated", (updated: Order) => {
          setOrders((cur) => cur.map((o) => (o.id === updated.id ? updated : o)));
        });
      } catch (error) {
        console.error("SignalR:", error);
      }
    }
    setupSignalR();

    return () => {
      ordersConnection.off("OrderCreated");
      ordersConnection.off("OrderStatusUpdated");
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all")       return orders;
    if (filter === "pending")   return orders.filter((o) => o.status === 0);
    if (filter === "active")    return orders.filter((o) => [1, 2, 3].includes(o.status));
    if (filter === "done")      return orders.filter((o) => o.status === 4);
    if (filter === "cancelled") return orders.filter((o) => o.status === 5);
    return orders;
  }, [orders, filter]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  const counts = useMemo(
    () => ({
      all:       orders.length,
      pending:   orders.filter((o) => o.status === 0).length,
      active:    orders.filter((o) => [1, 2, 3].includes(o.status)).length,
      done:      orders.filter((o) => o.status === 4).length,
      cancelled: orders.filter((o) => o.status === 5).length,
    }),
    [orders]
  );

  return (
    <div>
      <OrderToast
        visible={toastVisible}
        title="Novo pedido recebido"
        message={toastMessage}
        onClose={() => setToastVisible(false)}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Operação Comercial</p>
          <h1 className="mt-1 text-2xl font-black text-[#0f172a]">Pedidos</h1>
          <p className="mt-0.5 text-sm text-[#94a3b8]">{orders.length} pedido{orders.length !== 1 ? "s" : ""} no total</p>
        </div>
        <button
          onClick={() => loadOrders(false)}
          className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-bold text-[#64748b] shadow-sm hover:bg-[#f8fafc] hover:text-[#0f172a]"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              filter === f.value
                ? "bg-[#16a34a] text-white shadow-sm"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]"
            }`}
          >
            {f.label}
            <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-black ${filter === f.value ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#f1f5f9]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#e2e8f0] bg-white py-20 text-center" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f8fafc]">
            <ReceiptText size={28} className="text-[#cbd5e1]" />
          </div>
          <div>
            <p className="font-black text-[#94a3b8]">Nenhum pedido encontrado</p>
            <p className="mt-1 text-sm text-[#cbd5e1]">Tente outro filtro ou aguarde novos pedidos.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pageItems.map((order) => {
              const nextAction = getNextAction(order.status);
              const isFinished = order.status === 4 || order.status === 5;

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-2xl bg-white transition-shadow hover:shadow-md"
                  style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                >
                  {/* Accent bar */}
                  <div className="h-1 w-full" style={{ background: ORDER_ACCENT[order.status] ?? "#e2e8f0" }} />

                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-[#f8fafc] px-5 py-4">
                    <div>
                      <h2 className="font-black text-[#0f172a]">{order.customerName}</h2>
                      <p className="text-xs text-[#94a3b8]">
                        {new Date(order.createdAt).toLocaleString("pt-BR")} · {order.paymentMethod}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-black"
                      style={{
                        background: ORDER_BADGE_BG[order.status],
                        color: ORDER_BADGE_COLOR[order.status],
                        border: `1px solid ${ORDER_BADGE_BORDER[order.status]}`,
                      }}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>

                  <div className="px-5 py-4">
                    {/* Address */}
                    <p className="mb-4 text-sm text-[#64748b]">
                      📍 {order.deliveryAddress}, {order.deliveryNumber}
                      {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
                      {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                    </p>

                    {/* Items */}
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-4 py-2.5"
                        >
                          <p className="text-sm font-semibold text-[#0f172a]">
                            {item.quantity}× {item.productName}
                          </p>
                          <p className="text-sm font-black text-[#16a34a]">
                            {formatMoney(item.totalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals + Actions */}
                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#f8fafc] pt-4">
                      <div className="space-y-0.5 text-xs text-[#94a3b8]">
                        <p>Subtotal: <span className="font-semibold text-[#64748b]">{formatMoney(order.subtotal)}</span></p>
                        <p>Entrega: <span className="font-semibold text-[#64748b]">{formatMoney(order.deliveryFee)}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-[#0f172a] px-4 py-2 text-right">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Total</p>
                          <p className="text-lg font-black text-white">{formatMoney(order.total)}</p>
                        </div>
                        {!isFinished && (
                          <>
                            <button
                              onClick={() => handleStatus(order.id, 5)}
                              disabled={updatingId === order.id}
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            {nextAction && (
                              <button
                                onClick={() => handleStatus(order.id, nextAction.value)}
                                disabled={updatingId === order.id}
                                className="rounded-xl px-4 py-2 text-sm font-black text-white transition-all active:scale-[0.97] disabled:opacity-50"
                                style={{
                                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                                  boxShadow: "0 4px 12px rgba(22,163,74,0.35)",
                                }}
                              >
                                {updatingId === order.id ? "…" : nextAction.label}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
