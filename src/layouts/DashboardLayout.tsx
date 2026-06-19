import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ClipboardList, Store, Truck,
  LogOut, ExternalLink, Menu, X, ChevronRight,
} from "lucide-react";
import { getAuth, logout } from "../services/auth";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCourier = auth?.role === "Courier";
  const isSeller = auth?.role === "Seller" || auth?.role === "Admin";
  const hasStore = !!auth?.storeId;
  const canSell = isSeller || (isCourier && hasStore);

  const roleLabel =
    auth?.role === "Admin" ? "Administrador"
    : auth?.role === "Seller" && hasStore ? "Lojista"
    : auth?.role === "Seller" ? "Operador BrasUX"
    : auth?.role === "Courier" && hasStore ? "Lojista · Entregador"
    : auth?.role === "Courier" ? "Entregador Parceiro"
    : auth?.role ?? "";

  function NavItem({ to, icon: Icon, label, end }: { to: string; icon: React.ElementType; label: string; end?: boolean }) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
            isActive ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/6 hover:text-white/80"
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={16} className={`shrink-0 ${isActive ? "text-[#4ade80]" : ""}`} />
            <span className="flex-1">{label}</span>
            {isActive && <ChevronRight size={12} className="text-white/30" />}
          </>
        )}
      </NavLink>
    );
  }

  function NavSection({ label }: { label: string }) {
    return (
      <p className="mb-1 mt-5 first:mt-0 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
        {label}
      </p>
    );
  }

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col" style={{ background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 14px rgba(22,163,74,0.4)" }}
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
        >
          <X size={16} />
        </button>
      </div>

      <div className="mx-4 h-px bg-white/[0.06]" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {canSell && (
          <>
            <NavSection label="Operação" />
            {isSeller && <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />}
            <NavItem to="/produtos" icon={Package} label="Produtos" />
            <NavItem to="/pedidos" icon={ClipboardList} label="Pedidos" />
            <NavItem to="/loja" icon={Store} label="Minha Loja" />
          </>
        )}
        <NavSection label="Logística" />
        <NavItem to="/entregas" icon={Truck} label="Entregas" />
        {!canSell && <NavItem to="/loja" icon={Store} label="Ativar Loja" />}

        <NavSection label="Ecossistema" />
        <a
          href="https://brasux.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/40 transition-colors hover:bg-white/6 hover:text-white/70"
        >
          <ExternalLink size={16} /> BrasUX Shopping
        </a>
      </nav>

      {/* User */}
      <div className="mx-3 mb-4 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            {auth?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-white">{auth?.name || "Usuário"}</p>
            <p className="truncate text-[10px] text-white/40">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/40 transition-colors hover:bg-white/8 hover:text-white/70"
        >
          <LogOut size={13} /> Sair
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "#f8fafc" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <div className="hidden md:flex md:flex-col">{sidebarContent}</div>

      {/* Sidebar mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-30 flex flex-col transition-transform duration-200 md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 256 }}
      >
        {sidebarContent}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="flex items-center gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3 md:hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]"
          >
            <Menu size={16} />
          </button>
          <span className="text-sm font-black text-[#0f172a]">
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
