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

// ── Helper: usuário Supabase autenticado ─────────────────────────────────────

async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sessão expirada. Faça login novamente.");
  return user;
}

// ── Cache multi-tenant seguro ────────────────────────────────────────────────

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

export function clearAllCaches(): void {
  _cache.invalidate();
}

// ── HTTP autenticado (ainda necessário para auth/.NET legado) ────────────────

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
   TYPES
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

export type UpdateStorePayload = Pick<
  Store,
  | "name" | "category" | "description" | "logoUrl" | "bannerUrl"
  | "phone" | "whatsapp" | "email" | "address" | "number" | "complement"
  | "neighborhood" | "city" | "state" | "zipCode"
  | "deliveryFee" | "deliveryTimeMin" | "deliveryTimeMax" | "isOpen"
>;

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
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
};

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
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type StoreHour = {
  day: number;
  label: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

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

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

/* =========================
   MAPPERS
========================= */

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStore(r: any): Store {
  return {
    id:              r.id,
    name:            r.name,
    slug:            r.slug,
    category:        r.category,
    description:     r.description,
    logoUrl:         r.logo_url,
    bannerUrl:       r.banner_url,
    phone:           r.phone,
    whatsapp:        r.whatsapp,
    email:           r.email,
    address:         r.address,
    number:          r.number,
    complement:      r.complement,
    neighborhood:    r.neighborhood,
    city:            r.city,
    state:           r.state,
    zipCode:         r.zip_code,
    deliveryFee:     Number(r.delivery_fee ?? 0),
    deliveryTimeMin: r.delivery_time_min ?? 30,
    deliveryTimeMax: r.delivery_time_max ?? 60,
    rating:          Number(r.rating ?? 0),
    isOpen:          r.is_open ?? false,
    active:          r.active ?? true,
    featured:        r.featured ?? false,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(r: any): StoreProduct {
  return {
    id:               r.id,
    storeId:          r.store_id,
    productId:        r.id,           // store_products é o produto; sem catálogo separado
    name:             r.name,
    slug:             r.slug,
    category:         r.category,
    subCategory:      r.sub_category,
    brand:            r.brand,
    description:      r.description,
    imageUrl:         r.image_url,
    imageAlt:         r.image_alt,
    price:            Number(r.price ?? 0),
    promotionalPrice: r.promotional_price != null ? Number(r.promotional_price) : null,
    stock:            r.stock ?? 0,
    available:        r.available ?? true,
    featured:         r.featured ?? false,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(r: any): Order {
  // items é jsonb — normaliza para OrderItem[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = Array.isArray(r.items) ? r.items : [];
  const items: OrderItem[] = rawItems.map((it, idx) => ({
    id:             it.id             ?? `item-${idx}`,
    orderId:        r.id,
    storeProductId: it.storeProductId ?? it.store_product_id ?? it.productId ?? "",
    productName:    it.productName    ?? it.product_name     ?? it.name       ?? "",
    imageUrl:       it.imageUrl       ?? it.image_url,
    unitPrice:      Number(it.unitPrice  ?? it.unit_price  ?? it.price ?? 0),
    quantity:       Number(it.quantity ?? 1),
    totalPrice:     Number(it.totalPrice ?? it.total_price ?? it.total ?? 0),
  }));

  return {
    id:                   r.id,
    storeId:              r.store_id,
    storeName:            r.store_name,
    customerId:           r.customer_id,
    customerName:         r.customer_name  ?? "",
    customerPhone:        r.customer_phone ?? "",
    deliveryAddress:      r.delivery_address      ?? "",
    deliveryNumber:       r.delivery_number       ?? "",
    deliveryComplement:   r.delivery_complement   ?? "",
    deliveryNeighborhood: r.delivery_neighborhood ?? "",
    paymentMethod:        r.payment_method ?? "",
    deliveryFee:          Number(r.delivery_fee ?? 0),
    subtotal:             Number(r.subtotal    ?? 0),
    total:                Number(r.total       ?? 0),
    serviceFee:           Number(r.service_fee ?? 0),
    paymentStatus:        r.payment_status ?? "pending",
    asaasChargeId:        r.asaas_charge_id ?? null,
    status:               r.status ?? 0,
    courierId:            r.courier_id ?? null,
    notes:                r.notes ?? null,
    createdAt:            r.created_at,
    updatedAt:            r.updated_at,
    items,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoupon(r: any): Coupon {
  return {
    id:            r.id,
    storeId:       r.store_id ?? r.vendor_id ?? "",
    code:          r.code,
    description:   r.description ?? r.label ?? null,
    discountType:  r.type === "fixed" ? "fixed" : "percent",
    discountValue: Number(r.value ?? 0),
    minOrderValue: Number(r.min_order ?? 0),
    maxUses:       r.max_uses ?? null,
    usesCount:     r.uses_count ?? 0,
    validFrom:     r.valid_from ?? null,
    validUntil:    r.expires_at ?? null,
    active:        r.active ?? true,
    createdAt:     r.created_at,
  };
}

/* =========================
   AUTH API  (ainda via .NET — migração de auth é fase separada)
========================= */

export type LoginPayload = { email: string; password: string };

export async function loginSeller(payload: LoginPayload) {
  const response = await fetch(`${GIZ_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Email ou senha inválidos.");
  const data = await response.json();
  // Sessão Supabase paralela para wallet/subscription/RLS
  supabase.auth.signInWithPassword({ email: payload.email, password: payload.password })
    .then(({ data: sbData }) => {
      if (sbData.user) updateAuthSupabaseId(sbData.user.id);
    })
    .catch(() => null);
  return data;
}

export type RegisterStorePayload = {
  name: string; email: string; password: string;
  storeName: string; document: string; category?: string;
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

export async function deleteAccount(): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/auth/me`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Erro ao excluir conta (${response.status})`);
  }
}

/* =========================
   STORES  →  Supabase
========================= */

export async function getStoreById(storeId: string): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();
  if (error || !data) throw new Error("Erro ao buscar loja");
  return mapStore(data);
}

export async function updateStore(id: string, payload: UpdateStorePayload): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({
      name:              payload.name,
      category:          payload.category,
      description:       payload.description,
      logo_url:          payload.logoUrl,
      banner_url:        payload.bannerUrl,
      phone:             payload.phone,
      whatsapp:          payload.whatsapp,
      email:             payload.email,
      address:           payload.address,
      number:            payload.number,
      complement:        payload.complement,
      neighborhood:      payload.neighborhood,
      city:              payload.city,
      state:             payload.state,
      zip_code:          payload.zipCode,
      delivery_fee:      payload.deliveryFee,
      delivery_time_min: payload.deliveryTimeMin,
      delivery_time_max: payload.deliveryTimeMax,
      is_open:           payload.isOpen,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message || "Erro ao atualizar loja");
}

export async function toggleStoreOpen(storeId: string, isOpen: boolean): Promise<void> {
  const { error } = await supabase
    .from("stores")
    .update({ is_open: isOpen, updated_at: new Date().toISOString() })
    .eq("id", storeId);
  if (error) throw new Error("Erro ao atualizar status da loja");
}

/* =========================
   STORE HOURS  →  Supabase
========================= */

export async function getStoreHours(storeId: string): Promise<StoreHour[]> {
  const { data } = await supabase
    .from("store_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("store_id", storeId)
    .order("day_of_week");

  // Garante 7 dias mesmo que não haja registros
  const byDay = new Map((data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => [r.day_of_week as number, r]
  ));

  return Array.from({ length: 7 }, (_, day) => {
    const r = byDay.get(day);
    return {
      day,
      label:     DAY_LABELS[day],
      isOpen:    r?.is_open    ?? false,
      openTime:  r?.open_time  ?? "08:00",
      closeTime: r?.close_time ?? "18:00",
    };
  });
}

export async function updateStoreHours(storeId: string, hours: StoreHour[]): Promise<StoreHour[]> {
  const rows = hours.map(h => ({
    store_id:    storeId,
    day_of_week: h.day,
    is_open:     h.isOpen,
    open_time:   h.openTime,
    close_time:  h.closeTime,
  }));

  const { error } = await supabase
    .from("store_hours")
    .upsert(rows, { onConflict: "store_id,day_of_week" });
  if (error) throw new Error(error.message ?? "Erro ao salvar horários.");
  return hours;
}

/* =========================
   STORE PRODUCTS  →  Supabase
========================= */

export async function getStoreProducts(
  storeId: string = getSellerStoreId(),
  fresh = false,
): Promise<StoreProduct[]> {
  if (!fresh) {
    const cached = _cache.get(storeId);
    if (cached) return cached;
  }
  const { data, error } = await supabase
    .from("store_products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar produtos da loja");
  const products = (data ?? []).map(mapProduct);
  _cache.set(storeId, products);
  return products;
}

export async function createProduct(data: {
  name: string; category: string; brand?: string;
  description?: string; imageUrl?: string; imageAlt?: string;
  price?: number; stock?: number; available?: boolean; featured?: boolean;
  slug?: string; subCategory?: string; promotionalPrice?: number | null;
}): Promise<StoreProduct> {
  const user = await getSupabaseUser();
  const storeId = getSellerStoreId();

  // Verifica se a loja pertence ao usuário autenticado
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .single();
  if (!store) throw new Error("Loja não encontrada.");

  const slug = data.slug
    || data.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

  const { data: inserted, error } = await supabase
    .from("store_products")
    .insert({
      store_id:          storeId,
      name:              data.name,
      slug,
      category:          data.category,
      sub_category:      data.subCategory,
      brand:             data.brand,
      description:       data.description,
      image_url:         data.imageUrl,
      image_alt:         data.imageAlt,
      price:             data.price ?? 0,
      promotional_price: data.promotionalPrice ?? null,
      stock:             data.stock ?? 0,
      available:         data.available ?? true,
      featured:          data.featured ?? false,
    })
    .select()
    .single();
  if (error || !inserted) throw new Error(error?.message || "Erro ao criar produto.");
  _cache.invalidate(storeId);
  return mapProduct(inserted);
}

export async function updateStoreProduct(
  id: string,
  data: {
    price?: number; promotionalPrice?: number | null;
    stock?: number; available?: boolean;
    imageAlt?: string; category?: string; featured?: boolean;
    name?: string; description?: string;
  }
): Promise<StoreProduct> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.price             !== undefined) update.price             = data.price;
  if (data.promotionalPrice  !== undefined) update.promotional_price = data.promotionalPrice;
  if (data.stock             !== undefined) update.stock             = data.stock;
  if (data.available         !== undefined) update.available         = data.available;
  if (data.imageAlt          !== undefined) update.image_alt         = data.imageAlt;
  if (data.category          !== undefined) update.category          = data.category;
  if (data.featured          !== undefined) update.featured          = data.featured;
  if (data.name              !== undefined) update.name              = data.name;
  if (data.description       !== undefined) update.description       = data.description;

  const { data: updated, error } = await supabase
    .from("store_products")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error || !updated) throw new Error("Erro ao atualizar produto");
  _cache.invalidate(updated.store_id);
  return mapProduct(updated);
}

export async function updateStoreProductImage(id: string, imageUrl: string): Promise<void> {
  const { data: updated, error } = await supabase
    .from("store_products")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("store_id")
    .single();
  if (error) throw new Error("Erro ao salvar imagem do produto.");
  if (updated?.store_id) _cache.invalidate(updated.store_id);
}

export async function removeStoreProduct(id: string): Promise<{ softDeleted: boolean }> {
  const { data: existing } = await supabase
    .from("store_products")
    .select("store_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("store_products")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Erro ao remover produto da loja.");
  if (existing?.store_id) _cache.invalidate(existing.store_id);
  return { softDeleted: false };
}

export async function clearStoreProducts(storeId: string): Promise<{ removed: number; disabled: number }> {
  const { data: products } = await supabase
    .from("store_products")
    .select("id")
    .eq("store_id", storeId);

  const count = products?.length ?? 0;
  const { error } = await supabase
    .from("store_products")
    .delete()
    .eq("store_id", storeId);
  if (error) throw new Error("Erro ao limpar produtos da loja.");
  _cache.invalidate(storeId);
  return { removed: count, disabled: 0 };
}

// addProductFromCatalog: sem catálogo global — cria diretamente
export async function addProductFromCatalog(productId: string): Promise<StoreProduct> {
  // Copia produto de outra loja como template
  const { data: source, error: srcErr } = await supabase
    .from("store_products")
    .select("*")
    .eq("id", productId)
    .single();
  if (srcErr || !source) throw new Error("Produto não encontrado no catálogo.");

  const storeId = getSellerStoreId();
  const user = await getSupabaseUser();
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .single();
  if (!store) throw new Error("Loja não encontrada.");

  const { data: inserted, error } = await supabase
    .from("store_products")
    .insert({
      store_id:          storeId,
      name:              source.name,
      slug:              `${source.slug}-${Date.now()}`,
      category:          source.category,
      sub_category:      source.sub_category,
      brand:             source.brand,
      description:       source.description,
      image_url:         source.image_url,
      image_alt:         source.image_alt,
      price:             source.price,
      promotional_price: null,
      stock:             0,
      available:         false,
    })
    .select()
    .single();
  if (error || !inserted) throw new Error(error?.message || "Erro ao adicionar produto à loja.");
  _cache.invalidate(storeId);
  return mapProduct(inserted);
}

/* =========================
   ORDERS  →  Supabase
========================= */

export async function getOrders(): Promise<Order[]> {
  const user = await getSupabaseUser();
  const auth = getAuth();

  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (auth?.role !== "Admin") {
    query = query.eq("vendor_id", user.id);
  }

  const { data, error } = await query;
  if (error) throw new Error("Erro ao buscar pedidos");
  return (data ?? []).map(mapOrder);
}

export async function updateOrderStatus(id: string, status: number) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error("Erro ao atualizar pedido");
  return mapOrder(data);
}

export async function confirmCashPayment(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Erro ao confirmar pagamento.");
  return mapOrder(data);
}

/* =========================
   CUPONS  →  Supabase
========================= */

export async function getCoupons(): Promise<Coupon[]> {
  const user = await getSupabaseUser();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar cupons.");
  return (data ?? []).map(mapCoupon);
}

export async function createCoupon(data: {
  code: string; description?: string;
  discountType: "percent" | "fixed"; discountValue: number;
  minOrderValue?: number; maxUses?: number;
  validFrom?: string; validUntil?: string;
}): Promise<Coupon> {
  const user = await getSupabaseUser();
  const storeId = getSellerStoreId();

  const { data: inserted, error } = await supabase
    .from("coupons")
    .insert({
      vendor_id:   user.id,
      store_id:    storeId,
      code:        data.code.toUpperCase().trim(),
      type:        data.discountType,
      value:       data.discountValue,
      description: data.description ?? null,
      label:       data.description ?? data.code,
      min_order:   data.minOrderValue ?? 0,
      max_uses:    data.maxUses ?? null,
      valid_from:  data.validFrom ?? null,
      expires_at:  data.validUntil ?? null,
      active:      true,
      uses_count:  0,
    })
    .select()
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Erro ao criar cupom.");
  return mapCoupon(inserted);
}

export async function toggleCoupon(id: string, active: boolean): Promise<Coupon> {
  const { data, error } = await supabase
    .from("coupons")
    .update({ active })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error("Erro ao atualizar cupom.");
  return mapCoupon(data);
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Erro ao excluir cupom.");
}

/* =========================
   CLIENTES  →  derivado de orders no Supabase
========================= */

export async function getCustomers(): Promise<Customer[]> {
  const user = await getSupabaseUser();
  const { data, error } = await supabase
    .from("orders")
    .select("customer_id, customer_name, customer_phone, total, created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar clientes.");

  // Agrega por customer_id
  type Row = { customer_id: string; customer_name: string; customer_phone: string; total: number; created_at: string };
  const byCustomer = new Map<string, {
    name: string; phone: string; totalSpent: number; orderCount: number; lastOrderAt: string;
  }>();
  for (const r of (data ?? [] as Row[])) {
    const entry = byCustomer.get(r.customer_id) ?? {
      name: r.customer_name, phone: r.customer_phone,
      totalSpent: 0, orderCount: 0, lastOrderAt: r.created_at,
    };
    entry.orderCount++;
    entry.totalSpent += Number(r.total ?? 0);
    if (r.created_at > entry.lastOrderAt) entry.lastOrderAt = r.created_at;
    byCustomer.set(r.customer_id, entry);
  }

  return Array.from(byCustomer.entries()).map(([id, c]) => ({
    id,
    name:        c.name,
    phone:       c.phone,
    email:       null,
    orderCount:  c.orderCount,
    totalSpent:  c.totalSpent,
    lastOrderAt: c.lastOrderAt,
  }));
}

export async function getCustomerOrders(customerId: string): Promise<unknown[]> {
  const user = await getSupabaseUser();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar pedidos do cliente.");
  return (data ?? []).map(mapOrder);
}

/* =========================
   DELIVERIES  (courier — legado, manter por ora)
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

/* =========================
   IMAGENS  (Cloudflare Worker — fase de migração separada)
========================= */

export function getProductImageUrl(imageUrl?: string) {
  if (!imageUrl) return "/placeholder.png";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = IMAGE_BASE_URL.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

export type CatalogProduct = {
  id: string; name: string; slug: string; category: string;
  subCategory?: string; brand?: string; description?: string;
  imageUrl?: string; imageAlt?: string; price?: number; available: boolean;
};

export type CatalogProductsResponse = {
  items: CatalogProduct[]; totalItems: number;
  page: number; pageSize: number; totalPages: number;
};

export async function getCatalogProducts(search = ""): Promise<CatalogProduct[]> {
  // Busca no catálogo Supabase (store_products de todas as lojas com imagem)
  let query = supabase
    .from("store_products")
    .select("id, name, slug, category, sub_category, brand, description, image_url, image_alt, price, available")
    .eq("available", true)
    .not("image_url", "is", null)
    .order("name")
    .limit(100);

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data } = await query;
  return (data ?? []).map(r => ({
    id:          r.id,
    name:        r.name,
    slug:        r.slug,
    category:    r.category,
    subCategory: r.sub_category,
    brand:       r.brand,
    description: r.description,
    imageUrl:    r.image_url,
    imageAlt:    r.image_alt,
    price:       Number(r.price ?? 0),
    available:   r.available,
  }));
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await authFetch(`${IMAGE_WORKER_URL}/upload`, {
    method: "POST", body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Erro ao enviar imagem.");
  }
  const data = await response.json();
  return data.imageUrl;
}

export async function syncProductToShopping(product: {
  name: string; slug: string; category: string;
  subCategory?: string | null; brand?: string | null;
  description?: string | null; imageUrl?: string | null;
  imageAlt?: string | null; price: number;
  promotionalPrice?: number | null; stock: number; available: boolean;
  featured?: boolean; storeId?: string; storeName?: string;
}): Promise<void> {
  await authFetch(`${IMAGE_WORKER_URL}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  }).catch((e) => { console.warn("[sync-shopping] falha silenciosa:", e); });
}

export async function removeProductFromShopping(slug: string, storeId?: string): Promise<void> {
  const params = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  await authFetch(`${IMAGE_WORKER_URL}/sync/${encodeURIComponent(slug)}${params}`, {
    method: "DELETE",
  }).catch((e) => { console.warn("[remove-shopping] falha silenciosa:", e); });
}

export async function getFeaturedSlugs(storeId?: string): Promise<string[]> {
  try {
    const params = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    const res = await fetch(`${IMAGE_WORKER_URL}/featured-slugs${params}`);
    const data = await res.json() as { slugs: string[] };
    return data.slugs ?? [];
  } catch { return []; }
}

export async function getWorkerImages(search = ""): Promise<CatalogProduct[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(`${IMAGE_WORKER_URL}/images?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Erro ao carregar banco de imagens.");
  const data = await response.json() as { items: CatalogProduct[] };
  return data.items.filter((p) => p.imageUrl);
}

/* =========================
   PLANOS  →  Supabase (já migrado)
========================= */

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
  plan: string; paymentLink: string | null;
  pixPayload: string | null; pixQrCodeImage: string | null;
  dueDate: string | null; activated: boolean;
};

export async function changePlan(planId: "free" | "start" | "pro" | "whitelabel"): Promise<ChangePlanResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean; plan: string; activated: boolean;
    firstPayment?: { pixCode: string; pixQrCode: string; dueDate: string; expirationDate: string } | null;
    error?: string;
  }>("create-subscription", { body: { planId } });
  if (error) throw new Error(error.message ?? "Erro ao alterar plano");
  if (!data?.ok) throw new Error(data?.error ?? "Erro ao alterar plano");
  const fp = data.firstPayment;
  return {
    plan:           data.plan,
    activated:      data.activated,
    pixPayload:     fp?.pixCode   ?? null,
    pixQrCodeImage: fp?.pixQrCode ?? null,
    dueDate:        fp?.dueDate   ?? null,
    paymentLink:    null,
  };
}

export type Invoice = {
  id: string; value: number; netValue: number; status: string;
  billingType: string; dueDate: string; paymentDate: string | null;
  invoiceUrl: string | null; description: string | null;
};

export async function getInvoices(): Promise<Invoice[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("subscription_invoices")
    .select("id, plan, amount, status, asaas_payment_id, paid_at, due_date, description, created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(24);
  return (data ?? []).map(r => ({
    id:          r.id as string,
    value:       Number(r.amount),
    netValue:    Number(r.amount),
    status:      r.status === "paid"    ? "CONFIRMED"
               : r.status === "overdue" ? "OVERDUE"
               : r.status === "refunded"? "REFUNDED"
               : "PENDING",
    billingType: "PIX",
    dueDate:     ((r.due_date ?? (r.created_at as string).slice(0, 10)) as string),
    paymentDate: r.paid_at ? (r.paid_at as string).slice(0, 10) : null,
    invoiceUrl:  null,
    description: (r.description as string | null) ?? `Plano ${r.plan}`,
  }));
}

/* =========================
   ADMIN  →  Supabase
========================= */

export type AsaasAccountInfo = {
  accountId: string | null; walletId: string | null;
  cpfCnpj: string | null; accountName: string | null;
  kycStatus: string | null; splitEnabled: boolean;
};

export type Withdrawal = {
  id: string; ownerType: string; ownerName: string;
  ownerEmail: string; ownerRole: string;
  amountGross: number; withdrawalFee: number; amountNet: number;
  pixKey: string; pixKeyType: string; status: string;
  notes: string | null; gatewayReference: string | null;
  processedAt: string | null; createdAt: string;
};

export async function updateWithdrawal(
  id: string,
  status: string,
  gatewayReference: string,
  notes: string,
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (gatewayReference) update.gateway_reference = gatewayReference;
  if (notes)            update.notes = notes;
  if (status === "processed" || status === "completed") {
    update.processed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("withdrawals")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(error.message ?? "Erro ao atualizar saque.");
}

export async function reconcileOrders(): Promise<{ reconciled: number }> {
  const { data, error } = await supabase.functions.invoke<{ reconciled: number }>(
    "reconcile-payments",
  );
  if (error) throw new Error(error.message ?? "Erro ao reconciliar pagamentos.");
  return { reconciled: data?.reconciled ?? 0 };
}

export async function getAsaasAccountStatus(): Promise<{
  connected: boolean;
  account: AsaasAccountInfo | null;
}> {
  const user = await getSupabaseUser();
  const { data } = await supabase
    .from("asaas_subaccounts")
    .select("asaas_account_id, asaas_wallet_id, cpf_cnpj, account_name, kyc_status, split_enabled")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data?.asaas_account_id) return { connected: false, account: null };
  return {
    connected: true,
    account: {
      accountId:   data.asaas_account_id,
      walletId:    data.asaas_wallet_id,
      cpfCnpj:     data.cpf_cnpj,
      accountName: data.account_name,
      kycStatus:   data.kyc_status,
      splitEnabled: data.split_enabled ?? false,
    },
  };
}

export type ConnectAsaasPayload = {
  cpfCnpj: string; name: string; email: string; phone: string;
  postalCode: string; address?: string; addressNumber?: string; province?: string;
};

export async function connectAsaasAccount(payload: ConnectAsaasPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
    "create-asaas-account",
    { body: payload },
  );
  if (error) throw new Error(error.message ?? "Erro ao conectar conta Asaas.");
  if (!data?.ok) throw new Error(data?.error ?? "Erro ao criar conta Asaas.");
}

export async function getAdminWithdrawals(status = "pending"): Promise<Withdrawal[]> {
  const { data, error } = await supabase
    .from("withdrawals")
    .select(`
      id, owner_type, amount_gross, withdrawal_fee, amount_net,
      pix_key, pix_key_type, status, notes, gateway_reference,
      processed_at, created_at, owner_id,
      profile:profiles!withdrawals_owner_id_fkey(name, email, role)
    `)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    // fallback: sem join de profile
    const { data: simple } = await supabase
      .from("withdrawals")
      .select("id, owner_type, amount_gross, withdrawal_fee, amount_net, pix_key, pix_key_type, status, notes, gateway_reference, processed_at, created_at, owner_id")
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(100);
    return (simple ?? []).map(r => ({
      id: r.id, ownerType: r.owner_type, ownerName: r.owner_id,
      ownerEmail: "", ownerRole: r.owner_type,
      amountGross: Number(r.amount_gross ?? 0),
      withdrawalFee: Number(r.withdrawal_fee ?? 0),
      amountNet: Number(r.amount_net ?? 0),
      pixKey: r.pix_key, pixKeyType: r.pix_key_type,
      status: r.status, notes: r.notes,
      gatewayReference: r.gateway_reference,
      processedAt: r.processed_at, createdAt: r.created_at,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id:               r.id,
    ownerType:        r.owner_type,
    ownerName:        r.profile?.name  ?? r.owner_id,
    ownerEmail:       r.profile?.email ?? "",
    ownerRole:        r.profile?.role  ?? r.owner_type,
    amountGross:      Number(r.amount_gross    ?? 0),
    withdrawalFee:    Number(r.withdrawal_fee  ?? 0),
    amountNet:        Number(r.amount_net      ?? 0),
    pixKey:           r.pix_key,
    pixKeyType:       r.pix_key_type,
    status:           r.status,
    notes:            r.notes,
    gatewayReference: r.gateway_reference,
    processedAt:      r.processed_at,
    createdAt:        r.created_at,
  }));
}
