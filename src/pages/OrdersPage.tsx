import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

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

const STATUS_CLS: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-700 border-yellow-200",
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-orange-100 text-orange-700 border-orange-200",
  4: "bg-green-100 text-green-700 border-green-200",
  5: "bg-red-100 text-red-700 border-red-200",
};

const FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Pendentes", value: "pending" },
  { label: "Em andamento", value: "active" },
  { label: "Entregues", value: "done" },
  { label: "Cancelados", value: "cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["value"];

function formatMoney(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function getNextAction(status: number) {
  if (status === 0) return { label: "Aceitar", value: 1 };
  if (status === 1) return { label: "Preparar", value: 2 };
  if (status === 2) return { label: "Saiu para entrega", value: 3 };
  if (status === 3) return { label: "Entregar", value: 4 };
  return null;
}

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  async function loadOrders(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function handleStatus(orderId: string, status: number) {
    const scrollY = window.scrollY;
    try {
      setUpdatingId(orderId);
      await updateOrderStatus(orderId, status);
      setOrders((cur) =>
        cur.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
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
          setOrders((cur) =>
            cur.map((o) => (o.id === updated.id ? updated : o))
          );
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
    if (filter === "all") return orders;
    if (filter === "pending") return orders.filter((o) => o.status === 0);
    if (filter === "active") return orders.filter((o) => [1, 2, 3].includes(o.status));
    if (filter === "done") return orders.filter((o) => o.status === 4);
    if (filter === "cancelled") return orders.filter((o) => o.status === 5);
    return orders;
  }, [orders, filter]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => o.status === 0).length,
    active: orders.filter((o) => [1, 2, 3].includes(o.status)).length,
    done: orders.filter((o) => o.status === 4).length,
    cancelled: orders.filter((o) => o.status === 5).length,
  }), [orders]);

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
          <h1 className="text-3xl font-black text-[#0f172a]">Pedidos</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} no total
          </p>
        </div>
        <button
          onClick={() => loadOrders(false)}
          className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-black text-[#64748b] shadow-sm hover:bg-[#f8fafc]"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              filter === f.value
                ? "bg-[#16a34a] text-white shadow-sm shadow-[#16a34a]/30"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                filter === f.value ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#94a3b8]"
              }`}
            >
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-[#e8eaf0] bg-white p-12 text-center font-black text-[#64748b]">
          Nenhum pedido encontrado.
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
                  className="overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm"
                >
                  {/* Order top bar */}
                  <div className="flex items-center justify-between gap-3 border-b border-[#f1f5f9] px-5 py-4">
                    <div>
                      <h2 className="font-black text-[#0f172a]">{order.customerName}</h2>
                      <p className="text-xs text-[#94a3b8]">
                        {new Date(order.createdAt).toLocaleString("pt-BR")} ·{" "}
                        {order.paymentMethod}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
                        STATUS_CLS[order.status] ?? "bg-[#f1f5f9] text-[#64748b]"
                      }`}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>

                  <div className="px-5 py-4">
                    {/* Address */}
                    <p className="mb-3 text-sm text-[#64748b]">
                      {order.deliveryAddress}, {order.deliveryNumber}
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
                          <p className="text-sm font-black text-[#0f172a]">
                            {item.quantity}× {item.productName}
                          </p>
                          <p className="text-sm font-black text-[#16a34a]">
                            {formatMoney(item.totalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#f1f5f9] pt-4">
                      <div className="space-y-0.5 text-xs text-[#94a3b8]">
                        <p>Subtotal: <strong>{formatMoney(order.subtotal)}</strong></p>
                        <p>Entrega: <strong>{formatMoney(order.deliveryFee)}</strong></p>
                      </div>
                      <div className="rounded-2xl bg-[#0f172a] px-4 py-2 text-right">
                        <p className="text-[10px] font-bold text-white/50">Total</p>
                        <p className="text-lg font-black text-white">{formatMoney(order.total)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isFinished && (
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => handleStatus(order.id, 5)}
                          disabled={updatingId === order.id}
                          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                        {nextAction && (
                          <button
                            onClick={() => handleStatus(order.id, nextAction.value)}
                            disabled={updatingId === order.id}
                            className="rounded-xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                          >
                            {updatingId === order.id ? "Atualizando..." : nextAction.label}
                          </button>
                        )}
                      </div>
                    )}
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
