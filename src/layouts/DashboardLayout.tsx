import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ClipboardList, Store, Truck,
  LogOut, ExternalLink, Menu, X, ChevronRight,
} from "lucide-react";
import { getAuth, logout } from "../services/auth";

type NavItem = { to: string; icon: React.ElementType; label: string; end?: boolean };

export default function DashboardLayout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCourier = auth?.role === "Courier";
  const isSeller = auth?.role === "Seller" || auth?.role === "Admin";
  const hasStore = !!auth?.storeId;
  const canSell = isSeller || (isCourier && hasStore);

  const sellerNav: NavItem[] = [
    ...(isSeller ? [{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true }] : []),
    { to: "/produtos", icon: Package, label: "Produtos" },
    { to: "/pedidos", icon: ClipboardList, label: "Pedidos" },
    { to: "/loja", icon: Store, label: "Minha Loja" },
  ];

  const roleLabel =
    auth?.role === "Admin" ? "Administrador"
    : auth?.role === "Seller" && hasStore ? "Lojista"
    : auth?.role === "Seller" ? "Operador BrasUX"
    : auth?.role === "Courier" && hasStore ? "Lojista · Entregador"
    : auth?.role === "Courier" ? "Entregador Parceiro"
    : auth?.role ?? "";

  function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
    return (
      <div>
        <p className="mb-1 px-3 text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.22)" }}>
          {label}
        </p>
        <div className="flex flex-col gap-0.5">
          {items.map(({ to, icon: Icon, label: l, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "text-white"
                    : "text-white/45 hover:text-white/80 hover:bg-white/5"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, rgba(22,163,74,0.2) 0%, rgba(22,163,74,0.08) 100%)",
                        border: "1px solid rgba(22,163,74,0.25)",
                      }}
                    />
                  )}
                  <Icon size={16} className={`relative z-10 shrink-0 ${isActive ? "text-[#4ade80]" : ""}`} />
                  <span className="relative z-10 flex-1">{l}</span>
                  {isActive && <ChevronRight size={13} className="relative z-10 text-[#4ade80]/60" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  const sidebar = (
    <aside
      className="flex h-full w-64 flex-col"
      style={{
        background: "linear-gradient(180deg, #070a12 0%, #060910 100%)",
        borderRight: "1px solid rgba(255,255,255,0.055)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22,163,74,0.4)" }}
          >
            <img src="/logo-brasux.webp" alt="" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white">BrasUX</p>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Loja</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-white/30 hover:text-white md:hidden"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-4 mb-5 h-px" style={{ background: "rgba(255,255,255,0.055)" }} />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3">
        {canSell && <NavGroup label="Operação" items={sellerNav} />}
        <NavGroup
          label="Logística"
          items={[
            { to: "/entregas", icon: Truck, label: "Entregas" },
            ...(!canSell ? [{ to: "/loja", icon: Store, label: "Ativar Loja" }] : []),
          ]}
        />
        <div>
          <p className="mb-1 px-3 text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.22)" }}>
            Ecossistema
          </p>
          <a
            href="https://brasux.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <ExternalLink size={16} />
            BrasUX Shopping
          </a>
        </div>
      </nav>

      {/* User card */}
      <div className="mx-3 mb-4 mt-4">
        <div
          className="rounded-2xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
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
              <p className="truncate text-[10px] text-white/40">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white/50 transition-colors hover:bg-white/8 hover:text-white/80"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "#080c14" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:flex-shrink-0">
        {sidebar}
      </div>

      {/* Sidebar mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transition-transform duration-200 md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebar}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="flex items-center gap-3 px-4 py-3 md:hidden"
          style={{
            background: "rgba(7,10,18,0.95)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Menu size={16} />
          </button>
          <span className="text-sm font-black text-white">
            Bras<span className="text-[#16a34a]">UX</span> Loja
          </span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
