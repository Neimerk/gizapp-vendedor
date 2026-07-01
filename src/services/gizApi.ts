import { getAuth, getAuthToken, isTokenExpired, logout, updateAuthSupabaseId } from "./auth";
import { supabase } from "../lib/supabase";

export const GIZ_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5003";

export const IMAGE_WORKER_URL = "https://brasux-images.brasux-account.workers.dev";

const IMAGE_BASE_URL: string =
  import.meta.env.VITE_IMAGE_BASE_URL || IMAGE_WORKER_URL;

// Lança em vez de usar fallback — evita cross-tenant leak via DEFAULT_STORE_ID
export function getSellerStoreId(): string {
  const storeId = getAuth()?.storeId;
  if (!storeId) throw new Error("Nenhuma loja associada a este usuário.");
  return storeId;
}

// ── Cache multi-tenant seguro ────────────────────────────────────────────────
// Chaveado por storeId — evita leak entre tenants ao trocar de usuário no mesmo tab

class ProductsCache {
  private readonly entries = new Map<string, { data: StoreProduct[]; ts: number }>();
  private readonly TTL = 60_000;

  get(storeId: string): StoreProduct[] | null {
    const e = this.entries.get(storeId);
    if (!e || Date.now() - e.ts > this.TTL) { this.entries.delete(storeId); return null; }
    return e.data;
  }

  set(storeId: string, data: StoreProduct[]): void {
    this.entries.set(storeId, { data, ts: Date.now() });
  }

  invalidate(storeId?: string): void {
    if (storeId) this.entries.delete(storeId);
    else this.entries.clear();
  }
}

const _cache = new ProductsCache();

export function invalidateProductsCache(storeId?: string): void {
  _cache.invalidate(storeId);
}

// Limpa todos os caches ao fazer logout (evita cross-tenant leak)
export function clearAllCaches(): void {
  _cache.invalidate();
}

// ── HTTP autenticado ─────────────────────────────────────────────────────────

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();

  if (!token || isTokenExpired()) {
    logout();
    window.location.href = "/login";
    return new Response(null, { status: 401 });
  }

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    logout();
    window.location.href = "/login";
  }
  return response;
}

/* =========================
   STORE
========================= */

export type Store = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryFee: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  rating: number;
  isOpen: boolean;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

// Somente campos que o lojista pode alterar — evita mass assignment
export type UpdateStorePayload = Pick<
  Store,
  | "name" | "category" | "description" | "logoUrl" | "bannerUrl"
  | "phone" | "whatsapp" | "email" | "address" | "number" | "complement"
  | "neighborhood" | "city" | "state" | "zipCode"
  | "deliveryFee" | "deliveryTimeMin" | "deliveryTimeMax" | "isOpen"
>;

/* =========================
   STORE PRODUCT
========================= */

export type StoreProduct = {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  price: number;
  promotionalPrice?: number | null;
  stock: number;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

/* =========================
   AUTH API
========================= */

export type LoginPayload = {
  email: string;
  password: string;
};

export async function loginSeller(payload: LoginPayload) {
  const response = await fetch(`${GIZ_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Email ou senha inválidos.");
  }
  const data = await response.json();
  // Sign into Supabase para wallet/subscription (funciona para usuários criados após fix de 2026-07-01)
  supabase.auth.signInWithPassword({ email: payload.email, password: payload.password })
    .then(({ data: sbData }) => {
      if (sbData.user) updateAuthSupabaseId(sbData.user.id);
    })
    .catch(() => null);
  return data;
}

export type RegisterStorePayload = {
  name: string;
  email: string;
  password: string;
  storeName: string;
  document: string;
  category?: string;
};

export async function registerStore(payload: RegisterStorePayload) {
  const response = await fetch(`${GIZ_API_URL}/api/auth/register-store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Erro ao criar conta. Verifique os dados e tente novamente.");
  }
  return response.json();
}

/* =========================
   STORES API
========================= */

export async function getStoreById(storeId: string): Promise<Store> {
  const response = await authFetch(`${GIZ_API_URL}/api/stores/${storeId}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erro ao buscar loja");
  return response.json();
}

export async function updateStore(id: string, data: UpdateStorePayload): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Erro ao atualizar loja (${response.status})`);
  }
}

/* =========================
   STORE HOURS
========================= */

export type StoreHour = {
  day:       number;
  label:     string;
  isOpen:    boolean;
  openTime:  string;
  closeTime: string;
};

export async function getStoreHours(storeId: string): Promise<StoreHour[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/stores/${storeId}/hours`);
  if (!res.ok) throw new Error("Erro ao buscar horários.");
  return res.json();
}

export async function updateStoreHours(storeId: string, hours: StoreHour[]): Promise<StoreHour[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/stores/${storeId}/hours`, {
    method: "PUT",
    body: JSON.stringify({ hours }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Erro ao salvar horários.");
  }
  return res.json();
}

/* =========================
   STORE PRODUCTS API
========================= */

export async function getStoreProducts(
  storeId: string = getSellerStoreId(),
  fresh = false,
): Promise<StoreProduct[]> {
  if (!fresh) {
    const cached = _cache.get(storeId);
    if (cached) return cached;
  }
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${storeId}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erro ao buscar produtos da loja");
  const data: StoreProduct[] = await response.json();
  _cache.set(storeId, data);
  return data;
}

export async function updateStoreProduct(
  id: string,
  data: {
    price: number;
    promotionalPrice?: number | null;
    stock: number;
    available: boolean;
    imageAlt?: string;
    category?: string;
  }
): Promise<StoreProduct> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Erro ao atualizar produto");
  return response.json();
}

/* =========================
   ORDERS
========================= */

export type OrderItem = {
  id: string;
  orderId: string;
  storeProductId: string;
  productName: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  storeId: string;
  storeName?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement: string;
  deliveryNeighborhood: string;
  paymentMethod: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  serviceFee: number;
  paymentStatus: string;
  asaasChargeId: string | null;
  status: number;
  courierId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export async function getOrders(): Promise<Order[]> {
  const auth = getAuth();
  const url =
    auth?.role === "Admin"
      ? `${GIZ_API_URL}/api/orders/admin`
      : `${GIZ_API_URL}/api/orders/store/${getSellerStoreId()}`;
  const response = await authFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao buscar pedidos");
  return response.json();
}

/* =========================
   CUPONS
========================= */

export type Coupon = {
  id: string;
  storeId: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxUses: number | null;
  usesCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
};

export async function getCoupons(): Promise<Coupon[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/coupons`);
  if (!res.ok) throw new Error("Erro ao buscar cupons.");
  return res.json();
}

export async function createCoupon(data: {
  code: string; description?: string;
  discountType: "percent" | "fixed"; discountValue: number;
  minOrderValue?: number; maxUses?: number;
  validFrom?: string; validUntil?: string;
}): Promise<Coupon> {
  const res = await authFetch(`${GIZ_API_URL}/api/coupons`, {
    method: "POST", body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Erro ao criar cupom.");
  }
  return res.json();
}

export async function toggleCoupon(id: string, active: boolean): Promise<Coupon> {
  const res = await authFetch(`${GIZ_API_URL}/api/coupons/${id}`, {
    method: "PATCH", body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error("Erro ao atualizar cupom.");
  return res.json();
}

export async function deleteCoupon(id: string): Promise<void> {
  const res = await authFetch(`${GIZ_API_URL}/api/coupons/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir cupom.");
}

/* =========================
   CLIENTES
========================= */

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

export async function getCustomers(): Promise<Customer[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/customers`);
  if (!res.ok) throw new Error("Erro ao buscar clientes.");
  return res.json();
}

export async function getCustomerOrders(customerId: string): Promise<unknown[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/customers/${customerId}/orders`);
  if (!res.ok) throw new Error("Erro ao buscar pedidos do cliente.");
  return res.json();
}

/* =========================
   DELIVERIES
========================= */

export async function getAvailableDeliveries(): Promise<Order[]> {
  const response = await authFetch(`${GIZ_API_URL}/api/orders/courier/available`, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao buscar entregas disponíveis");
  return response.json();
}

export async function getMyCourierOrders(): Promise<Order[]> {
  const response = await authFetch(`${GIZ_API_URL}/api/orders/courier/mine`, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao buscar minhas entregas");
  return response.json();
}

export async function acceptDelivery(orderId: string): Promise<Order> {
  const response = await authFetch(`${GIZ_API_URL}/api/orders/${orderId}/courier/accept`, { method: "POST" });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || "Erro ao aceitar entrega");
  }
  return response.json();
}

export async function updateOrderStatus(id: string, status: number) {
  const response = await authFetch(`${GIZ_API_URL}/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Erro ao atualizar pedido");
  return response.json();
}

export async function confirmCashPayment(id: string): Promise<Order> {
  const res = await authFetch(`${GIZ_API_URL}/api/orders/${id}/confirm-cash`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Erro ao confirmar pagamento.");
  }
  return res.json();
}

/* =========================
   IMAGE
========================= */

export function getProductImageUrl(imageUrl?: string) {
  if (!imageUrl) return "/placeholder.svg";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = IMAGE_BASE_URL.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: number;
  available: boolean;
};

export type CatalogProductsResponse = {
  items: CatalogProduct[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// Sync autenticado — evita product injection por terceiros
export async function syncProductToShopping(product: {
  name: string; slug: string; category: string;
  subCategory?: string | null; brand?: string | null;
  description?: string | null; imageUrl?: string | null;
  imageAlt?: string | null; price: number;
  promotionalPrice?: number | null; stock: number; available: boolean;
  featured?: boolean;
  storeId?: string; storeName?: string;
}): Promise<void> {
  await authFetch(`${IMAGE_WORKER_URL}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  }).catch((e) => {
    console.warn("[sync-shopping] falha silenciosa:", e);
  });
}

export async function removeProductFromShopping(slug: string, storeId?: string): Promise<void> {
  const params = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  await authFetch(`${IMAGE_WORKER_URL}/sync/${encodeURIComponent(slug)}${params}`, {
    method: "DELETE",
  }).catch((e) => {
    console.warn("[remove-shopping] falha silenciosa:", e);
  });
}

export async function getFeaturedSlugs(storeId?: string): Promise<string[]> {
  try {
    const params = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    const res = await fetch(`${IMAGE_WORKER_URL}/featured-slugs${params}`);
    const data = await res.json() as { slugs: string[] };
    return data.slugs ?? [];
  } catch {
    return [];
  }
}

export async function getWorkerImages(search = ""): Promise<CatalogProduct[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(`${IMAGE_WORKER_URL}/images?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao carregar banco de imagens.");
  const data = await response.json() as { items: CatalogProduct[] };
  return data.items.filter((p) => p.imageUrl);
}

export async function getCatalogProducts(search = ""): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (search.trim()) params.set("search", search.trim());
  const response = await authFetch(`${GIZ_API_URL}/api/products?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao buscar catálogo global.");
  const data = (await response.json()) as CatalogProductsResponse;
  return data.items;
}

export type CreateProductPayload = {
  name: string;
  category: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
};

export async function createProduct(data: CreateProductPayload): Promise<CatalogProduct> {
  const response = await authFetch(`${GIZ_API_URL}/api/products`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Erro ao criar produto.");
  }
  return response.json();
}

export async function addProductFromCatalog(productId: string) {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/add-from-catalog`, {
    method: "POST",
    body: JSON.stringify({ storeId: getSellerStoreId(), productId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Erro ao adicionar produto à loja.");
  }
  return response.json();
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await authFetch(`${IMAGE_WORKER_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Erro ao enviar imagem.");
  }
  const data = await response.json();
  return data.imageUrl;
}

export async function clearStoreProducts(storeId: string): Promise<{ removed: number; disabled: number }> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/store/${storeId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Erro ao limpar produtos da loja.");
  return response.json();
}

export async function removeStoreProduct(id: string): Promise<{ softDeleted: boolean }> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Erro ao remover produto da loja.");
  return response.json();
}

export async function toggleStoreOpen(storeId: string, isOpen: boolean): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/stores/${storeId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isOpen }),
  });
  if (!response.ok) throw new Error("Erro ao atualizar status da loja");
}

export async function updateStoreProductImage(id: string, imageUrl: string): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}/image`, {
    method: "PATCH",
    body: JSON.stringify({ imageUrl }),
  });
  if (!response.ok) throw new Error("Erro ao salvar imagem do produto.");
}

export async function getPlanStatus(): Promise<{ plan: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("vendor_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { plan: data?.plan ?? "free" };
}

export type ChangePlanResult = {
  plan: string;
  paymentLink: string | null;
  pixPayload: string | null;
  pixQrCodeImage: string | null;
  dueDate: string | null;
  activated: boolean;
};

export async function changePlan(planId: "free" | "start" | "pro" | "whitelabel"): Promise<ChangePlanResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    plan: string;
    activated: boolean;
    firstPayment?: {
      pixCode: string;
      pixQrCode: string;
      dueDate: string;
      expirationDate: string;
    } | null;
    error?: string;
  }>("create-subscription", { body: { planId } });

  if (error) throw new Error(error.message ?? "Erro ao alterar plano");
  if (!data?.ok) throw new Error(data?.error ?? "Erro ao alterar plano");

  const fp = data.firstPayment;
  return {
    plan:           data.plan,
    activated:      data.activated,
    pixPayload:     fp?.pixCode     ?? null,
    pixQrCodeImage: fp?.pixQrCode   ?? null,
    dueDate:        fp?.dueDate     ?? null,
    paymentLink:    null,
  };
}

export type Invoice = {
  id: string;
  value: number;
  netValue: number;
  status: string;
  billingType: string;
  dueDate: string;
  paymentDate: string | null;
  invoiceUrl: string | null;
  description: string | null;
};

export async function getInvoices(): Promise<Invoice[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Busca eventos de pagamento de assinatura como histórico de faturas
  const { data } = await supabase
    .from("subscription_events")
    .select("id, to_plan, created_at, metadata")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);
  return (data ?? []).map(e => ({
    id:          e.id,
    value:       Number((e.metadata as Record<string, unknown>)?.amount ?? 0),
    netValue:    Number((e.metadata as Record<string, unknown>)?.amount ?? 0),
    status:      "CONFIRMED",
    billingType: "PIX",
    dueDate:     (e.created_at as string).slice(0, 10),
    paymentDate: (e.created_at as string).slice(0, 10),
    invoiceUrl:  null,
    description: `Plano ${e.to_plan}`,
  }));
}

export async function deleteAccount(): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/auth/me`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Erro ao excluir conta (${response.status})`);
  }
}

/* =========================
   ASAAS SUBACCOUNT
========================= */

export type AsaasAccountInfo = {
  accountId: string | null;
  walletId: string | null;
  cpfCnpj: string | null;
  accountName: string | null;
  kycStatus: string | null;
  splitEnabled: boolean;
};

/* =========================
   ADMIN — SAQUES
========================= */

export type Withdrawal = {
  id:               string;
  ownerType:        string;
  ownerName:        string;
  ownerEmail:       string;
  ownerRole:        string;
  amountGross:      number;
  withdrawalFee:    number;
  amountNet:        number;
  pixKey:           string;
  pixKeyType:       string;
  status:           string;
  notes:            string | null;
  gatewayReference: string | null;
  processedAt:      string | null;
  createdAt:        string;
};

export async function getAdminWithdrawals(status = "pending"): Promise<Withdrawal[]> {
  const res = await authFetch(`${GIZ_API_URL}/api/admin/withdrawals?status=${status}`);
  if (!res.ok) throw new Error("Erro ao buscar saques.");
  return res.json();
}

export async function updateWithdrawal(
  id: string,
  status: "paid" | "failed" | "cancelled",
  gatewayReference?: string,
  notes?: string,
): Promise<void> {
  const res = await authFetch(`${GIZ_API_URL}/api/admin/withdrawals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, gatewayReference, notes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Erro ao atualizar saque (${res.status})`);
  }
}

export type AsaasAccountStatusResponse = {
  connected: boolean;
  account: AsaasAccountInfo | null;
};

export async function getAsaasAccountStatus(): Promise<AsaasAccountStatusResponse> {
  const res = await authFetch(`${GIZ_API_URL}/api/subscriptions/asaas-account`);
  if (!res.ok) return { connected: false, account: null };
  return res.json();
}

export async function connectAsaasAccount(params: {
  cpfCnpj: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}): Promise<{ connected: boolean; accountId: string; walletId: string }> {
  const res = await authFetch(`${GIZ_API_URL}/api/subscriptions/asaas-account`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Erro ao criar conta de recebimento (${res.status})`);
  }
  return res.json();
}

export async function reconcileOrders(): Promise<{ reconciled: number }> {
  const res = await authFetch(`${GIZ_API_URL}/api/orders/reconcile`, { method: "POST" });
  if (!res.ok) return { reconciled: 0 };
  return res.json();
}
