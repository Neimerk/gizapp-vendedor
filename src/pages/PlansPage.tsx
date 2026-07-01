import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Check, X, ArrowRight, ChevronDown, ChevronUp,
  Package, Star, Store, BarChart3, Zap,
  Headphones, Globe, Shield, Code2, Users,
} from "lucide-react";

// ── Dados ───────────────────────────────────────────────────────────────────

type Plan = {
  id: "free" | "basic" | "premium" | "white";
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  highlight: boolean;
  cta: string;
  ctaHref: string;
  ctaStyle: "primary" | "secondary" | "outline" | "dark";
  color: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "R$0",
    period: "/mês",
    description: "Para quem está começando e quer testar a plataforma sem compromisso.",
    highlight: false,
    cta: "Começar grátis",
    ctaHref: "/cadastro",
    ctaStyle: "outline",
    color: "#64748b",
    features: [
      "50 produtos ativos",
      "3 destaques no Shopping",
      "3 categorias de loja",
      "1 loja",
      "Dashboard básico",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Suporte via comunidade",
    ],
  },
  {
    id: "basic",
    name: "Básico",
    price: "R$49",
    period: "/mês",
    description: "Para lojistas que já vendem e precisam de mais espaço e visibilidade.",
    highlight: false,
    cta: "Assinar Básico",
    ctaHref: "/cadastro?plano=basic",
    ctaStyle: "secondary",
    color: "#16a34a",
    features: [
      "300 produtos ativos",
      "15 destaques no Shopping",
      "15 categorias de loja",
      "Até 3 lojas por CPF/CNPJ",
      "Dashboard completo",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios básicos",
      "Suporte via e-mail",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$99",
    period: "/mês",
    description: "Para quem quer crescer com analytics avançados, múltiplas lojas e acesso à API.",
    badge: "Mais popular",
    highlight: true,
    cta: "Assinar Premium",
    ctaHref: "/cadastro?plano=premium",
    ctaStyle: "primary",
    color: "#16a34a",
    features: [
      "1.000 produtos ativos",
      "30 destaques no Shopping",
      "Categorias ilimitadas",
      "Até 10 lojas por CPF/CNPJ",
      "Dashboard premium + insights",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios avançados com IA",
      "Acesso à API REST",
      "Suporte prioritário",
    ],
  },
  {
    id: "white",
    name: "White Label",
    price: "Consulte",
    period: "",
    description: "Solução enterprise com sua marca, domínio próprio e SLA garantido para grandes operações.",
    badge: "Enterprise",
    highlight: false,
    cta: "Falar com equipe",
    ctaHref: "https://wa.me/5548984470474?text=Quero+saber+mais+sobre+o+White+Label",
    ctaStyle: "dark",
    color: "#0f172a",
    features: [
      "Produtos ilimitados",
      "Destaques ilimitados",
      "Categorias ilimitadas",
      "Lojas ilimitadas",
      "Dashboard customizado",
      "Pedidos ilimitados",
      "Gestão de entregas",
      "WebSocket tempo real",
      "Relatórios + BI integrado",
      "API REST + Webhooks",
      "Suporte dedicado 24/7",
      "Marca e logo próprios",
      "Domínio personalizado",
      "SLA 99,9% garantido",
      "Integração ERP/SAP",
      "Gerente de conta",
    ],
  },
];

// ── Tabela de comparativo ────────────────────────────────────────────────────

type CompareRow = {
  icon?: React.ElementType;
  category?: string;
  label: string;
  free: string | boolean;
  basic: string | boolean;
  premium: string | boolean;
  white: string | boolean;
};

const COMPARE: CompareRow[] = [
  { icon: Package, category: "Catálogo", label: "Produtos ativos", free: "50", basic: "300", premium: "1.000", white: "Ilimitado" },
  { label: "Categorias de loja", free: "3", basic: "15", premium: "Ilimitadas", white: "Ilimitadas" },
  { icon: Star, category: "Vitrine", label: "Destaques no Shopping", free: "3", basic: "15", premium: "30", white: "Ilimitados" },
  { icon: Store, category: "Lojas", label: "Lojas por CPF/CNPJ", free: "1", basic: "Até 3", premium: "Até 10", white: "Ilimitadas" },
  { icon: BarChart3, category: "Analytics", label: "Dashboard de KPIs", free: "Básico", basic: "Completo", premium: "Premium", white: "Customizado" },
  { label: "Relatórios", free: false, basic: "Básico", premium: "Avançado + IA", white: "BI integrado" },
  { icon: Zap, category: "Pedidos", label: "Pedidos por mês", free: "Ilimitados", basic: "Ilimitados", premium: "Ilimitados", white: "Ilimitados" },
  { label: "WebSocket tempo real", free: true, basic: true, premium: true, white: true },
  { label: "Gestão de entregas", free: true, basic: true, premium: true, white: true },
  { icon: Code2, category: "API", label: "Acesso à API REST", free: false, basic: false, premium: true, white: true },
  { label: "Webhooks", free: false, basic: false, premium: false, white: true },
  { label: "Integração ERP/SAP", free: false, basic: false, premium: false, white: true },
  { icon: Globe, category: "Marca", label: "Domínio personalizado", free: false, basic: false, premium: false, white: true },
  { label: "Logo e marca próprios", free: false, basic: false, premium: false, white: true },
  { icon: Shield, category: "SLA", label: "Uptime garantido (SLA)", free: false, basic: false, premium: false, white: "99,9%" },
  { icon: Headphones, category: "Suporte", label: "Canal de suporte", free: "Comunidade", basic: "E-mail", premium: "Prioritário", white: "Dedicado 24/7" },
  { icon: Users, category: "Conta", label: "Gerente de conta", free: false, basic: false, premium: false, white: true },
];

// ── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: "Posso mudar de plano depois?",
    a: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. O valor é calculado proporcionalmente ao tempo de uso.",
  },
  {
    q: "O plano Free tem alguma limitação de tempo?",
    a: "Não. O plano Free é permanente — você pode usar indefinidamente dentro dos limites do plano (30 produtos, 3 destaques, 3 categorias).",
  },
  {
    q: "O que são os 'destaques no Shopping'?",
    a: "Destaques são produtos que aparecem em posição privilegiada no BrasUX Shopping (o marketplace). Quanto mais destaques, maior a visibilidade dos seus produtos para os clientes.",
  },
  {
    q: "Como funciona o White Label?",
    a: "O White Label é uma solução enterprise totalmente customizada: você usa a plataforma BrasUX com sua própria marca, domínio e identidade visual. Entre em contato com nossa equipe para um orçamento personalizado.",
  },
  {
    q: "O pagamento é recorrente?",
    a: "Sim, os planos Básico e Premium são cobrados mensalmente. Você pode cancelar a qualquer momento sem taxa de cancelamento.",
  },
];

// ── Componente Nav ────────────────────────────────────────────────────────────

function Nav() {
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
        <Link to="/login" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            <img src="/logo-brasux.webp" alt="BrasUX" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <span className={`text-sm font-black ${scrolled ? "text-[#0f172a]" : "text-white"}`}>BrasUX</span>
            <span className={`ml-1 text-sm font-medium ${scrolled ? "text-[#64748b]" : "text-white/70"}`}>Loja</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={`hidden px-4 py-2 text-sm font-semibold transition-colors sm:block ${
              scrolled ? "text-[#475569] hover:text-[#0f172a]" : "text-white/80 hover:text-white"
            }`}
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 2px 12px rgba(22,163,74,0.4)" }}
          >
            Criar conta
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Célula do comparativo ────────────────────────────────────────────────────

function Cell({ value }: { value: string | boolean }) {
  if (value === false) return <X size={16} className="mx-auto text-[#cbd5e1]" />;
  if (value === true) return <Check size={16} className="mx-auto text-[#16a34a]" />;
  return <span className="text-xs font-semibold text-[#475569]">{value}</span>;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function PlansPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function ctaBtnStyle(style: Plan["ctaStyle"]) {
    switch (style) {
      case "primary":
        return {
          background: "linear-gradient(135deg, #16a34a, #15803d)",
          color: "white",
          boxShadow: "0 4px 16px rgba(22,163,74,0.4)",
          border: "none",
        };
      case "secondary":
        return {
          background: "transparent",
          color: "#16a34a",
          border: "2px solid #16a34a",
        };
      case "dark":
        return {
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "white",
          border: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        };
      default:
        return {
          background: "transparent",
          color: "#475569",
          border: "2px solid #e2e8f0",
        };
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="px-5 pb-20 pt-32 text-center"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #0d2818 60%, #14532d 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-20"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, #16a34a, transparent)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#16a34a]/40 bg-[#16a34a]/10 px-4 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
            <span className="text-xs font-semibold text-[#4ade80]">Sem contrato de fidelidade</span>
          </div>
          <h1 className="mb-4 text-4xl font-black text-white sm:text-5xl">
            Planos para cada fase{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #4ade80, #16a34a)" }}
            >
              do seu negócio
            </span>
          </h1>
          <p className="mx-auto max-w-lg text-base text-white/60">
            Comece grátis e faça upgrade conforme crescer. Todos os planos incluem pedidos
            ilimitados, WebSocket em tempo real e gestão de entregas.
          </p>
        </div>
      </section>

      {/* ── CARDS DE PLANOS ───────────────────────────────────────────────── */}
      <section className="relative px-5 pb-20 pt-12">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "linear-gradient(to bottom, #0d2818, white)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-3xl border p-7 transition-all hover:-translate-y-1"
                style={{
                  borderColor: plan.highlight ? "#16a34a" : "#e2e8f0",
                  background: plan.highlight
                    ? "linear-gradient(160deg, #f0fdf4, #dcfce7)"
                    : plan.id === "white"
                    ? "linear-gradient(160deg, #0f172a, #1e293b)"
                    : "white",
                  boxShadow: plan.highlight
                    ? "0 8px 40px rgba(22,163,74,0.2)"
                    : plan.id === "white"
                    ? "0 8px 40px rgba(0,0,0,0.3)"
                    : "0 2px 16px rgba(0,0,0,0.05)",
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-[11px] font-black text-white"
                    style={{
                      background: plan.highlight
                        ? "linear-gradient(135deg, #16a34a, #15803d)"
                        : "linear-gradient(135deg, #0f172a, #1e293b)",
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Cabeçalho */}
                <div className="mb-6">
                  <p
                    className="mb-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ color: plan.id === "white" ? "rgba(255,255,255,0.4)" : "#94a3b8" }}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span
                      className="text-3xl font-black"
                      style={{ color: plan.id === "white" ? "white" : "#0f172a" }}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span
                        className="mb-1 text-sm"
                        style={{ color: plan.id === "white" ? "rgba(255,255,255,0.4)" : "#94a3b8" }}
                      >
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-3 text-xs leading-relaxed"
                    style={{ color: plan.id === "white" ? "rgba(255,255,255,0.5)" : "#64748b" }}
                  >
                    {plan.description}
                  </p>
                </div>

                {/* CTA */}
                {plan.id === "white" ? (
                  <a
                    href={plan.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-6 block w-full rounded-xl py-3 text-center text-sm font-black transition-all active:scale-95"
                    style={ctaBtnStyle(plan.ctaStyle)}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    to={plan.ctaHref}
                    className="mb-6 block w-full rounded-xl py-3 text-center text-sm font-black transition-all active:scale-95"
                    style={ctaBtnStyle(plan.ctaStyle)}
                  >
                    {plan.cta}
                  </Link>
                )}

                {/* Features */}
                <ul className="mt-auto space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: plan.id === "white" ? "#4ade80" : "#16a34a" }}
                      />
                      <span style={{ color: plan.id === "white" ? "rgba(255,255,255,0.7)" : "#475569" }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARATIVO DETALHADO ─────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#16a34a]">Comparativo</p>
            <h2 className="text-2xl font-black text-[#0f172a] sm:text-3xl">
              Compare todos os recursos
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0]">
                  <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#94a3b8]">
                    Recurso
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-4 text-center text-xs font-black"
                      style={{
                        color: p.highlight ? "#16a34a" : p.id === "white" ? "#0f172a" : "#64748b",
                      }}
                    >
                      {p.name}
                      {p.badge && (
                        <span
                          className="ml-1.5 rounded-full px-2 py-0.5 text-[9px] font-black text-white"
                          style={{
                            background: p.highlight ? "#16a34a" : "#0f172a",
                          }}
                        >
                          {p.badge}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc] ${
                      row.category ? "border-t-2 border-t-[#e2e8f0]" : ""
                    }`}
                  >
                    <td className="px-6 py-3">
                      {row.category && (
                        <div className="mb-1 flex items-center gap-1.5">
                          {row.icon && <row.icon size={12} className="text-[#94a3b8]" />}
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">
                            {row.category}
                          </span>
                        </div>
                      )}
                      <span className="font-medium text-[#0f172a]">{row.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center"><Cell value={row.free} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.basic} /></td>
                    <td className="px-4 py-3 text-center bg-[#f0fdf4]/50"><Cell value={row.premium} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.white} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#16a34a]">Dúvidas</p>
            <h2 className="text-2xl font-black text-[#0f172a] sm:text-3xl">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#f8fafc]"
                >
                  <span className="font-semibold text-[#0f172a]">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp size={18} className="shrink-0 text-[#16a34a]" />
                  ) : (
                    <ChevronDown size={18} className="shrink-0 text-[#94a3b8]" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#f1f5f9] px-6 py-4">
                    <p className="text-sm leading-relaxed text-[#64748b]">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section
        className="px-5 py-24 text-center"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #0d2818 60%, #14532d 100%)" }}
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#16a34a]/40 bg-[#16a34a]/10 px-4 py-1.5">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />
            <span className="text-xs font-semibold text-[#4ade80]">Grátis para sempre no plano Free</span>
          </div>
          <h2 className="mb-4 text-3xl font-black text-white sm:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mb-8 text-white/60">
            Crie sua conta em menos de 2 minutos. Sem cartão de crédito necessário.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: "0 4px 20px rgba(22,163,74,0.45)",
              }}
            >
              Criar conta grátis <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/15 active:scale-95"
            >
              Já tenho conta
            </Link>
          </div>
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
            <Link to="/login" className="hover:text-white/60 transition-colors">Login</Link>
            <Link to="/cadastro" className="hover:text-white/60 transition-colors">Criar conta</Link>
            <span>© 2025 BrasUX. Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
