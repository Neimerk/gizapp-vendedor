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
  Map,
  ChevronDown,
  ChevronUp,
  Locate,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  X,
  Loader2,
} from "lucide-react";

import {
  acceptDelivery,
  getAvailableDeliveries,
  getMyCourierOrders,
  updateOrderStatus,
  getProductImageUrl,
  type Order,
} from "../services/gizApi";
import { getCourierWallet, requestCourierWithdrawal, type VendorWallet } from "../services/wallet";
import { ordersConnection, startOrdersConnection, sendCourierLocation } from "../services/signalr";
import { getAuth } from "../services/auth";
import { useGeolocation } from "../hooks/useGeolocation";
import DeliveryMap from "../components/map/DeliveryMap";
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

type Tab = "available" | "active" | "history" | "wallet";

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
  return (
    t.getDate() === n.getDate() &&
    t.getMonth() === n.getMonth() &&
    t.getFullYear() === n.getFullYear()
  );
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

function deliveryAddressString(order: Order) {
  return [
    order.deliveryAddress,
    order.deliveryNumber,
    order.deliveryComplement,
    order.deliveryNeighborhood,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function CourierPage() {
  const auth = getAuth();
  const { coords: courierCoords, loading: geoLoading, error: geoError } = useGeolocation();

  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Carteira do entregador
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPixKey, setWithdrawPixKey] = useState("");
  const [withdrawPixType, setWithdrawPixType] = useState("PIX_KEY");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawOk, setWithdrawOk] = useState(false);

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

  async function loadWallet() {
    setWalletLoading(true);
    setWalletError(null);
    try {
      setWallet(await getCourierWallet());
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Erro ao carregar carteira.");
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount.replace(",", "."));
    if (!amount || amount <= 0) { setWithdrawError("Informe um valor válido."); return; }
    if (!withdrawPixKey.trim()) { setWithdrawError("Informe a chave PIX."); return; }
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await requestCourierWithdrawal(amount, withdrawPixKey.trim(), withdrawPixType);
      setWithdrawOk(true);
      setShowWithdraw(false);
      setWithdrawAmount("");
      setWithdrawPixKey("");
      await loadWallet();
      setTimeout(() => setWithdrawOk(false), 4000);
    } catch (e) {
      setWithdrawError(e instanceof Error ? e.message : "Erro ao solicitar saque.");
    } finally {
      setWithdrawing(false);
    }
  }

  useEffect(() => {
    load();

    const onOrderCreated = () => load(true);
    const onOrderStatusUpdated = (updated: Order) => {
      setMine((cur) => cur.map((o) => (o.id === updated.id ? updated : o)));
      setAvailable((cur) => cur.filter((o) => o.id !== updated.id));
    };
    const onDeliveryTaken = (taken: Order) => {
      setAvailable((cur) => cur.filter((o) => o.id !== taken.id));
    };
    const onDeliveryAccepted = (order: Order) => {
      setMine((cur) =>
        cur.some((o) => o.id === order.id) ? cur : [order, ...cur]
      );
      setAvailable((cur) => cur.filter((o) => o.id !== order.id));
    };

    async function setupSignalR() {
      try {
        await startOrdersConnection();
        ordersConnection.on("OrderCreated", onOrderCreated);
        ordersConnection.on("OrderStatusUpdated", onOrderStatusUpdated);
        ordersConnection.on("DeliveryTaken", onDeliveryTaken);
        ordersConnection.on("DeliveryAccepted", onDeliveryAccepted);
      } catch (e) {
        console.error("SignalR:", e);
      }
    }
    setupSignalR();

    return () => {
      ordersConnection.off("OrderCreated", onOrderCreated);
      ordersConnection.off("OrderStatusUpdated", onOrderStatusUpdated);
      ordersConnection.off("DeliveryTaken", onDeliveryTaken);
      ordersConnection.off("DeliveryAccepted", onDeliveryAccepted);
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
      setActionError(e instanceof Error ? e.message : "Erro ao aceitar entrega.");
    } finally {
      setAccepting(null);
    }
  }

  async function handleDeliver(orderId: string) {
    setDelivering(orderId);
    try {
      await updateOrderStatus(orderId, 4);
      setMine((cur) =>
        cur.map((o) => (o.id === orderId ? { ...o, status: 4 } : o))
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erro ao confirmar entrega.");
    } finally {
      setDelivering(null);
    }
  }

  const active = useMemo(() => mine.filter((o) => o.status === 3), [mine]);

  // Broadcast courier location to all active deliveries via SignalR
  useEffect(() => {
    if (!courierCoords || active.length === 0) return;
    const [lat, lng] = courierCoords;
    active.forEach((order) => {
      sendCourierLocation(order.id, lat, lng).catch(() => {});
    });
  }, [courierCoords, active]);
  const history = useMemo(
    () => mine.filter((o) => o.status === 4 || o.status === 5),
    [mine]
  );

  const todayDeliveries = useMemo(
    () => history.filter((o) => o.status === 4 && isToday(o.updatedAt)),
    [history]
  );
  const todayEarnings = useMemo(
    () => todayDeliveries.reduce((sum, o) => sum + Number(o.deliveryFee), 0),
    [todayDeliveries]
  );

  const {
    page: availPage,
    setPage: setAvailPage,
    totalPages: availTotal,
    pageItems: availItems,
  } = usePagination(available, PAGE_SIZE);
  const {
    page: histPage,
    setPage: setHistPage,
    totalPages: histTotal,
    pageItems: histItems,
  } = usePagination(history, PAGE_SIZE);

  const tabs: { key: Tab; label: string; count?: number; icon?: React.ReactNode }[] = [
    { key: "available", label: "Disponíveis", count: available.length },
    { key: "active",    label: "Em andamento", count: active.length },
    { key: "history",   label: "Histórico",    count: history.length },
    { key: "wallet",    label: "Carteira",      icon: <Wallet size={12} /> },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">
            Olá, {auth?.name?.split(" ")[0] ?? "Parceiro"}
          </p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Logística</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* GPS status */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-bold shadow-sm">
            <Locate size={13} className={courierCoords ? "text-green-500" : geoLoading ? "text-amber-400" : "text-[#94a3b8]"} />
            {geoLoading
              ? <span className="text-amber-500 animate-pulse">Localizando…</span>
              : courierCoords
              ? <span className="text-green-600">GPS ativo</span>
              : <span className="text-[#94a3b8]">{geoError ? "GPS negado" : "GPS inativo"}</span>
            }
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
      </div>

      {/* Action error */}
      {actionError && (
        <div className="mb-2 flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-red-500">⚠</span>
          <p className="flex-1 text-sm font-semibold text-red-700">{actionError}</p>
          <button onClick={() => setActionError(null)} className="shrink-0 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Truck size={18} className="text-white" />}
          color="bg-orange-500"
          label="Em andamento"
          value={active.length}
        />
        <StatCard
          icon={<CheckCircle size={18} className="text-white" />}
          color="bg-green-500"
          label="Entregues hoje"
          value={todayDeliveries.length}
        />
        <StatCard
          icon={<DollarSign size={18} className="text-white" />}
          color="bg-[#16a34a]"
          label="Ganhos hoje"
          value={formatBRL(todayEarnings)}
          small
        />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "wallet" && !wallet) void loadWallet(); }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
              tab === t.key
                ? "bg-[#16a34a] text-white shadow-sm shadow-[#16a34a]/30"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            }`}
          >
            {t.icon && t.icon}
            {t.label}
            {(t.count ?? 0) > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  tab === t.key
                    ? "bg-white/25 text-white"
                    : "bg-[#f1f5f9] text-[#94a3b8]"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-3xl bg-white shadow-sm"
            />
          ))}
        </div>
      ) : (
        <>
          {/* DISPONÍVEIS */}
          {tab === "available" && (
            <div>
              {availItems.length === 0 ? (
                <EmptyState
                  icon={<Zap size={36} className="text-[#16a34a]" />}
                  title="Nenhuma entrega disponível"
                  subtitle="Assim que o pedido for marcado como 'Saiu para entrega', ele aparecerá aqui para aceite."
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {availItems.map((order) => (
                      <AvailableCard
                        key={order.id}
                        order={order}
                        courierCoords={courierCoords}
                        onAccept={() => handleAccept(order.id)}
                        accepting={accepting === order.id}
                      />
                    ))}
                  </div>
                  <Pagination
                    page={availPage}
                    totalPages={availTotal}
                    totalItems={available.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setAvailPage}
                  />
                </>
              )}
            </div>
          )}

          {/* EM ANDAMENTO */}
          {tab === "active" && (
            <div>
              {active.length === 0 ? (
                <EmptyState
                  icon={<Truck size={36} className="text-[#16a34a]" />}
                  title="Nenhuma entrega em andamento"
                  subtitle="Aceite uma entrega na aba Disponíveis."
                />
              ) : (
                <div className="space-y-3">
                  {active.map((order) => (
                    <ActiveCard
                      key={order.id}
                      order={order}
                      courierCoords={courierCoords}
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
                  icon={<Star size={36} className="text-[#16a34a]" />}
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
                  <Pagination
                    page={histPage}
                    totalPages={histTotal}
                    totalItems={history.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setHistPage}
                  />
                </>
              )}
            </div>
          )}

          {/* CARTEIRA */}
          {tab === "wallet" && (
            <div className="space-y-4">
              {walletLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-[#16a34a]" />
                </div>
              ) : walletError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {walletError}
                </div>
              ) : wallet ? (
                <>
                  {/* Saldo cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Saldo disponível</p>
                      <p className="mt-1 text-2xl font-black text-[#0f172a]">{formatBRL(wallet.balance)}</p>
                    </div>
                    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Total ganho</p>
                      <p className="mt-1 text-2xl font-black text-[#16a34a]">{formatBRL(wallet.totalEarned)}</p>
                    </div>
                  </div>

                  {/* Feedback de saque */}
                  {withdrawOk && (
                    <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                      Saque solicitado! O valor será transferido via PIX em até 1 dia útil.
                    </div>
                  )}

                  {/* Botão saque */}
                  <button
                    onClick={() => { setShowWithdraw(true); setWithdrawError(null); }}
                    disabled={wallet.balance <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                  >
                    <Wallet size={15} /> Sacar via PIX
                  </button>

                  {/* Extrato */}
                  {wallet.transactions.length > 0 && (
                    <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-[#f1f5f9] px-5 py-3">
                        <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Extrato recente</p>
                      </div>
                      <div className="divide-y divide-[#f8fafc]">
                        {wallet.transactions.map((tx) => (
                          <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tx.direction === "in" ? "bg-green-50" : "bg-red-50"}`}>
                              {tx.direction === "in"
                                ? <ArrowDownRight size={14} className="text-green-600" />
                                : <ArrowUpRight size={14} className="text-red-500" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-black text-[#0f172a]">{tx.description}</p>
                              <p className="text-[10px] text-[#94a3b8]">
                                {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <p className={`text-sm font-black shrink-0 ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                              {tx.direction === "in" ? "+" : "−"}{formatBRL(tx.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {wallet.transactions.length === 0 && (
                    <EmptyState
                      icon={<Wallet size={36} className="text-[#16a34a]" />}
                      title="Nenhuma transação ainda"
                      subtitle="Seus ganhos de entrega aparecerão aqui após a confirmação."
                    />
                  )}
                </>
              ) : null}

              {/* Modal de saque */}
              {showWithdraw && (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
                  style={{ background: "rgba(11,17,32,0.55)", backdropFilter: "blur(4px)" }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowWithdraw(false); }}
                >
                  <div className="w-full max-w-sm rounded-t-3xl md:rounded-3xl bg-white p-6 shadow-2xl">
                    <div className="mb-5 flex items-center justify-between">
                      <p className="text-base font-black text-[#0f172a]">Sacar via PIX</p>
                      <button onClick={() => setShowWithdraw(false)} className="text-[#94a3b8] hover:text-[#64748b]">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-black text-[#64748b]">Valor (R$)</label>
                        <input
                          type="number" min="1" step="0.01"
                          placeholder="0,00"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-black text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                        />
                        <p className="mt-1 text-[10px] text-[#94a3b8]">Disponível: {formatBRL(wallet?.balance ?? 0)}</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-black text-[#64748b]">Tipo de chave PIX</label>
                        <select
                          value={withdrawPixType}
                          onChange={(e) => setWithdrawPixType(e.target.value)}
                          className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-black text-[#0f172a] outline-none"
                        >
                          <option value="random">Chave aleatória</option>
                          <option value="cpf">CPF</option>
                          <option value="cnpj">CNPJ</option>
                          <option value="phone">Telefone</option>
                          <option value="email">E-mail</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-black text-[#64748b]">Chave PIX</label>
                        <input
                          type="text" placeholder="Digite sua chave PIX"
                          value={withdrawPixKey}
                          onChange={(e) => setWithdrawPixKey(e.target.value)}
                          className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-black text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                        />
                      </div>
                      {withdrawError && (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{withdrawError}</p>
                      )}
                      <button
                        onClick={() => void handleWithdraw()}
                        disabled={withdrawing}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                      >
                        {withdrawing ? <><Loader2 size={14} className="animate-spin" /> Solicitando…</> : "Confirmar saque"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  color,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
      <div
        className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}
      >
        {icon}
      </div>
      <p
        className={`font-black text-[#0f172a] ${small ? "text-lg" : "text-2xl"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#16a34a]/10">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-black text-[#0f172a]">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-[#64748b]">{subtitle}</p>
    </div>
  );
}

function AvailableCard({
  order,
  courierCoords,
  onAccept,
  accepting,
}: {
  order: Order;
  courierCoords: [number, number] | null;
  onAccept: () => void;
  accepting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] px-5 py-3.5">
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
        {/* Address + phone */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-start gap-2 text-sm text-[#64748b]">
            <MapPin size={14} className="mt-0.5 shrink-0 text-[#16a34a]" />
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

        {/* Actions row */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">{timeAgo(order.updatedAt)}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMap((v) => !v)}
              className="flex items-center gap-1 text-xs font-black text-[#16a34a]"
            >
              <Map size={13} />
              {showMap ? "Ocultar mapa" : "Ver mapa"}
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-black text-[#16a34a]"
            >
              {expanded
                ? "Ocultar itens"
                : `${order.items.length} ${order.items.length === 1 ? "item" : "itens"}`}
            </button>
          </div>
        </div>

        {/* Map */}
        {showMap && (
          <div className="mb-4">
            <DeliveryMap
              address={deliveryAddressString(order)}
              courierCoords={courierCoords}
              height={240}
            />
          </div>
        )}

        {/* Items */}
        {expanded && (
          <div className="mb-4 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-2.5"
              >
                <img
                  src={getProductImageUrl(item.imageUrl)}
                  alt={item.productName}
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">
                    {item.quantity}× {item.productName}
                  </p>
                  <p className="text-xs text-[#64748b]">{formatBRL(item.totalPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAccept}
          disabled={accepting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/25 transition-transform active:scale-[0.98] disabled:opacity-60"
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
  courierCoords,
  onDeliver,
  delivering,
}: {
  order: Order;
  courierCoords: [number, number] | null;
  onDeliver: () => void;
  delivering: boolean;
}) {
  const [showItems, setShowItems] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const mapsUrl = googleMapsUrl(order);
  const waUrl = order.customerPhone ? whatsappUrl(order.customerPhone) : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm shadow-orange-100">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Truck size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">
              Em andamento
            </p>
            <p className="text-sm font-black text-white">{order.customerName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-white">{formatBRL(order.total)}</p>
          <p className="text-xs font-bold text-amber-100">
            Taxa: {formatBRL(order.deliveryFee)}
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Address */}
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
              <span>
                {order.customerName} · {order.customerPhone}
              </span>
            </div>
          )}
        </div>

        {/* Map section */}
        <div className="mb-4">
          <button
            onClick={() => setMapOpen((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 transition-colors hover:bg-orange-100"
          >
            <span className="flex items-center gap-1.5">
              <Map size={13} />
              Mapa da rota
            </span>
            {mapOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {mapOpen && (
            <DeliveryMap
              address={deliveryAddressString(order)}
              courierCoords={courierCoords}
              height={300}
            />
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
            <Navigation size={13} className="text-[#16a34a]" />
            Navegar
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

        {/* Items toggle */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#94a3b8]">{timeAgo(order.updatedAt)}</span>
          <button
            onClick={() => setShowItems((v) => !v)}
            className="flex items-center gap-1 text-xs font-black text-[#16a34a]"
          >
            {showItems ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showItems
              ? "Ocultar itens"
              : `${order.items.length} ${order.items.length === 1 ? "item" : "itens"}`}
          </button>
        </div>

        {showItems && (
          <div className="mb-4 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-2.5"
              >
                <img
                  src={getProductImageUrl(item.imageUrl)}
                  alt={item.productName}
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">
                    {item.quantity}× {item.productName}
                  </p>
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
    <div
      className={`overflow-hidden rounded-3xl border shadow-sm ${
        delivered
          ? "border-green-100 bg-green-50/40"
          : "border-red-100 bg-red-50/30"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
          delivered ? "bg-green-500" : "bg-red-400"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            {delivered ? (
              <CheckCircle size={15} className="text-white" />
            ) : (
              <Clock size={15} className="text-white" />
            )}
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
          {delivered && (
            <p className="text-xs font-bold text-green-100">
              +{formatBRL(order.deliveryFee)}
            </p>
          )}
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
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-black text-[#16a34a]"
            >
              {expanded ? "Fechar" : "Detalhes"}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-[#f1f5f9] pt-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-white p-2.5"
              >
                <img
                  src={getProductImageUrl(item.imageUrl)}
                  alt={item.productName}
                  className="h-9 w-9 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-[#0f172a] line-clamp-1">
                    {item.quantity}× {item.productName}
                  </p>
                </div>
                <span className="text-xs font-black text-[#16a34a]">
                  {formatBRL(item.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
