import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { registerStore } from "../services/gizApi";
import { saveAuth } from "../services/auth";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setLoading(true);
      const auth = await registerStore({ name, email, password, storeName });
      saveAuth(auth);
      setSuccess(true);
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-[#cbd5e1] focus:border-[#16a34a]/50 focus:ring-2 focus:ring-[#16a34a]/15 focus:bg-white";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-10">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              boxShadow: "0 8px 24px rgba(22,163,74,0.35)",
            }}
          >
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-9 w-9 object-contain" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#16a34a]">BrasUX</p>
            <h1 className="mt-0.5 text-xl font-black text-[#0f172a]">Criar loja</h1>
            <p className="mt-1 text-sm text-[#94a3b8]">Cadastre sua loja na plataforma</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-[#e2e8f0] bg-white p-7"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
        >
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 size={48} className="text-[#16a34a]" />
              <div>
                <p className="text-base font-black text-[#0f172a]">Loja criada com sucesso!</p>
                <p className="mt-1 text-sm text-[#64748b]">Redirecionando para o painel…</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                  Nome da loja
                </label>
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  type="text"
                  required
                  placeholder="Ex: Mercadinho do João"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                  Seu nome
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Nome completo"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                  E-mail
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                  Senha
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                  Confirmar senha
                </label>
                <div className="relative">
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
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
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  boxShadow: "0 4px 16px rgba(22,163,74,0.35)",
                }}
              >
                {loading ? "Criando loja…" : "Criar loja"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-[#64748b]">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-bold text-[#16a34a] hover:underline">
            Entrar
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-[#94a3b8]">
          BrasUX Loja · Venda, organize e entregue em um único sistema
        </p>
      </div>
    </div>
  );
}
