import { supabase } from "../lib/supabase";

// ── Tipos canônicos (alinhados com billing_plans v2) ─────────────────────────

export type VendorPlanSlug = "basico" | "premium" | "whitelabel";

export interface VendorSubscription {
  subscriptionId:  string;
  planSlug:        VendorPlanSlug;
  planName:        string;
  status:          "trialing" | "active" | "past_due" | "cancelled" | "incomplete";
  monthlyPrice:    number;
  currentPeriodEnd: string | null;
  trialEnd:        string | null;
  features: {
    realtime_tracking:  boolean;
    chat:               boolean;
    analytics:          "basic" | "full";
    api_access:         boolean;
    support:            "email" | "priority" | "dedicated";
    priority_dispatch:  boolean;
    custom_reports?:    boolean;
  };
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

type RpcStrResult     = { data: string | null; error: { message: string } | null };
type BalanceResult    = { data: { available: number; total: number; held: number } | null; error: { message: string } | null };
type JsonResult       = { data: Record<string, unknown> | null; error: { message: string } | null };

// ── Carteira do lojista ───────────────────────────────────────────────────────

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

// ── Assinatura do lojista — usa RPC canônica (aceita auth.uid()) ──────────────

export async function getVendorSubscription(): Promise<VendorSubscription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<JsonResult>
  )("get_vendor_subscription_by_owner", { p_owner_id: user.id });

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    subscriptionId:   String(data.subscription_id),
    planSlug:         data.plan_slug as VendorPlanSlug,
    planName:         String(data.plan_name),
    status:           data.status as VendorSubscription["status"],
    monthlyPrice:     Number(data.monthly_price),
    currentPeriodEnd: data.current_period_end ? String(data.current_period_end) : null,
    trialEnd:         data.trial_end ? String(data.trial_end) : null,
    features:         (data.features ?? {}) as VendorSubscription["features"],
  };
}

// ── Carteira do entregador ───────────────────────────────────────────────────

export async function getCourierWallet(): Promise<VendorWallet> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: walletId, error: walletErr } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcStrResult>
  )("get_or_create_wallet", { p_owner_id: user.id, p_wallet_type: "courier" });

  if (walletErr || !walletId) throw new Error(walletErr?.message ?? "Carteira não encontrada.");

  const { data: balance } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<BalanceResult>
  )("get_wallet_balance", { p_wallet_id: walletId });

  type TxRow = { id: string; type: string; amount: number; direction: string; description: string; order_id: string | null; status: string; created_at: string };
  const { data: txs } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount, direction, description, order_id, status, created_at")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(30) as unknown as { data: TxRow[] | null };

  return {
    id:          walletId,
    balance:     Number(balance?.available ?? 0),
    totalEarned: Number(balance?.total ?? 0),
    held:        Number(balance?.held ?? 0),
    transactions: (txs ?? []).map(t => ({
      id: t.id, type: t.type, amount: Number(t.amount),
      direction: t.direction as "in" | "out", description: t.description ?? "",
      orderId: t.order_id, status: t.status, createdAt: t.created_at,
    })),
  };
}

// ── Solicitação de saque — entregador ─────────────────────────────────────────

export async function requestCourierWithdrawal(amount: number, pixKey: string, pixKeyType: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: walletId, error: walletErr } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcStrResult>
  )("get_or_create_wallet", { p_owner_id: user.id, p_wallet_type: "courier" });

  if (walletErr || !walletId) throw new Error("Carteira não encontrada.");

  type VoidResult = { error: { message: string } | null };
  const { error } = await (
    supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<VoidResult>
  )("request_withdrawal", {
    p_wallet_id:    walletId,
    p_owner_id:     user.id,
    p_owner_type:   "courier",
    p_amount:       amount,
    p_pix_key:      pixKey,
    p_pix_key_type: pixKeyType,
  });

  if (error) throw new Error(error.message);
}

// ── Solicitação de saque — lojista ───────────────────────────────────────────

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
