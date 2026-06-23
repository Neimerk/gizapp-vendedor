import { AUTH_STORAGE_KEY } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5003";

type EventCallback<T = unknown> = (data: T) => void;

class WsHub {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  onConnect?: () => void;
  onDisconnect?: () => void;

  get state(): "Connected" | "Connecting" | "Disconnected" {
    if (!this.ws) return "Disconnected";
    if (this.ws.readyState === WebSocket.CONNECTING) return "Connecting";
    if (this.ws.readyState === WebSocket.OPEN) return "Connected";
    return "Disconnected";
  }

  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      const token = raw ? (JSON.parse(raw)?.token as string | undefined) : null;
      if (!token) { reject(new Error("No auth token")); return; }

      const wsUrl = API_URL.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);
      this.shouldReconnect = true;

      this.ws.onopen = () => { this.onConnect?.(); resolve(); };
      this.ws.onerror = (e) => reject(e);

      this.ws.onmessage = (e: MessageEvent) => {
        try {
          const { type, data } = JSON.parse(e.data as string) as { type: string; data: unknown };
          this.listeners.get(type)?.forEach((cb) => cb(data));
        } catch { /* ignore malformed messages */ }
      };

      this.ws.onclose = () => {
        this.onDisconnect?.();
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.start().catch(() => { /* silent retry */ });
          }, 4000);
        }
      };
    });
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const ordersConnection = new WsHub();

export async function startOrdersConnection(): Promise<void> {
  if (ordersConnection.state === "Disconnected") {
    await ordersConnection.start();
  }
}

export async function sendCourierLocation(orderId: string, lat: number, lng: number): Promise<void> {
  if (ordersConnection.state !== "Connected") return;
  ordersConnection.send({ type: "UpdateCourierLocation", orderId, lat, lng });
}
