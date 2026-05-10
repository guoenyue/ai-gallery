export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  baseUrl?: string;
  fetcher?: Fetcher;
};

export type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

type ErrorPayload = {
  message?: unknown;
};

export function normalizeApiBaseUrl(baseUrl?: string) {
  const trimmed = baseUrl?.trim().replace(/\/$/, "");

  return trimmed || "http://localhost:4000";
}

export function getDefaultApiBaseUrl() {
  const runtime = globalThis as unknown as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return normalizeApiBaseUrl(runtime.process?.env?.EXPO_PUBLIC_API_BASE_URL);
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl || getDefaultApiBaseUrl());
  const fetcher = options.fetcher || fetch;

  return {
    request: async <T>(path: string, requestOptions: RequestOptions = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (requestOptions.token) {
        headers.Authorization = `Bearer ${requestOptions.token}`;
      }

      const response = await fetcher(`${baseUrl}${path}`, {
        method: requestOptions.method || "GET",
        headers,
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body)
      });
      const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

      if (!response.ok) {
        throw new Error(typeof payload.message === "string" ? payload.message : "请求失败，请稍后重试。");
      }

      return payload as T;
    }
  };
}
