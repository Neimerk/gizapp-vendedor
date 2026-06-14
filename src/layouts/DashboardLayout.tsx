import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Store,
  Truck,
  LogOut,
  Zap,
} from "lucide-react";

import { getAuth, logout } from "../services/auth";

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
    isActive
      ? "bg-[#7c3aed] text-white"
      : "text-white/60 hover:bg-white/10 hover:text-white"
  }`;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const auth = getAuth();

  const isCourier = auth?.role === "Courier";
  const isSeller = auth?.role === "Seller" || auth?.role === "Admin";
  const hasStore = !!auth?.storeId;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const roleLabel =
    auth?.role === "Admin"
      ? "Administrador"
      : auth?.role === "Seller"
      ? "Vendedor"
      : auth?.role === "Courier"
      ? "Entregador"
      : auth?.role ?? "";

  return (
    <div className="flex min-h-screen bg-[#f0f2f7]">
      {/* SIDEBAR */}
      <aside className="flex w-64 flex-col bg-[#0f172a] px-5 py-6 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb]">
            <Zap size={20} className="fill-[#ffd400] text-[#ffd400]" />
          </div>
          <div>
            <h1 className="text-base font-black leading-none">GizApp</h1>
            <p className="text-[10px] font-bold text-[#7c3aed]">
              {isCourier ? "Entregador" : "Vendedor"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {/* Seller section */}
          {(isSeller || (isCourier && hasStore)) && (
            <>
              {isSeller && (
                <p className="mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                  Vendas
                </p>
              )}
              {isCourier && hasStore && (
                <p className="mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                  Minha Loja
                </p>
              )}
              {isSeller && (
                <NavLink to="/" end className={navCls}>
                  <LayoutDashboard size={17} />
                  Dashboard
                </NavLink>
              )}
              <NavLink to="/produtos" className={navCls}>
                <Package size={17} />
                Produtos
              </NavLink>
              <NavLink to="/pedidos" className={navCls}>
                <ClipboardList size={17} />
                Pedidos
              </NavLink>
              <NavLink to="/loja" className={navCls}>
                <Store size={17} />
                Minha Loja
              </NavLink>
            </>
          )}

          {/* Courier section */}
          {isCourier && (
            <>
              {hasStore && (
                <p className="mt-4 mb-1 px-4 text-[10px] font-black uppercase tracking-widest text-white/30">
                  Entregas
                </p>
              )}
              <NavLink to="/entregas" className={navCls}>
                <Truck size={17} />
                Entregas
              </NavLink>
              {!hasStore && (
                <NavLink to="/loja" className={navCls}>
                  <Store size={17} />
                  Ativar Loja
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-white">
              {auth?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {auth?.name || "Usuário"}
              </p>
              <p className="truncate text-xs text-white/50">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
