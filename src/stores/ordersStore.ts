import { create } from "zustand";
import { getOrders, updateOrderStatus as apiUpdateOrderStatus, type Order } from "../services/gizApi";
import { ordersConnection, startOrdersConnection } from "../services/signalr";
import { playOrderSound } from "../services/audio";

interface OrdersState {
  orders: Order[];
  loading: boolean;
  toastMessage: string;
  toastVisible: boolean;

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
    try {
      await startOrdersConnection();
      ordersConnection.off("OrderCreated");
      ordersConnection.off("OrderStatusUpdated");

      ordersConnection.on("OrderCreated", (newOrder: Order) => {
        set((s) => ({
          orders: s.orders.some((o) => o.id === newOrder.id)
            ? s.orders
            : [newOrder, ...s.orders],
          toastMessage: "Novo pedido recebido no BrasUX Loja!",
          toastVisible: true,
        }));
        playOrderSound();
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
