/** Thin fetch wrapper: adds the auth token, parses errors into friendly ApiError objects. */

const TOKEN_KEY = 'flowdesk.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'ERROR',
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.status === 0;
  }
}

/* ----- token storage (localStorage when "remember me", sessionStorage otherwise) ----- */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const tokenStore = {
  get(): string | null {
    return safe(() => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY), null);
  },
  set(token: string, remember: boolean) {
    safe(() => {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    }, undefined);
  },
  /** Replace the token but keep the storage the user originally chose. */
  refresh(token: string) {
    safe(() => {
      const remembered = localStorage.getItem(TOKEN_KEY) !== null;
      (remembered ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    }, undefined);
  },
  clear() {
    safe(() => {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }, undefined);
  },
};

let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => {
  onSessionExpired = fn;
};

type Params = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, params?: Params) {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api${withQuery(path, params)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'We could not reach the FlowDesk server. Check your connection and that the API is running, then try again.',
      'NETWORK',
    );
  }

  if (response.status === 204) return undefined as T;

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok) {
    const err = payload?.error;
    if (response.status === 401 && err?.code === 'SESSION_EXPIRED') onSessionExpired?.();
    throw new ApiError(
      response.status,
      err?.message ?? (response.status >= 500 ? 'The server had a problem. Please try again.' : 'Something went wrong.'),
      err?.code,
      err?.fields ?? {},
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
