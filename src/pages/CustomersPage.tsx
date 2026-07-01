import { useEffect, useState } from "react";
import { Users, Search, ChevronDown, ChevronUp, Loader2, Phone, Mail, ShoppingBag, TrendingUp } from "lucide-react";
import { getCustomers, getCustomerOrders, type Customer } from "../services/gizApi";

const STATUS_LABEL: Record<number, string> = { 0:"Pendente",1:"Aceito",2:"Preparando",3:"Em entrega",4:"Entregue",5:"Cancelado" };
function formatBRL(v: number) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }

type HistoryOrder = { id: string; total: number; status: number; payment_method: string; created_at: string };

export default function CustomersPage() {
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [filtered,     setFiltered]     = useState<Customer[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [history,      setHistory]      = useState<Record<string, HistoryOrder[]>>({});
  const [histLoading,  setHistLoading]  = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try { const data = await getCustomers(); setCustomers(data); setFiltered(data); }
      catch (e) { setError(e instanceof Error ? e.message : "Erro."); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    ));
  }, [search, customers]);

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!history[id]) {
      setHistLoading(id);
      try {
        const orders = await getCustomerOrders(id) as HistoryOrder[];
        setHistory(h => ({ ...h, [id]: orders }));
      } catch { /* ignore */ }
      finally { setHistLoading(null); }
    }
  }

  // Métricas do topo
  const totalRevenue  = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgTicket     = customers.length ? totalRevenue / customers.reduce((s, c) => s + c.orderCount, 0) : 0;
  const recurrent     = customers.filter(c => c.orderCount > 1).length;

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#16a34a]">Relacionamento</p>
        <h1 className="mt-1 text-2xl font-black text-[#0f172a]">Clientes</h1>
        <p className="mt-0.5 text-sm text-[#94a3b8]">Histórico e perfil de quem compra na sua loja</p>
      </div>

      {/* Métricas */}
      {customers.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Total de clientes", value: customers.length, icon: Users, color: "#8b5cf6", bg: "#f5f3ff" },
            { label: "Receita total", value: formatBRL(totalRevenue), icon: TrendingUp, color: "#16a34a", bg: "#f0fdf4" },
            { label: "Clientes recorrentes", value: recurrent, icon: ShoppingBag, color: "#f59e0b", bg: "#fffbeb" },
          ].map(m => (
            <div key={m.label} className="rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: m.bg }}>
                  <m.icon size={14} style={{ color: m.color }} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{m.label}</p>
              </div>
              <p className="text-xl font-black text-[#0f172a]">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou email…"
          className="w-full rounded-2xl border border-[#e2e8f0] bg-white py-3 pl-10 pr-4 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#16a34a]" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Users size={40} className="text-[#cbd5e1]" />
          <p className="font-black text-[#94a3b8]">{search ? "Nenhum cliente encontrado" : "Ainda não há clientes"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-3xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
              {/* Linha principal */}
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#f8fafc] transition-colors"
                onClick={() => toggleExpand(c.id)}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f0fdf4] text-base font-black text-[#16a34a]">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#0f172a] truncate">{c.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-[#94a3b8]"><Phone size={10} />{c.phone}</span>
                    {c.email && <span className="flex items-center gap-1 text-xs text-[#94a3b8] truncate"><Mail size={10} />{c.email}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-[#0f172a]">{formatBRL(c.totalSpent)}</p>
                  <p className="text-xs text-[#94a3b8]">{c.orderCount} pedido{c.orderCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="ml-1 text-[#94a3b8]">
                  {expanded === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Histórico expandido */}
              {expanded === c.id && (
                <div className="border-t border-[#f8fafc] px-5 pb-4 pt-3">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    Últimos pedidos · ticket médio {formatBRL(avgTicket)}
                  </p>
                  {histLoading === c.id ? (
                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#16a34a]" /></div>
                  ) : !history[c.id]?.length ? (
                    <p className="text-sm text-[#94a3b8]">Sem pedidos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {history[c.id].map(o => (
                        <div key={o.id} className="flex items-center justify-between rounded-2xl bg-[#f8fafc] px-4 py-2.5">
                          <div>
                            <p className="text-xs font-black text-[#0f172a]">{STATUS_LABEL[o.status] ?? "—"}</p>
                            <p className="text-[10px] text-[#94a3b8]">{formatDate(o.created_at)} · {o.payment_method}</p>
                          </div>
                          <p className="font-black text-[#0f172a]">{formatBRL(o.total)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-[10px] text-[#cbd5e1]">Último pedido: {formatDate(c.lastOrderAt)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
