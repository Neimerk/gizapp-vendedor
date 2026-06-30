import { supabase } from "../lib/supabase";

export type VendorPlan = "free" | "start" | "pro" | "whitelabel";

export interface VendorSubscription {
  plan:             VendorPlan;
  status:           "trial" | "active" | "overdue" | "suspended" | "cancelled";
  monthlyPrice:     number;
  commissionRate:   number;
  nextBillingDate:  string | null;
}

export interface VendorTransaction {
  id:          string;
  type:        string;
  amount:      number;
  direction:   "in" | "out";
  description: string;
  orderId:     string | null;
  status:      string;
  createdAt:   string;
}

export interface VendorWallet {
  id:           string;
  balance:      number;
  totalEarned:  number;
  held:         number;
  transactions: VendorTransaction[];
}

type RpcStrResult = { data: string | null; error: { message: string } | null };
type BalanceResult = { data: { available: number; total: number; held: number } | null; error: { message: string } | null };

export async function getVendorWallet(): Promise<VendorWallet> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: walletId, error: walletErr } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcStrResult>
  )("get_or_create_wallet", { p_owner_id: user.id, p_wallet_type: "vendor" });

  if (walletErr || !walletId) {
    throw new Error(walletErr?.message ?? "Carteira não encontrada.");
  }

  const { data: balance } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<BalanceResult>
  )("get_wallet_balance", { p_wallet_id: walletId });

  type TxRow = { id: string; type: string; amount: number; direction: string; description: string; order_id: string | null; status: string; created_at: string };
  const { data: txs } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount, direction, description, order_id, status, created_at")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(50) as unknown as { data: TxRow[] | null };

  const transactions: VendorTransaction[] = (txs ?? []).map(t => ({
    id:          t.id,
    type:        t.type,
    amount:      Number(t.amount),
    direction:   t.direction as "in" | "out",
    description: t.description ?? "",
    orderId:     t.order_id,
    status:      t.status,
    createdAt:   t.created_at,
  }));

  return {
    id:          walletId,
    balance:     Number(balance?.available ?? 0),
    totalEarned: Number(balance?.total ?? 0),
    held:        Number(balance?.held ?? 0),
    transactions,
  };
}

export async function getVendorSubscription(): Promise<VendorSubscription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  type SubRow = { plan: string; status: string; monthly_price: number; commission_rate: number; next_billing_date: string | null };
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, monthly_price, commission_rate, next_billing_date")
    .eq("vendor_id", user.id)
    .maybeSingle() as unknown as { data: SubRow | null };

  if (!data) return null;
  return {
    plan:            data.plan as VendorPlan,
    status:          data.status as VendorSubscription["status"],
    monthlyPrice:    Number(data.monthly_price),
    commissionRate:  Number(data.commission_rate),
    nextBillingDate: data.next_billing_date,
  };
}

export async function requestVendorWithdrawal(amount: number, pixKey: string, pixKeyType: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: walletId, error: walletErr } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcStrResult>
  )("get_or_create_wallet", { p_owner_id: user.id, p_wallet_type: "vendor" });

  if (walletErr || !walletId) throw new Error("Carteira não encontrada.");

  type VoidResult = { error: { message: string } | null };
  const { error } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<VoidResult>
  )("request_withdrawal", {
    p_wallet_id:    walletId,
    p_owner_id:     user.id,
    p_owner_type:   "vendor",
    p_amount:       amount,
    p_pix_key:      pixKey,
    p_pix_key_type: pixKeyType,
  });

  if (error) throw new Error(error.message);
}
