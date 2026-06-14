import { getAuth, getAuthToken, logout } from "./auth";

export const GIZ_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5003";

export const DEFAULT_STORE_ID =
  "b5c148b0-a07b-4532-aca3-e66c12f389af";

function getSellerStoreId() {
  return getAuth()?.storeId || DEFAULT_STORE_ID;
}

function authHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers as Record<string, string>) },
  });
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Email ou senha inválidos.");
  }

  return response.json();
}

/* =========================
   STORES API
========================= */

export async function getStoreById(storeId: string = getSellerStoreId()): Promise<Store> {
  const response = await fetch(`${GIZ_API_URL}/api/stores/${storeId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar loja");
  }

  return response.json();
}

export async function updateStore(id: string, data: Store): Promise<void> {
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
  storeId: string = getSellerStoreId()
): Promise<StoreProduct[]> {
  const response = await fetch(`${GIZ_API_URL}/api/storeproducts/${storeId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar produtos da loja");
  }

  return response.json();
}

export async function updateStoreProduct(
  id: string,
  data: {
    price: number;
    promotionalPrice?: number | null;
    stock: number;
    available: boolean;
  }
): Promise<StoreProduct> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Erro ao atualizar produto");
  }

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
  const storeId = getSellerStoreId();

  const response = await fetch(`${GIZ_API_URL}/api/orders/store/${storeId}`, {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar pedidos");
  }

  return response.json();
}

export async function getAllOrders(): Promise<Order[]> {
  const response = await fetch(`${GIZ_API_URL}/api/orders/store/${DEFAULT_STORE_ID}`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erro ao buscar entregas");
  return response.json();
}

export async function getAvailableDeliveries(): Promise<Order[]> {
  const response = await fetch(`${GIZ_API_URL}/api/orders/courier/available`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erro ao buscar entregas disponíveis");
  return response.json();
}

export async function getMyCourierOrders(): Promise<Order[]> {
  const response = await fetch(`${GIZ_API_URL}/api/orders/courier/mine`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erro ao buscar minhas entregas");
  return response.json();
}

export async function acceptDelivery(orderId: string): Promise<Order> {
  const response = await fetch(`${GIZ_API_URL}/api/orders/${orderId}/courier/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
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

  if (!response.ok) {
    throw new Error("Erro ao atualizar pedido");
  }

  return response.json();
}

/* =========================
   IMAGE
========================= */

export function getProductImageUrl(imageUrl?: string) {
  if (!imageUrl) return "/placeholder.png";

  if (imageUrl.startsWith("http")) return imageUrl;

  return `${GIZ_API_URL}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
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

export async function getCatalogProducts(search = ""): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({
    page: "1",
    pageSize: "100",
  });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const response = await fetch(`${GIZ_API_URL}/api/products?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar catálogo global.");
  }

  const data = (await response.json()) as CatalogProductsResponse;

  return data.items;
}

export async function addProductFromCatalog(productId: string) {
  const response = await fetch(`${GIZ_API_URL}/api/storeproducts/add-from-catalog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      storeId: getSellerStoreId(),
      productId,
    }),
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

  const response = await fetch(`${GIZ_API_URL}/api/products/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Erro ao enviar imagem.");
  }

  const data = await response.json();

  return data.imageUrl;
}

export async function removeStoreProduct(id: string): Promise<{ softDeleted: boolean }> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Erro ao remover produto da loja.");
  }

  return response.json();
}

export async function updateStoreProductImage(
  id: string,
  imageUrl: string
): Promise<void> {
  const response = await authFetch(`${GIZ_API_URL}/api/storeproducts/${id}/image`, {
    method: "PATCH",
    body: JSON.stringify({ imageUrl }),
  });

  if (!response.ok) {
    throw new Error("Erro ao salvar imagem do produto.");
  }
}