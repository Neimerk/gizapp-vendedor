import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type EventCallback<T = unknown> = (data: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRealtimeOrder(r: any) {
  const rawItems: any[] = Array.isArray(r.items) ? r.items : []; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id:                   r.id,
    storeId:              r.store_id              ?? "",
    storeName:            r.store_name            ?? "",
    customerId:           r.customer_id           ?? "",
    customerName:         r.customer_name         ?? "",
    customerPhone:        r.customer_phone        ?? "",
    deliveryAddress:      r.delivery_address      ?? "",
    deliveryNumber:       r.delivery_number       ?? "",
    deliveryComplement:   r.delivery_complement   ?? "",
    deliveryNeighborhood: r.delivery_neighborhood ?? "",
    paymentMethod:        r.payment_method        ?? "",
    deliveryFee:          Number(r.delivery_fee   ?? 0),
    subtotal:             Number(r.subtotal        ?? 0),
    total:                Number(r.total           ?? 0),
    serviceFee:           Number(r.service_fee    ?? 0),
    paymentStatus:        r.payment_status        ?? "pending",
    asaasChargeId:        r.asaas_charge_id       ?? null,
    status:               r.status                ?? 0,
    courierId:            r.courier_id            ?? null,
    notes:                r.notes                 ?? null,
    createdAt:            r.created_at,
    updatedAt:            r.updated_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: rawItems.map((it: any, idx: number) => ({
      id:             it.id              ?? `item-${idx}`,
      orderId:        r.id,
      storeProductId: it.storeProductId  ?? it.store_product_id ?? "",
      productName:    it.productName     ?? it.product_name     ?? it.name ?? "",
      imageUrl:       it.imageUrl        ?? it.image_url,
      unitPrice:      Number(it.unitPrice  ?? it.unit_price  ?? it.price ?? 0),
      quantity:       Number(it.quantity   ?? 1),
      totalPrice:     Number(it.totalPrice ?? it.total_price ?? it.total ?? 0),
    })),
  };
}

class RealtimeHub {
  private channel: RealtimeChannel | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private _state: "Connected" | "Connecting" | "Disconnected" = "Disconnected";
  onConnect?: () => void;
  onDisconnect?: () => void;

  get state(): "Connected" | "Connecting" | "Disconnected" {
    return this._state;
  }

  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  off<T = unknown>(event: string, callback?: EventCallback<T>): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback as EventCallback);
    } else {
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  async start(): Promise<void> {
    if (this._state !== "Disconnected") return;
    this._state = "Connecting";

    this.channel = supabase
      .channel("loja-orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" },
        (payload) => { this.emit("OrderCreated", mapRealtimeOrder(payload.new)); },
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => { this.emit("OrderStatusUpdated", mapRealtimeOrder(payload.new)); },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deliveries" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Emit DeliveryTaken so consumers remove the order from the available list.
          // DeliveryAccepted is handled locally in CourierPage via handleAccept().
          this.emit("DeliveryTaken", { id: row.order_id as string });
        },
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          this._state = "Connected";
          this.onConnect?.();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this._state = "Disconnected";
          this.onDisconnect?.();
        }
      });
  }

  stop(): void {
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this._state = "Disconnected";
    this.onDisconnect?.();
  }
}

export const ordersConnection = new RealtimeHub();

export async function startOrdersConnection(): Promise<void> {
  await ordersConnection.start();
}

export async function sendCourierLocation(_orderId: string, lat: number, lng: number): Promise<void> {
  await (supabase.rpc as unknown as (...a: unknown[]) => Promise<void>)(
    "upsert_courier_location",
    { p_lat: lat, p_lng: lng, p_heading: 0 },
  );
}
