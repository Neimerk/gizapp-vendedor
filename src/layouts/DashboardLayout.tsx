import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Store,
  Truck,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";

import { getAuth, logout } from "../services/auth";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
    isActive
      ? "bg-[#16a34a] text-white"
      : "text-white/60 hover:bg-white/10 hover:text-white"
  }`;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCourier = auth?.role === "Courier";
  const isSeller = auth?.role === "Seller" || auth?.role === "Admin";
  const hasStore = !!auth?.storeId;
  const canSell = isSeller || (isCourier && hasStore);
  const canDeliver = true;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const roleLabel =
    auth?.role === "Admin"
      ? "Administrador · BrasUX"
      : auth?.role === "Seller" && hasStore
      ? "Lojista"
      : auth?.role === "Seller"
      ? "Operador BrasUX"
      : auth?.role === "Courier" && hasStore
      ? "Lojista · Entregador"
      : auth?.role === "Courier"
      ? "Entregador Parceiro"
      : auth?.role ?? "";

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo-brasux.webp" alt="BrasUX" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <h1 className="text-base font-black leading-none tracking-tight">BrasUX</h1>
            <p className="text-[10px] font-black text-[#16a34a] uppercase tracking-widest">Loja</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden rounded-xl p-1.5 text-white/50 hover:text-white hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {canSell && (
          <>
            <p className="mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30">
              Operação Comercial
            </p>
            {isSeller && (
              <NavLink to="/" end className={navCls} onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard size={17} /> Dashboard
              </NavLink>
            )}
            <NavLink to="/produtos" className={navCls} onClick={() => setSidebarOpen(false)}>
              <Package size={17} /> Produtos
            </NavLink>
            <NavLink to="/pedidos" className={navCls} onClick={() => setSidebarOpen(false)}>
              <ClipboardList size={17} /> Pedidos
            </NavLink>
            <NavLink to="/loja" className={navCls} onClick={() => setSidebarOpen(false)}>
              <Store size={17} /> Minha Loja
            </NavLink>
          </>
        )}

        {canDeliver && (
          <>
            <p className={`${canSell ? "mt-4" : ""} mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30`}>
              Logística
            </p>
            <NavLink to="/entregas" className={navCls} onClick={() => setSidebarOpen(false)}>
              <Truck size={17} /> Entregas
            </NavLink>
            {!canSell && (
              <NavLink to="/loja" className={navCls} onClick={() => setSidebarOpen(false)}>
                <Store size={17} /> Ativar Loja
              </NavLink>
            )}
          </>
        )}

        <div className="mt-4">
          <p className="mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30">
            Ecossistema
          </p>
          <a
            href="https://brasux.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={17} /> BrasUX Shopping
          </a>
        </div>
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-white/10 pt-5">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16a34a]/20 text-sm font-black text-[#4ade80]">
            {auth?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{auth?.name || "Usuário"}</p>
            <p className="truncate text-xs text-white/50">{roleLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#f0f2f7]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#0f172a] px-5 py-6 text-white transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] text-[#0f172a]"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-7 w-7 rounded-lg object-contain" />
            <span className="text-sm font-black text-[#0f172a]">
              Bras<span className="text-[#16a34a]">UX</span> Loja
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
