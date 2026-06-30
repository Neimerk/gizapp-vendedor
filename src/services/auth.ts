// Token armazenado separado do perfil para minimizar exposição
export const AUTH_STORAGE_KEY = "brasux-loja-auth";
const TOKEN_KEY = "brasux-loja-token";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Customer" | "Seller" | "Courier";
  storeId?: string | null;
  plan?: "free" | "basic" | "premium";
  // documentMasked: "049.***.***-11" — nunca o número completo
  documentMasked?: string | null;
  documentType?: "cpf" | "cnpj" | null;
};

function maskDocument(cpf?: string | null): { masked: string | null; type: "cpf" | "cnpj" | null } {
  if (!cpf) return { masked: null, type: null };
  const d = cpf.replace(/\D/g, "");
  if (d.length === 11) {
    return { masked: `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`, type: "cpf" };
  }
  if (d.length === 14) {
    return { masked: `${d.slice(0, 2)}.***.***/****-${d.slice(12, 14)}`, type: "cnpj" };
  }
  return { masked: null, type: null };
}

// Aceita a resposta completa do servidor (com token e cpf) e armazena apenas dados seguros
export function saveAuth(user: AuthUser & { token: string; cpf?: string | null }) {
  const { token, cpf, ...rest } = user;
  const { masked, type } = maskDocument(cpf);
  const safeUser: AuthUser = { ...rest, documentMasked: masked, documentType: type };

  // sessionStorage: morre ao fechar o tab/browser, não persiste entre sessões
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeUser));
  // Token em chave separada — se precisar revogar, apaga apenas o token
  sessionStorage.setItem(TOKEN_KEY, token);

  // Limpar dado residual do localStorage (migração de versões anteriores)
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuth(): AuthUser | null {
  // Limpar localStorage legado na primeira chamada
  if (localStorage.getItem(AUTH_STORAGE_KEY)) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  const saved = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AuthUser;
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getAuthToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

export function isTokenExpired(): boolean {
  const token = getAuthToken();
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    // atob é seguro aqui: base64url → base64 antes de decodificar
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload.exp as number | undefined;
    if (!exp) return false;
    return Date.now() / 1000 > exp - 60; // 60s de margem
  } catch {
    return true;
  }
}

export function updateAuthPlan(plan: AuthUser["plan"]): void {
  const auth = getAuth();
  if (!auth) return;
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...auth, plan }));
}

export function logout() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY); // limpar legado
}
