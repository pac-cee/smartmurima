import { z } from 'zod';
import { tokenStore } from './token-store';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    code?: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  isForm?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(buildUrl('/auth/token/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { access?: string; refresh?: string };
        if (!data.access) return false;
        tokenStore.setAccess(data.access);
        if (data.refresh) tokenStore.setSession(data.access, data.refresh);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    tokenStore.clear();
    window.location.assign('/login');
  }
}

async function rawRequest(path: string, opts: RequestOptions, retry = true): Promise<Response> {
  const { method = 'GET', body, query, auth = true, isForm = false, signal } = opts;
  const headers: Record<string, string> = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    signal,
    body: isForm ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return rawRequest(path, opts, false);
    }
    redirectToLogin();
  }

  return res;
}

async function parse<T>(res: Response, schema?: z.ZodType<T>): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (data ?? {}) as {
      detail?: string;
      code?: string;
      errors?: Record<string, string[]>;
    };
    throw new ApiError(
      res.status,
      err.detail ?? `Request failed (${res.status})`,
      err.code,
      err.errors,
    );
  }

  if (schema) return schema.parse(data);
  return data as T;
}

export const api = {
  async get<T>(path: string, schema?: z.ZodType<T>, opts: RequestOptions = {}): Promise<T> {
    const res = await rawRequest(path, { ...opts, method: 'GET' });
    return parse(res, schema);
  },
  async post<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    opts: RequestOptions = {},
  ): Promise<T> {
    const res = await rawRequest(path, { ...opts, method: 'POST', body });
    return parse(res, schema);
  },
  async patch<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    opts: RequestOptions = {},
  ): Promise<T> {
    const res = await rawRequest(path, { ...opts, method: 'PATCH', body });
    return parse(res, schema);
  },
  async delete<T>(path: string, schema?: z.ZodType<T>, opts: RequestOptions = {}): Promise<T> {
    const res = await rawRequest(path, { ...opts, method: 'DELETE' });
    return parse(res, schema);
  },
  async postForm<T>(
    path: string,
    form: FormData,
    schema?: z.ZodType<T>,
    opts: RequestOptions = {},
  ): Promise<T> {
    const res = await rawRequest(path, { ...opts, method: 'POST', body: form, isForm: true });
    return parse(res, schema);
  },
  raw: rawRequest,
};
