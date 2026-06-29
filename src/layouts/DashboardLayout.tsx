import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, ClipboardList, Store, Truck,
  LogOut, ExternalLink, Menu, X, ChevronRight,
  Users, Wallet, Tag, MapPin, UserCheck, Palette, Calendar,
  Settings, BarChart3, Bell, Search,
} from "lucide-react";
import { getAuth, logout } from "../services/auth";
import { clearAllCaches } from "../services/gizApi";
import { useOrdersStore } from "../stores/ordersStore";
import OrderToast from "../components/ui/OrderToast";

// ── Coming soon badge ─────────────────────────────────────────────────────────

function SoonBadge() {
  return (
    <span className="ml-auto rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide"
      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}>
      em breve
    </span>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, end, soon = false, badge,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  soon?: boolean;
  badge?: number;
}) {
  if (soon) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold opacity-35 select-none cursor-default"
        style={{ color: "rgba(255,255,255,0.4)" }}>
        <Icon size={15} className="shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <SoonBadge />
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
          isActive
            ? "bg-white/10 text-white"
            : "text-white/45 hover:bg-white/6 hover:text-white/80"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="nav-indicator"
              className="absolute inset-0 rounded-xl"
              style={{ background: "rgba(255,255,255,0.09)" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            />
          )}
          <Icon
            size={15}
            className={`relative shrink-0 transition-colors ${isActive ? "text-[#4ade80]" : ""}`}
          />
          <span className="relative flex-1 truncate">{label}</span>
          {badge != null && badge > 0 && (
            <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
              style={{ background: "#ef4444" }}>
              {badge > 9 ? "9+" : badge}
            </span>
          )}
          {isActive && <ChevronRight size={12} className="relative text-white/25" />}
        </>
      )}
    </NavLink>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function NavSection({ label }: { label: string }) {
  return (
    <p className="mb-1 mt-5 first:mt-0 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
      {label}
    </p>
  );
}

// ── Page title map ────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/":           "Dashboard",
  "/produtos":   "Produtos",
  "/pedidos":    "Pedidos",
  "/loja":       "Minha Loja",
  "/entregas":   "Entregas",
  "/relatorios": "Relatórios",
};

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    fetchOrders, initSignalR, teardownSignalR,
    toastVisible, toastMessage, dismissToast, wsStatus, orders,
  } = useOrdersStore();

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchOrders();
    initSignalR();
    return teardownSignalR;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCourier = auth?.role === "Courier";
  const isSeller  = auth?.role === "Seller" || auth?.role === "Admin";
  const hasStore  = !!auth?.storeId;
  const canSell   = isSeller || (isCourier && hasStore);

  const pendingOrders = orders.filter(o => o.status === 0).length;

  const roleLabel =
    auth?.role === "Admin"                     ? "Administrador"
    : auth?.role === "Seller" && hasStore      ? "Lojista"
    : auth?.role === "Seller"                  ? "Operador BrasUX"
    : auth?.role === "Courier" && hasStore     ? "Lojista · Entregador"
    : auth?.role === "Courier"                 ? "Entregador Parceiro"
    : auth?.role ?? "";

  const pageTitle = PAGE_TITLES[location.pathname] ?? "BrasUX Loja";

  // ── Sidebar content ──────────────────────────────────────────────────────

  const sidebarContent = (
    <aside
      className="flex h-full w-64 flex-col"
      style={{ background: "#0b1120", borderRight: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              boxShadow: "0 4px 14px rgba(22,163,74,0.38)",
            }}
          >
            <img src="/logo-brasux.webp" alt="" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white">BrasUX</p>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#4ade80]">Loja</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-white/25 hover:text-white/70 md:hidden"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mx-4 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {canSell && (
          <>
            <NavSection label="Operação" />
            {isSeller && (
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end badge={pendingOrders > 0 ? pendingOrders : undefined} />
            )}
            <NavItem to="/produtos" icon={Package} label="Produtos" />
            <NavItem to="/pedidos" icon={ClipboardList} label="Pedidos" badge={pendingOrders > 0 ? pendingOrders : undefined} />
            <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" />
            <NavItem to="/" icon={Users} label="Clientes" soon />
            <NavItem to="/" icon={Wallet} label="Financeiro" soon />
            <NavItem to="/" icon={Tag} label="Cupons" soon />
          </>
        )}

        <NavSection label="Logística" />
        <NavItem to="/entregas" icon={Truck} label="Entregas" />
        <NavItem to="/" icon={MapPin} label="Rotas" soon />
        <NavItem to="/" icon={UserCheck} label="Motoboys" soon />

        <NavSection label="Loja" />
        {canSell && <NavItem to="/loja" icon={Store} label="Minha Loja" />}
        {!canSell && <NavItem to="/loja" icon={Store} label="Ativar Loja" />}
        <NavItem to="/" icon={Palette} label="Aparência" soon />
        <NavItem to="/" icon={Calendar} label="Horários" soon />
        <NavItem to="/" icon={Settings} label="Configurações" soon />

        <NavSection label="Ecossistema" />
        <a
          href="https://brasux.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/35 transition-colors hover:bg-white/6 hover:text-white/65"
        >
          <ExternalLink size={15} className="shrink-0" />
          <span className="flex-1">BrasUX Shopping</span>
        </a>
        <NavItem to="/" icon={Truck} label="BrasUX Entregas" soon />
        <NavItem to="/" icon={BarChart3} label="BrasUX Analytics" soon />
      </nav>

      {/* User card */}
      <div
        className="mx-3 mb-4 rounded-2xl p-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            {auth?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{auth?.name || "Usuário"}</p>
            <p className="truncate text-[10px] text-white/35">{roleLabel}</p>
          </div>
          {/* WS status */}
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: wsStatus === "connected" ? "#4ade80" : wsStatus === "connecting" ? "#facc15" : "#f87171",
                boxShadow: wsStatus === "connected" ? "0 0 5px #4ade80" : undefined,
              }}
            />
            <span className="text-[9px] font-bold text-white/20">
              {wsStatus === "connected" ? "ao vivo" : wsStatus === "connecting" ? "conectando" : "offline"}
            </span>
          </div>
        </div>
        <button
          onClick={() => { clearAllCaches(); logout(); navigate("/login"); }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/35 transition-colors hover:bg-white/8 hover:text-white/65"
        >
          <LogOut size={12} /> Sair
        </button>
      </div>
    </aside>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ background: "#f8fafc" }}>
      <OrderToast
        visible={toastVisible}
        title="Novo pedido recebido"
        message={toastMessage}
        onClose={dismissToast}
        onAction={() => { dismissToast(); navigate("/pedidos"); }}
      />

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 md:hidden"
            style={{ background: "rgba(11,17,32,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — desktop */}
      <div className="hidden md:flex md:flex-col md:shrink-0">{sidebarContent}</div>

      {/* Sidebar — mobile drawer */}
      <motion.div
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -256 }}
        transition={{ type: "spring", stiffness: 320, damping: 36 }}
        className="fixed inset-y-0 left-0 z-30 flex flex-col md:hidden"
        style={{ width: 256 }}
      >
        {sidebarContent}
      </motion.div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Mobile header */}
        <header
          className="flex items-center gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3 md:hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]"
            aria-label="Abrir menu"
          >
            <Menu size={16} />
          </button>
          <span className="text-sm font-black text-[#0f172a]">
            Bras<span style={{ color: "#16a34a" }}>UX</span> Loja
          </span>
          <div className="ml-auto flex items-center gap-2">
            {pendingOrders > 0 && (
              <div className="relative">
                <Bell size={16} className="text-[#64748b]" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-black text-white">
                  {pendingOrders > 9 ? "9+" : pendingOrders}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Desktop top bar */}
        <header
          className="sticky top-0 z-10 hidden items-center gap-4 border-b border-[#e2e8f0] bg-white/95 px-6 md:flex"
          style={{ height: 52, backdropFilter: "blur(8px)", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
        >
          {/* Page title */}
          <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
            <span className="font-black text-[#0f172a]">{pageTitle}</span>
          </div>

          {/* Search (cosmetic) */}
          <div
            className="flex flex-1 max-w-xs items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[#94a3b8] transition-colors hover:border-[#cbd5e1]"
            style={{ cursor: "text" }}
          >
            <Search size={13} />
            <span className="text-xs font-medium">Buscar…</span>
            <kbd className="ml-auto rounded-md border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-[9px] font-black text-[#cbd5e1]">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notifications bell */}
            <button
              onClick={() => navigate("/pedidos")}
              className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a]"
              aria-label="Notificações"
            >
              <Bell size={14} />
              {pendingOrders > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-black text-white ring-2 ring-white">
                  {pendingOrders > 9 ? "9+" : pendingOrders}
                </span>
              )}
            </button>

            {/* WS indicator */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-2.5 py-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: wsStatus === "connected" ? "#16a34a" : wsStatus === "connecting" ? "#f59e0b" : "#ef4444",
                  boxShadow: wsStatus === "connected" ? "0 0 5px #16a34a" : undefined,
                }}
              />
              <span className="text-[10px] font-bold text-[#94a3b8]">
                {wsStatus === "connected" ? "Ao vivo" : wsStatus === "connecting" ? "Conectando…" : "Offline"}
              </span>
            </div>

            {/* Avatar */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {auth?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
