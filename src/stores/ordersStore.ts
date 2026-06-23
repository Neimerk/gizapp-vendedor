import { create } from "zustand";
import { getOrders, updateOrderStatus as apiUpdateOrderStatus, type Order } from "../services/gizApi";
import { ordersConnection, startOrdersConnection } from "../services/signalr";
import { playOrderSound } from "../services/audio";

interface OrdersState {
  orders: Order[];
  loading: boolean;
  toastMessage: string;
  toastVisible: boolean;
  wsStatus: "connected" | "connecting" | "disconnected";

  fetchOrders: () => Promise<void>;
  refresh: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: number) => Promise<void>;
  initSignalR: () => Promise<void>;
  teardownSignalR: () => void;
  dismissToast: () => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  loading: false,
  toastMessage: "",
  toastVisible: false,
  wsStatus: "disconnected",

  fetchOrders: async () => {
    set({ loading: true });
    try {
      const data = await getOrders();
      set({ orders: data });
    } catch (e) {
      console.error(e);
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      const data = await getOrders();
      set({ orders: data });
    } catch (e) {
      console.error(e);
    }
  },

  updateOrderStatus: async (orderId, status) => {
    await apiUpdateOrderStatus(orderId, status);
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    }));
  },

  initSignalR: async () => {
    set({ wsStatus: "connecting" });
    ordersConnection.onConnect = () => set({ wsStatus: "connected" });
    ordersConnection.onDisconnect = () => set({ wsStatus: "disconnected" });
    try {
      await startOrdersConnection();
      ordersConnection.off("OrderCreated");
      ordersConnection.off("OrderStatusUpdated");

      ordersConnection.on("OrderCreated", (newOrder: Order) => {
        set((s) => ({
          orders: s.orders.some((o) => o.id === newOrder.id)
            ? s.orders
            : [newOrder, ...s.orders],
          toastMessage: `${newOrder.customerName} · R$ ${Number(newOrder.total).toFixed(2).replace(".", ",")}`,
          toastVisible: true,
        }));
        playOrderSound();
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification("🛒 Novo pedido — BrasUX Loja", {
            body: `${newOrder.customerName} · R$ ${Number(newOrder.total).toFixed(2).replace(".", ",")}`,
            icon: "/logo-brasux.webp",
          });
        }
      });

      ordersConnection.on("OrderStatusUpdated", (updated: Order) => {
        set((s) => ({
          orders: s.orders.map((o) => (o.id === updated.id ? updated : o)),
        }));
      });
    } catch (e) {
      console.error("SignalR:", e);
    }
  },

  teardownSignalR: () => {
    ordersConnection.off("OrderCreated");
    ordersConnection.off("OrderStatusUpdated");
    ordersConnection.stop();
  },

  dismissToast: () => set({ toastVisible: false }),
}));
