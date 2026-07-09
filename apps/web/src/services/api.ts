export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export class ApiError<T = unknown> extends Error {
  status: number;
  data: T | null;

  constructor(message: string, status: number, data: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions<TBody> = {
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
export const TOKEN_KEY = "hotspot_token";
export const ADMIN_KEY = "hotspot_admin";

export type AdminRole = "admin" | "manager" | "marketing" | "seller" | "user";
export type CurrentAdmin = {
  id: string;
  usuario: string;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  role: AdminRole;
  ativo: boolean;
};

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setCurrentAdmin(admin: CurrentAdmin): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function getCurrentAdmin(): CurrentAdmin | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentAdmin;
  } catch {
    localStorage.removeItem(ADMIN_KEY);
    return null;
  }
}

export function getCurrentRole(): AdminRole | null {
  return getCurrentAdmin()?.role ?? null;
}

export function roleHome(role: AdminRole | null): string {
  return role ? "/dashboard" : "/login";
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function handleUnauthorized(path: string): void {
  clearToken();

  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/portal")) return;
  if (path.startsWith("/portal/")) return;
  if (window.location.pathname === "/login") return;

  window.location.assign("/login?expired=1");
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const maybeMessage = "message" in data ? data.message : "error" in data ? data.error : null;

    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return fallback;
}

async function request<TResponse, TBody = unknown>(
  method: ApiMethod,
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const token = getToken();
  const headers = new Headers(options.headers);
  const body = method === "POST" && options.body === undefined ? {} : options.body;

  headers.set("Accept", "application/json");

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
  });

  const data = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(path);
    }

    throw new ApiError(getErrorMessage(data, "Erro ao comunicar com a API."), response.status, data);
  }

  return data as TResponse;
}

export const api = {
  get: <TResponse>(path: string, options?: Omit<RequestOptions<never>, "body">) =>
    request<TResponse>("GET", path, options),
  post: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, "body">) =>
    request<TResponse, TBody>("POST", path, { ...options, body }),
  put: <TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, "body">) =>
    request<TResponse, TBody>("PUT", path, { ...options, body }),
  delete: <TResponse>(path: string, options?: Omit<RequestOptions<never>, "body">) =>
    request<TResponse>("DELETE", path, options),
};
