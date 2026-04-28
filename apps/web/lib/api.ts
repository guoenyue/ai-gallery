function isBrowserOnLocalhost() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && !isBrowserOnLocalhost()) {
    return "/api";
  }

  return "http://localhost:4000";
}

const API_BASE_URL = resolveApiBaseUrl();

type FetchOptions = RequestInit & {
  token?: string;
};

type StreamOptions = FetchOptions & {
  onEvent?: (event: Record<string, unknown>) => void;
};

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? "请求失败，请稍后重试。");
  }

  return payload as T;
}

export async function apiStream<T>(path: string, options: StreamOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));

    throw new Error(payload.message ?? "请求失败，请稍后重试。");
  }

  if (!response.body) {
    throw new Error("浏览器不支持流式响应。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      if (!chunk.trim()) {
        continue;
      }

      const event = parseServerSentEvent(chunk);
      options.onEvent?.(event);

      if (event.type === "done") {
        return event.data as T;
      }

      if (event.type === "error") {
        throw new Error(typeof event.message === "string" ? event.message : "请求失败，请稍后重试。");
      }
    }
  }

  throw new Error("流式响应已结束但未返回结果。");
}

function parseServerSentEvent(chunk: string): Record<string, unknown> {
  let type = "message";
  const dataLines: string[] = [];

  for (const rawLine of chunk.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      type = line.slice("event:".length).trim() || "message";
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  const dataText = dataLines.join("\n");
  const data = dataText ? JSON.parse(dataText) : {};

  return {
    ...(data && typeof data === "object" ? (data as Record<string, unknown>) : { data }),
    type
  };
}
