import { getAuth, getAuthToken, isTokenExpired, logout } from "./auth";

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
  return response.json();
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

export async function toggleFeaturedInShopping(slug: string, featured: boolean, storeId?: string): Promise<void> {
  await authFetch(`${IMAGE_WORKER_URL}/sync/${encodeURIComponent(slug)}/featured`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featured, storeId }),
  }).catch((e) => {
    console.warn("[toggle-featured] falha silenciosa:", e);
  });
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

export async function deleteAccount(): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/auth/me`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Erro ao excluir conta (${response.status})`);
  }
}
