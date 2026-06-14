import { useState } from "react";
import { Eye, EyeOff, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { loginSeller } from "../services/gizApi";
import { saveAuth } from "../services/auth";
import { getAuth } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("albertoneimerk@gmail.com");
  const [password, setPassword] = useState("123456789");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      const auth = await loginSeller({ email, password });
      const allowed = ["Seller", "Admin", "Courier"];
      if (!allowed.includes(auth.role)) {
        alert("Este acesso é exclusivo para vendedores e entregadores.");
        return;
      }
      saveAuth(auth);
      const saved = getAuth();
      navigate(saved?.role === "Courier" && !saved?.storeId ? "/entregas" : "/");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f7] px-5">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb] shadow-xl shadow-[#7c3aed]/30">
            <Zap size={28} className="fill-[#ffd400] text-[#ffd400]" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-[#7c3aed]">
            GizApp
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#0f172a]">
            Painel
          </h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Vendedores e entregadores
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[#e8eaf0] bg-white p-7 shadow-sm"
        >
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
              E-mail
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
              Senha
            </label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 pr-12 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#7c3aed]/30 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>
      </div>
    </div>
  );
}
