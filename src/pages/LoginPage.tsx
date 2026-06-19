import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Zap } from "lucide-react";
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

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{ background: "linear-gradient(135deg, #05080f 0%, #070b14 50%, #060910 100%)" }}
    >
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-32 top-1/3 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "rgba(22,163,74,0.12)" }}
        />
        <div
          className="absolute -right-32 bottom-1/3 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "rgba(22,163,74,0.07)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              boxShadow: "0 8px 32px rgba(22,163,74,0.45)",
            }}
          >
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#16a34a]">BrasUX</p>
            <h1 className="mt-0.5 text-2xl font-black text-white">Central Operacional</h1>
            <p className="mt-1 text-sm text-white/40">Gestão de loja e logística</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-7"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">
                E-mail
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[#16a34a]/40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f1f5f9",
                  caretColor: "#16a34a",
                }}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/40">
                Senha
              </label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-2xl px-4 py-3 pr-11 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[#16a34a]/40"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#f1f5f9",
                    caretColor: "#16a34a",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: loading ? "none" : "0 6px 24px rgba(22,163,74,0.4)",
              }}
            >
              <Zap size={15} />
              {loading ? "Entrando…" : "Acessar Central Operacional"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          BrasUX Loja · Venda, organize e entregue em um único sistema
        </p>
      </div>
    </div>
  );
}
