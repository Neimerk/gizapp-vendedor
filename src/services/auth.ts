export const AUTH_STORAGE_KEY = "brasux-loja-auth";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Customer" | "Seller" | "Courier";
  storeId?: string | null;
  plan?: "free" | "basic" | "premium";
  cpf?: string | null;
  token: string;
};

export function saveAuth(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function getAuth(): AuthUser | null {
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!saved) return null;

  try {
    return JSON.parse(saved) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getAuthToken() {
  return getAuth()?.token ?? "";
}

export function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}