import { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { registerStore } from "../services/gizApi";
import { saveAuth } from "../services/auth";
import { validatePassword } from "../utils/passwordValidator";

// ── Máscara e validação ───────────────────────────────────────────────────────

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function validateCPF(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = 11 - (s % 11); if (r > 9) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = 11 - (s % 11); if (r > 9) r = 0;
  return r === +d[10];
}

function validateCNPJ(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = w1.reduce((a, w, i) => a + +d[i] * w, 0);
  let r = s % 11 < 2 ? 0 : 11 - (s % 11);
  if (r !== +d[12]) return false;
  s = w2.reduce((a, w, i) => a + +d[i] * w, 0);
  r = s % 11 < 2 ? 0 : 11 - (s % 11);
  return r === +d[13];
}

// ── Indicador de força ────────────────────────────────────────────────────────

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color, errors } = validatePassword(password);
  const pct = ((score + 1) / 5) * 100;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black" style={{ color }}>{label}</p>
        {errors.length > 0 && (
          <p className="text-[10px] text-[#94a3b8]">{errors[0]}</p>
        )}
      </div>
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const [docType, setDocType] = useState<"cpf" | "cnpj">("cpf");
  const [document, setDocument] = useState("");
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

  function handleDocChange(raw: string) {
    setDocument(docType === "cpf" ? maskCPF(raw) : maskCNPJ(raw));
  }

  function handleDocTypeChange(type: "cpf" | "cnpj") {
    setDocType(type);
    setDocument("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const pwStrength = validatePassword(password);
    if (!pwStrength.valid) {
      setError(pwStrength.errors[0] ?? "Senha inválida.");
      return;
    }

    const digits = document.replace(/\D/g, "");
    if (docType === "cpf" && digits.length !== 11) {
      setError("CPF incompleto.");
      return;
    }
    if (docType === "cnpj" && digits.length !== 14) {
      setError("CNPJ incompleto.");
      return;
    }
    if (docType === "cpf" && !validateCPF(digits)) {
      setError("CPF inválido.");
      return;
    }
    if (docType === "cnpj" && !validateCNPJ(digits)) {
      setError("CNPJ inválido.");
      return;
    }

    try {
      setLoading(true);
      const auth = await registerStore({ name, email, password, storeName, document: digits });
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
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 24px rgba(22,163,74,0.35)" }}
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
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-7" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
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

              {/* Nome da loja */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">Nome da loja</label>
                <input value={storeName} onChange={e => setStoreName(e.target.value)} type="text" required placeholder="Ex: Mercadinho do João" className={inputCls} />
              </div>

              {/* Seu nome */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">Seu nome</label>
                <input value={name} onChange={e => setName(e.target.value)} type="text" required autoComplete="name" placeholder="Nome completo" className={inputCls} />
              </div>

              {/* CPF / CNPJ */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">Documento</label>
                <div className="mb-2 flex gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-1">
                  {(["cpf", "cnpj"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleDocTypeChange(t)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all ${
                        docType === t
                          ? "bg-white text-[#0f172a] shadow-sm"
                          : "text-[#94a3b8] hover:text-[#64748b]"
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <input
                  value={document}
                  onChange={e => handleDocChange(e.target.value)}
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-[#94a3b8]">
                  {docType === "cpf" ? "Pessoa física — CPF do responsável" : "MEI ou empresa — CNPJ"}
                </p>
              </div>

              {/* E-mail */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">E-mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="seu@email.com" className={inputCls} />
              </div>

              {/* Senha */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">Senha</label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                    aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <PasswordStrengthBar password={password} />
              </div>

              {/* Confirmar senha */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#94a3b8]">Confirmar senha</label>
                <div className="relative">
                  <input
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                    aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
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
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
              >
                {loading ? "Criando loja…" : "Criar loja"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-[#64748b]">
          Já tem uma conta?{" "}
          <Link to="/login" className="font-bold text-[#16a34a] hover:underline">Entrar</Link>
        </p>
        <p className="mt-3 text-center text-xs text-[#94a3b8]">
          BrasUX Loja · Venda, organize e entregue em um único sistema
        </p>
      </div>
    </div>
  );
}
