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

const STATUS_CLS_BAR: Record<number, string> = {
  0: "#f59e0b", 1: "#8b5cf6", 2: "#3b82f6", 3: "#f97316", 4: "#16a34a", 5: "#ef4444",
};
const STATUS_CLS_BG: Record<number, string> = {
  0: "rgba(245,158,11,0.12)", 1: "rgba(139,92,246,0.12)", 2: "rgba(59,130,246,0.12)",
  3: "rgba(249,115,22,0.12)", 4: "rgba(22,163,74,0.12)",  5: "rgba(239,68,68,0.12)",
};
const STATUS_CLS_COLOR: Record<number, string> = {
  0: "#fbbf24", 1: "#a78bfa", 2: "#60a5fa", 3: "#fb923c", 4: "#4ade80", 5: "#f87171",
};
const STATUS_CLS_BORDER: Record<number, string> = {
  0: "rgba(245,158,11,0.25)", 1: "rgba(139,92,246,0.25)", 2: "rgba(59,130,246,0.25)",
  3: "rgba(249,115,22,0.25)", 4: "rgba(22,163,74,0.25)",  5: "rgba(239,68,68,0.25)",
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
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">
            Operação Comercial
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">Pedidos</h1>
          <p className="mt-0.5 text-sm text-white/30">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} no total
          </p>
        </div>
        <button
          onClick={() => loadOrders(false)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white/60 transition-colors hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all"
            style={
              filter === f.value
                ? {
                    background: "linear-gradient(135deg, rgba(22,163,74,0.2), rgba(22,163,74,0.08))",
                    border: "1px solid rgba(22,163,74,0.3)",
                    color: "#4ade80",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "#64748b",
                  }
            }
          >
            {f.label}
            <span
              className="rounded-lg px-1.5 py-0.5 text-[10px] font-black"
              style={
                filter === f.value
                  ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.06)", color: "#475569" }
              }
            >
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl py-20 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ReceiptText size={28} className="text-white/20" />
          </div>
          <div>
            <p className="font-black text-white/40">Nenhum pedido encontrado</p>
            <p className="mt-1 text-sm text-white/20">
              Tente outro filtro ou aguarde novos pedidos.
            </p>
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
                  className="overflow-hidden rounded-2xl transition-all hover:-translate-y-px"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {/* Accent bar */}
                  <div
                    className="h-0.5 w-full"
                    style={{ background: STATUS_CLS_BAR[order.status] ?? "#334155" }}
                  />

                  {/* Header */}
                  <div
                    className="flex items-center justify-between gap-3 px-5 py-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div>
                      <h2 className="font-black text-white">{order.customerName}</h2>
                      <p className="text-xs text-white/30">
                        {new Date(order.createdAt).toLocaleString("pt-BR")} ·{" "}
                        {order.paymentMethod}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-black"
                      style={{
                        background: STATUS_CLS_BG[order.status],
                        color: STATUS_CLS_COLOR[order.status],
                        border: `1px solid ${STATUS_CLS_BORDER[order.status]}`,
                      }}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>

                  <div className="px-5 py-4">
                    {/* Address */}
                    <p className="mb-4 text-sm text-white/40">
                      📍 {order.deliveryAddress}, {order.deliveryNumber}
                      {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
                      {order.deliveryNeighborhood ? ` · ${order.deliveryNeighborhood}` : ""}
                    </p>

                    {/* Items */}
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <p className="text-sm font-semibold text-white/80">
                            {item.quantity}× {item.productName}
                          </p>
                          <p className="text-sm font-black text-[#4ade80]">
                            {formatMoney(item.totalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals + Actions */}
                    <div
                      className="mt-4 flex items-center justify-between gap-4"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        paddingTop: "1rem",
                      }}
                    >
                      <div className="space-y-0.5 text-xs text-white/30">
                        <p>
                          Subtotal:{" "}
                          <span className="font-semibold text-white/60">
                            {formatMoney(order.subtotal)}
                          </span>
                        </p>
                        <p>
                          Entrega:{" "}
                          <span className="font-semibold text-white/60">
                            {formatMoney(order.deliveryFee)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="rounded-xl px-4 py-2 text-right"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                            Total
                          </p>
                          <p className="text-lg font-black text-white">
                            {formatMoney(order.total)}
                          </p>
                        </div>
                        {!isFinished && (
                          <>
                            <button
                              onClick={() => handleStatus(order.id, 5)}
                              disabled={updatingId === order.id}
                              className="rounded-xl px-3 py-2 text-sm font-black text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                              style={{ border: "1px solid rgba(239,68,68,0.2)" }}
                            >
                              Cancelar
                            </button>
                            {nextAction && (
                              <button
                                onClick={() => handleStatus(order.id, nextAction.value)}
                                disabled={updatingId === order.id}
                                className="rounded-xl px-4 py-2 text-sm font-black text-white transition-all active:scale-[0.97] disabled:opacity-40"
                                style={{
                                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                                  boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
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
