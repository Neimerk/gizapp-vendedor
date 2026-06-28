import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, Eye, EyeOff, Lock, Check, ArrowRight,
  Zap, Package, Truck, BarChart3, ChevronDown,
  Shield, Smartphone,
} from "lucide-react";
import { loginSeller } from "../services/gizApi";
import { saveAuth, getAuth } from "../services/auth";
import { useLoginThrottle } from "../hooks/useLoginThrottle";

// ── Dados ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BarChart3,
    title: "Dashboard em tempo real",
    desc: "KPIs, pedidos recentes e faturamento atualizados via WebSocket — sem recarregar a página.",
    color: "#16a34a",
  },
  {
    icon: Package,
    title: "Gestão de produtos",
    desc: "Cadastre e destaque produtos no BrasUX Shopping. Upload automático com compressão WebP.",
    color: "#2563eb",
  },
  {
    icon: Truck,
    title: "Logística integrada",
    desc: "Rastreamento de entregas em tempo real com mapa interativo. Entregadores conectados à sua loja.",
    color: "#d97706",
  },
  {
    icon: Zap,
    title: "Notificações instantâneas",
    desc: "Alertas de novos pedidos chegam direto no navegador — nunca perca um cliente esperando.",
    color: "#7c3aed",
  },
  {
    icon: Shield,
    title: "Segurança LGPD",
    desc: "Dados protegidos com JWT, armazenamento seguro e conformidade com a Lei Geral de Proteção de Dados.",
    color: "#dc2626",
  },
  {
    icon: Smartphone,
    title: "Funciona em qualquer tela",
    desc: "Interface responsiva otimizada para celular, tablet e desktop sem instalar nenhum aplicativo.",
    color: "#0891b2",
  },
];

const PLANS_PREVIEW = [
  {
    name: "Free",
    price: "R$0",
    period: "/mês",
    badge: null,
    highlight: false,
    features: ["30 produtos", "3 destaques", "3 categorias", "1 loja"],
  },
  {
    name: "Básico",
    price: "R$49",
    period: "/mês",
    badge: null,
    highlight: false,
    features: ["100 produtos", "15 destaques", "15 categorias", "Até 3 lojas"],
  },
  {
    name: "Premium",
    price: "R$99",
    period: "/mês",
    badge: "Mais popular",
    highlight: true,
    features: ["300 produtos", "30 destaques", "Categorias ilimitadas", "Até 10 lojas", "API + Relatórios"],
  },
  {
    name: "White Label",
    price: "Consulta",
    period: "",
    badge: "Enterprise",
    highlight: false,
    features: ["Produtos ilimitados", "Marca própria", "Domínio próprio", "Suporte 24/7"],
  },
];

const STATS = [
  { value: "500+", label: "lojas ativas" },
  { value: "15k+", label: "pedidos/mês" },
  { value: "99,9%", label: "de uptime" },
  { value: "< 50ms", label: "latência média" },
];

// ── Nav ─────────────────────────────────────────────────────────────────────

function Nav({ onScrollToLogin }: { onScrollToLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(226,232,240,0.8)" : "1px solid transparent",
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.06)" : "none",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <span className={`text-sm font-black ${scrolled ? "text-[#0f172a]" : "text-white"}`}>
              BrasUX
            </span>
            <span className={`ml-1 text-sm font-medium ${scrolled ? "text-[#64748b]" : "text-white/70"}`}>
              Loja
            </span>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center gap-2">
          <Link
            to="/planos"
            className={`hidden px-4 py-2 text-sm font-semibold transition-colors sm:block ${
              scrolled ? "text-[#475569] hover:text-[#0f172a]" : "text-white/80 hover:text-white"
            }`}
          >
            Planos
          </Link>
          <Link
            to="/cadastro"
            className={`hidden rounded-xl px-4 py-2 text-sm font-bold transition-all sm:block ${
              scrolled
                ? "border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8fafc]"
                : "border border-white/30 text-white hover:bg-white/10"
            }`}
          >
            Criar conta
          </Link>
          <button
            onClick={onScrollToLogin}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 2px 12px rgba(22,163,74,0.4)" }}
          >
            Entrar
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const loginRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { blocked, remainingMin, checkBlock, registerAttempt } = useLoginThrottle();

  function scrollToLogin() {
    loginRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (checkBlock()) return;
    try {
      setLoading(true);
      const auth = await loginSeller({ email, password });
      if (!["Seller", "Admin", "Courier"].includes(auth.role)) {
        setError("Acesso exclusivo para lojistas e entregadores.");
        registerAttempt(false);
        return;
      }
      saveAuth(auth);
      registerAttempt(true);
      const saved = getAuth();
      navigate(saved?.role === "Courier" && !saved?.storeId ? "/entregas" : "/");
    } catch (err) {
      registerAttempt(false);
      setError(err instanceof Error ? err.message : "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav onScrollToLogin={scrollToLogin} />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-16 text-center"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #0d2818 55%, #14532d 100%)" }}
      >
        {/* Decoração de fundo */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(22,163,74,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5"
          style={{
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, #16a34a 0%, transparent 70%)",
          }}
        />

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#16a34a]/40 bg-[#16a34a]/10 px-4 py-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />
          <span className="text-xs font-semibold text-[#4ade80]">Sistema operacional BrasUX</span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
          Gerencie sua loja.{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #4ade80, #16a34a)" }}
          >
            Entregue mais.
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-base text-white/60 sm:text-lg">
          Painel completo para lojistas e entregadores do BrasUX. Pedidos em tempo real,
          gestão de produtos e logística integrada — tudo em um só lugar.
        </p>

        {/* CTAs */}
        <div className="mb-14 flex flex-wrap justify-center gap-3">
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 20px rgba(22,163,74,0.45)" }}
          >
            Criar conta grátis <ArrowRight size={16} />
          </Link>
          <button
            onClick={scrollToLogin}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/15 active:scale-95"
          >
            Já tenho conta <ChevronDown size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-[#0f172a]/60 px-6 py-5 backdrop-blur-sm">
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="mt-0.5 text-xs text-white/50">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 transition-colors hover:text-white/60"
          aria-label="Rolar para baixo"
        >
          <ChevronDown size={28} className="animate-bounce" />
        </button>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="bg-[#f8fafc] px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#16a34a]">Recursos</p>
            <h2 className="text-2xl font-black text-[#0f172a] sm:text-3xl">
              Tudo que sua loja precisa
            </h2>
            <p className="mt-3 text-[#64748b]">
              Uma plataforma completa, do pedido à entrega.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#e2e8f0] bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `${f.color}15` }}
                >
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="mb-2 text-sm font-black text-[#0f172a]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748b]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS PREVIEW ────────────────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#16a34a]">Planos</p>
            <h2 className="text-2xl font-black text-[#0f172a] sm:text-3xl">
              Comece grátis. Escale quando quiser.
            </h2>
            <p className="mt-3 text-[#64748b]">
              Sem taxas escondidas. Cancele quando quiser.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS_PREVIEW.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl border p-6 transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: plan.highlight ? "#16a34a" : "#e2e8f0",
                  background: plan.highlight
                    ? "linear-gradient(160deg, #f0fdf4, #dcfce7)"
                    : "white",
                  boxShadow: plan.highlight ? "0 4px 24px rgba(22,163,74,0.15)" : "none",
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black text-white"
                    style={{
                      background: plan.highlight
                        ? "linear-gradient(135deg, #16a34a, #15803d)"
                        : "#0f172a",
                    }}
                  >
                    {plan.badge}
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">
                    {plan.name}
                  </p>
                  <div className="mt-1 flex items-end gap-1">
                    <span className="text-2xl font-black text-[#0f172a]">{plan.price}</span>
                    {plan.period && (
                      <span className="mb-0.5 text-sm text-[#94a3b8]">{plan.period}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#475569]">
                      <Check size={14} className="shrink-0 text-[#16a34a]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/planos"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#16a34a] hover:underline"
            >
              Ver comparativo completo de planos <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── LOGIN FORM ────────────────────────────────────────────────────── */}
      <section
        id="login"
        ref={loginRef}
        className="px-5 py-20"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #0d2818 60%, #14532d 100%)" }}
      >
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 24px rgba(22,163,74,0.4)" }}
            >
              <img src="/logo-brasux.webp" alt="BrasUX" className="h-9 w-9 object-contain" />
            </div>
            <h2 className="text-xl font-black text-white">Acessar Central Operacional</h2>
            <p className="mt-1 text-sm text-white/50">Entre com sua conta de lojista ou entregador</p>
          </div>

          <div
            className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm"
            style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}
          >
            {blocked ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-900/30">
                  <Lock size={28} className="text-red-400" />
                </div>
                <div>
                  <p className="font-black text-white">Conta temporariamente bloqueada</p>
                  <p className="mt-2 text-sm text-white/50">
                    Muitas tentativas falhadas. Aguarde{" "}
                    <span className="font-black text-red-400">{remainingMin} min</span>.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-white/50">
                    E-mail
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-[#16a34a]/60 focus:bg-white/15 focus:ring-2 focus:ring-[#16a34a]/25 transition-all"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-white/50">
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
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 pr-11 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-[#16a34a]/60 focus:bg-white/15 focus:ring-2 focus:ring-[#16a34a]/25 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    boxShadow: "0 4px 16px rgba(22,163,74,0.4)",
                  }}
                >
                  {loading ? "Entrando…" : "Entrar"}
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-white/40">
            Não tem conta?{" "}
            <Link to="/cadastro" className="font-bold text-[#4ade80] hover:underline">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#0a0f1a] px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              <img src="/logo-brasux.webp" alt="BrasUX" className="h-4 w-4 object-contain" />
            </div>
            <span className="text-sm font-black text-white/70">BrasUX Loja</span>
          </div>
          <div className="flex flex-wrap justify-center gap-5 text-xs text-white/30 sm:justify-end">
            <Link to="/planos" className="hover:text-white/60 transition-colors">Planos</Link>
            <Link to="/cadastro" className="hover:text-white/60 transition-colors">Criar conta</Link>
            <span>© 2025 BrasUX. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
