import { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { loginSeller } from "../services/gizApi";
import { saveAuth, getAuth } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const auth = await loginSeller({ email, password });
      if (!["Seller", "Admin", "Courier"].includes(auth.role)) {
        setError("Acesso exclusivo para lojistas e entregadores.");
        return;
      }
      saveAuth(auth);
      const saved = getAuth();
      navigate(saved?.role === "Courier" && !saved?.storeId ? "/entregas" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-[#cbd5e1] focus:border-[#16a34a]/50 focus:ring-2 focus:ring-[#16a34a]/15 focus:bg-white";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 24px rgba(22,163,74,0.35)" }}
          >
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-9 w-9 object-contain" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#16a34a]">BrasUX</p>
            <h1 className="mt-0.5 text-xl font-black text-[#0f172a]">Central Operacional</h1>
            <p className="mt-1 text-sm text-[#94a3b8]">Gestão de loja e logística</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-7" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                E-mail
              </label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="seu@email.com" className={inputCls} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                Senha
              </label>
              <div className="relative">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPass ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
            >
              {loading ? "Entrando…" : "Acessar Central Operacional"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-[#64748b]">
          Não tem uma conta?{" "}
          <Link to="/cadastro" className="font-bold text-[#16a34a] hover:underline">
            Criar conta
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-[#94a3b8]">
          BrasUX Loja · Venda, organize e entregue em um único sistema
        </p>
      </div>
    </div>
  );
}
