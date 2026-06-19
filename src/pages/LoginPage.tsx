import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { loginSeller } from "../services/gizApi";
import { saveAuth, getAuth } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const auth = await loginSeller({ email, password });
      const allowed = ["Seller", "Admin", "Courier"];
      if (!allowed.includes(auth.role)) {
        setError("Acesso exclusivo para lojistas e entregadores parceiros.");
        return;
      }
      saveAuth(auth);
      const saved = getAuth();
      navigate(saved?.role === "Courier" && !saved?.storeId ? "/entregas" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f9f4] px-5">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <img
              src="/logo-brasux.webp"
              alt="BrasUX"
              className="h-20 w-20 object-contain drop-shadow-xl"
            />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">
            BrasUX
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#0f172a]">
            Loja
          </h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Central operacional para lojistas e entregadores
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
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
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
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5 pr-12 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
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

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] py-4 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Acessar Central Operacional"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="https://brasux.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#64748b] hover:text-[#16a34a] transition-colors"
          >
            BrasUX Loja · Venda, organize e entregue em um único sistema →
          </a>
        </div>
      </div>
    </div>
  );
}
