import { firebaseAuth } from "./firebase";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.saveurnow.com";

export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  error?: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const authHeaders = auth ? await authHeader() : {};

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...headers,
      },
    });
  } catch {
    const err: ApiError = {
      message: "No internet connection. Please check your connection and try again.",
      code: "ERR_NETWORK",
    };
    throw err;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : undefined;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      error: body?.error,
      message: body?.message ?? body?.detail ?? `Request failed with status ${res.status}`,
      code: body?.code,
    };
    throw err;
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: { auth?: boolean; params?: Record<string, string | undefined> }) => {
    const query = opts?.params
      ? "?" +
        new URLSearchParams(
          Object.entries(opts.params).filter(([, v]) => v !== undefined) as [string, string][]
        ).toString()
      : "";
    return request<T>(`${path}${query}`, { method: "GET", auth: opts?.auth });
  },
  post: <T>(path: string, data?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}), auth: opts?.auth }),
  patch: <T>(path: string, data?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}), auth: opts?.auth }),
  delete: <T>(path: string, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "DELETE", auth: opts?.auth }),
};

export default apiClient;
