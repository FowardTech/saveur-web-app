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

/**
 * Multipart file upload — apiClient.post above always JSON.stringifies its
 * body, which can't carry a real File. Used by anything that hits a
 * multipart/form-data endpoint (documents.py's /documents/upload,
 * resume.py's /resume/upload) — sets the Authorization header the same way
 * request() does, but lets the browser generate its own multipart
 * Content-Type boundary rather than forcing application/json.
 */
async function upload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const authHeaders = await authHeader();
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { ...authHeaders }, body: formData });
  } catch {
    const err: ApiError = {
      message: "No internet connection. Please check your connection and try again.",
      code: "ERR_NETWORK",
    };
    throw err;
  }
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => ({})) : undefined;
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

/**
 * Binary/blob download with auth — for endpoints that return a real file
 * body (not JSON), or for re-fetching a returned download `url` with the
 * user's auth header attached. Returns the raw Blob for the caller to save/
 * share via an object URL.
 */
async function downloadBlob(path: string): Promise<Blob> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  // BUG FIX (product report: "Resume and cover letter downloading is not
  // working in the web version"): every resume/cover-letter export returns
  // a real https `url` — in production that's an S3/DigitalOcean Spaces
  // PRESIGNED url (see Saveur-Backend's s3_service.py's S3Storage.get_url),
  // already self-authenticating via its query string, on a completely
  // different origin than this app's own API. Attaching our own Firebase
  // Authorization header to that fetch turns it into a cross-origin request
  // with a non-simple header, which forces a CORS preflight — and that
  // storage origin was never configured (nor can it easily be, it's outside
  // this Flask app's own CORS(app, resources={r"/api/*": ...}) setup) to
  // allow it, so the browser silently blocks the whole download. Mobile
  // never hit this because RNBlobUtil.fetch() there sends no extra headers
  // at all (see Saveur/services/documentDownloadService.ts) — matching that:
  // only attach our own auth header for a same-origin request against our
  // own API, never for an absolute URL pointing somewhere else (whether a
  // presigned Spaces link, or local dev's own unauthenticated
  // /api/v1/documents/files/<key> route, which needs no auth either).
  const isOwnApi = !path.startsWith("http") || url.startsWith(API_BASE_URL);
  const authHeaders = isOwnApi ? await authHeader() : {};
  const res = await fetch(url, { headers: { ...authHeaders } });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  return res.blob();
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
  put: <T>(path: string, data?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}), auth: opts?.auth }),
  patch: <T>(path: string, data?: unknown, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}), auth: opts?.auth }),
  delete: <T>(path: string, opts?: { auth?: boolean }) =>
    request<T>(path, { method: "DELETE", auth: opts?.auth }),
  upload,
  downloadBlob,
};

export default apiClient;
