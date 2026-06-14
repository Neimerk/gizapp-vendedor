import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Star,
  Truck,
  User,
  Zap,
} from "lucide-react";

import {
  acceptDelivery,
  getAvailableDeliveries,
  getMyCourierOrders,
  updateOrderStatus,
  getProductImageUrl,
  type Order,
} from "../services/gizApi";
import { ordersConnection, startOrdersConnection } from "../services/signalr";
import { getAuth } from "../services/auth";
import Pagination from "../components/ui/Pagination";
import { usePagination } from "../hooks/usePagination";

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<number, string> = {
  0: "Recebido",
  1: "Aceito",
  2: "Preparando",
  3: "Saiu para entrega",
  4: "Entregue",
  5: "Cancelado",
};

type Tab = "available" | "active" | "history";

function formatBRL(v: number) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function isToday(d: string) {
  const t = new Date(d);
  const n = new Date();
  return t.getDate() === n.getDate() && t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear();
}

function googleMapsUrl(order: Order) {
  const addr = encodeURIComponent(
    `${order.deliveryAddress}, ${order.deliveryNumber}${order.deliveryNeighborhood ? `, ${order.deliveryNeighborhood}` : ""}`
  );
  return `https://www.google.com/maps/search/?api=1&query=${addr}`;
}

function whatsappUrl(phone: string) {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/55${clean}`;
}

export default function CourierPage() {
  const auth = getAuth();
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [avail, myOrders] = await Promise.all([
        getAvailableDeliveries(),
        getMyCourierOrders(),
      ]);
      setAvailable(avail);
      setMine(myOrders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    async function setupSignalR() {
      try {
        await startOrdersConnection();

        // Novo pedido saindo para entrega — aparece em Disponíveis
        ordersConnection.off("OrderCreated");
        ordersConnection.on("OrderCreated", () => load(true));

        // Atualização de status — refaz listas
        ordersConnection.off("OrderStatusUpdated");
        ordersConnection.on("OrderStatusUpdated", (updated: Order) => {
          setMine((cur) => cur.map((o) => (o.id === updated.id ? updated : o)));
          // remove dos disponíveis se foi aceito
          setAvailable((cur) => cur.filter((o) => o.id !== updated.id));
        });

        // Outro entregador aceitou — remove dos disponíveis
        ordersConnection.off("DeliveryTaken");
        ordersConnection.on("DeliveryTaken", (taken: Order) => {
          setAvailable((cur) => cur.filter((o) => o.id !== taken.id));
        });

        // Eu aceitei — vai para as minhas
        ordersConnection.off("DeliveryAccepted");
        ordersConnection.on("DeliveryAccepted", (order: Order) => {
          setMine((cur) =>
            cur.some((o) => o.id === order.id) ? cur : [order, ...cur]
          );
          setAvailable((cur) => cur.filter((o) => o.id !== order.id));
        });
      } catch (e) {
        console.error("SignalR:", e);
      }
    }
    setupSignalR();

    return () => {
      ordersConnection.off("OrderCreated");
      ordersConnection.off("OrderStatusUpdated");
      ordersConnection.off("DeliveryTaken");
      ordersConnection.off("DeliveryAccepted");
    };
  }, []);

  async function handleAccept(orderId: string) {
    setAccepting(orderId);
    try {
      const updated = await acceptDelivery(orderId);
      setAvailable((cur) => cur.filter((o) => o.id !== orderId));
      setMine((cur) => [updated, ...cur]);
      setTab("active");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao aceitar entrega.");
    } finally {
      setAccepting(null);
    }
  }

  async function handleDeliver(orderId: string) {
    setDelivering(orderId);
    try {
      await updateOrderStatus(orderId, 4);
      setMine((cur) => cur.map((o) => (o.id === orderId ? { ...o, status: 4 } : o)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao confirmar entrega.");
    } finally {
      setDelivering(null);
    }
  }

  const active = useMemo(() => mine.filter((o) => o.status === 3), [mine]);
  const history = useMemo(() => mine.filter((o) => o.status === 4 || o.status === 5), [mine]);

  const todayDeliveries = useMemo(
    () => history.filter((o) => o.status === 4 && isToday(o.updatedAt)),
    [history]
  );
  const todayEarnings = useMemo(
    () => todayDeliveries.reduce((sum, o) => sum + Number(o.deliveryFee), 0),
    [todayDeliveries]
  );

  const { page: availPage, setPage: setAvailPage, totalPages: availTotal, pageItems: availItems } =
    usePagination(available, PAGE_SIZE);
  const { page: histPage, setPage: setHistPage, totalPages: histTotal, pageItems: histItems } =
    usePagination(history, PAGE_SIZE);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "available", label: "Disponíveis", count: available.length },
    { key: "active", label: "Em andamento", count: active.length },
    { key: "history", label: "Histórico", count: history.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#7c3aed]">
            Olá, {auth?.name?.split(" ")[0] ?? "Entregador"}
          </p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Entregas</h1>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-black text-[#64748b] shadow-sm hover:bg-[#f8fafc]"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard icon={<Truck size={18} className="text-white" />} color="bg-orange-500" label="Em andamento" value={active.length} />
        <StatCard icon={<CheckCircle size={18} className="text-white" />} color="bg-green-500" label="Entregues hoje" value={todayDeliveries.length} />
        <StatCard icon={<DollarSign size={18} className="text-white" />} color="bg-[#7c3aed]" label="Ganhos hoje" value={formatBRL(todayEarnings)} small />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              tab === t.key
                ? "bg-[#7c3aed] text-white shadow-sm shadow-[#7c3aed]/30"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                tab === t.key ? "bg-white/25 text-white" : "bg-[#f1f5f9] text-[#94a3b8]"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <>
          {/* DISPONÍVEIS */}
          {tab === "available" && (
            <div>
              {availItems.length === 0 ? (
                <EmptyState
                  icon={<Zap size={36} className="text-[#7c3aed]" />}
                  title="Nenhuma entrega disponível"
                  subtitle="Assim que o vendedor marcar um pedido como 'Saiu para entrega', ele aparecerá aqui."
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {availItems.map((order) => (
                      <AvailableCard
                        key={order.id}
                        order={order}
                        onAccept={() => handleAccept(order.id)}
                        accepting={accepting === order.id}
                      />
                    ))}
                  </div>
                  <Pagination page={availPage} totalPages={availTotal} totalItems={available.length} pageSize={PAGE_SIZE} onPageChange={setAvailPage} />
                </>
              )}
            </div>
          )}

          {/* EM ANDAMENTO */}
          {tab === "active" && (
            <div>
              {active.length === 0 ? (
                <EmptyState
                  icon={<Truck size={36} className="text-[#7c3aed]" />}
                  title="Nenhuma entrega em andamento"
                  subtitle="Aceite uma entrega na aba Disponíveis."
                />
              ) : (
                <div className="space-y-3">
                  {active.map((order) => (
                    <ActiveCard
                      key={order.id}
                      order={order}
                      onDeliver={() => handleDeliver(order.id)}
                      delivering={delivering === order.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTÓRICO */}
          {tab === "history" && (
            <div>
              {histItems.length === 0 ? (
                <EmptyState
                  icon={<Star size={36} className="text-[#7c3aed]" />}
                  title="Nenhuma entrega realizada ainda"
                  subtitle="Seu histórico de entregas aparecerá aqui."
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {histItems.map((order) => (
                      <HistoryCard key={order.id} order={order} />
                    ))}
                  </div>
                  <Pagination page={histPage} totalPages={histTotal} totalItems={history.length} pageSize={PAGE_SIZE} onPageChange={setHistPage} />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function StatCard({
  icon, color, label, value, small,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <p className={`font-black text-[#0f172a] ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#7c3aed]/10">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-black text-[#0f172a]">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-[#64748b]">{subtitle}</p>
    </div>
  );
}

function AvailableCard({
  order,
  onAccept,
  accepting,
}: {
  order: Order;
  onAccept: () => void;
  accepting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#7c3aed] to-[#2563eb] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Package size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
              {order.storeName ?? "Loja"}
            </p>
            <p className="text-sm font-black text-white">{order.customerName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{formatBRL(order.total)}</p>
          <p className="text-xs font-bold text-[#a5f3fc]">
            Taxa: {formatBRL(order.deliveryFee)}
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start gap-2 text-sm text-[#64748b]">
            <MapPin size={14} className="mt-0.5 shrink-0 text-[#7c3aed]" />
            <span>
              {order.deliveryAddress}, {order.deliveryNumber}
              {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
              {order.deliveryNeighborhood ? `, ${order.deliveryNeighborhood}` : ""}
            </span>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <Phone size={14} className="shrink-0" />
              <span>{order.customerPhone}</span>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">{timeAgo(order.updatedAt)}</span>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs font-black text-[#7c3aed]">
            {expanded ? "Ocultar itens" : `${order.items.length} ${order.items.length === 1 ? "item" : "itens"}`}
          </button>
        </div>

        {expanded && (
          <div className="mb-4 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-2.5">
                <img src={getProductImageUrl(item.imageUrl)} alt={item.productName} className="h-10 w-10 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">{item.quantity}× {item.productName}</p>
                  <p className="text-xs text-[#64748b]">{formatBRL(item.totalPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAccept}
          disabled={accepting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] py-3.5 text-sm font-black text-white shadow-lg shadow-[#7c3aed]/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <Truck size={16} />
          {accepting ? "Aceitando..." : "Aceitar entrega"}
        </button>
      </div>
    </div>
  );
}

function ActiveCard({
  order,
  onDeliver,
  delivering,
}: {
  order: Order;
  onDeliver: () => void;
  delivering: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mapsUrl = googleMapsUrl(order);
  const waUrl = order.customerPhone ? whatsappUrl(order.customerPhone) : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm shadow-orange-100">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Truck size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">Em andamento</p>
            <p className="text-sm font-black text-white">{order.customerName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{formatBRL(order.total)}</p>
          <p className="text-xs font-bold text-amber-100">Taxa: {formatBRL(order.deliveryFee)}</p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start gap-2 text-sm text-[#64748b]">
            <MapPin size={14} className="mt-0.5 shrink-0 text-orange-500" />
            <span className="flex-1">
              {order.deliveryAddress}, {order.deliveryNumber}
              {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
              {order.deliveryNeighborhood ? `, ${order.deliveryNeighborhood}` : ""}
            </span>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-2 text-sm text-[#64748b]">
              <User size={14} className="shrink-0" />
              <span>{order.customerName} · {order.customerPhone}</span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mb-4 flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 text-xs font-black text-[#0f172a]"
          >
            <Navigation size={13} className="text-[#7c3aed]" />
            Abrir mapa
          </a>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-green-200 bg-green-50 py-2.5 text-xs font-black text-green-700"
            >
              <Phone size={13} />
              WhatsApp
            </a>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">{timeAgo(order.updatedAt)}</span>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs font-black text-[#7c3aed]">
            {expanded ? "Ocultar itens" : `${order.items.length} ${order.items.length === 1 ? "item" : "itens"}`}
          </button>
        </div>

        {expanded && (
          <div className="mb-4 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-2.5">
                <img src={getProductImageUrl(item.imageUrl)} alt={item.productName} className="h-10 w-10 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">{item.quantity}× {item.productName}</p>
                  <p className="text-xs text-[#64748b]">{formatBRL(item.totalPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onDeliver}
          disabled={delivering}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 py-3.5 text-sm font-black text-white shadow-lg shadow-green-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <CheckCircle size={16} />
          {delivering ? "Confirmando..." : "Confirmar entrega"}
        </button>
      </div>
    </div>
  );
}

function HistoryCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const delivered = order.status === 4;

  return (
    <div className={`overflow-hidden rounded-3xl border shadow-sm ${delivered ? "border-green-100 bg-green-50/40" : "border-red-100 bg-red-50/30"}`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${delivered ? "bg-green-500" : "bg-red-400"}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            {delivered ? <CheckCircle size={15} className="text-white" /> : <Clock size={15} className="text-white" />}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">
              {STATUS_LABEL[order.status]}
            </p>
            <p className="text-sm font-black text-white">{order.customerName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-white">{formatBRL(order.total)}</p>
          {delivered && <p className="text-xs font-bold text-green-100">+{formatBRL(order.deliveryFee)}</p>}
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-1.5 text-xs text-[#64748b]">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-1">
              {order.deliveryAddress}, {order.deliveryNumber}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#94a3b8]">{timeAgo(order.updatedAt)}</span>
            <button onClick={() => setExpanded((v) => !v)} className="text-xs font-black text-[#7c3aed]">
              {expanded ? "Fechar" : "Detalhes"}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5">
                <img src={getProductImageUrl(item.imageUrl)} alt={item.productName} className="h-9 w-9 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">{item.quantity}× {item.productName}</p>
                </div>
                <span className="text-xs font-black text-[#7c3aed]">{formatBRL(item.totalPrice)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
