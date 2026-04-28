import { apiFetch } from "./api";

describe("apiFetch", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation
    });
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("发起请求时携带认证头和 JSON 内容类型", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    }) as typeof fetch;

    await apiFetch("/demo", {
      method: "POST",
      token: "secret-token",
      body: JSON.stringify({
        prompt: "a cinematic neon city",
        model: "gpt-image-2",
        password: "sensitive-password"
      })
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/demo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "a cinematic neon city",
          model: "gpt-image-2",
          password: "sensitive-password"
        }),
        headers: expect.any(Headers)
      })
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer secret-token");
  });

  it("线上浏览器中自动走同域 /api", async () => {
    delete (window as unknown as { location?: Location }).location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hostname: "gallery.example.com"
      }
    });
    const { apiFetch: runtimeApiFetch } = await import("./api");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    }) as typeof fetch;

    await runtimeApiFetch("/demo");

    expect(global.fetch).toHaveBeenCalledWith("/api/demo", expect.any(Object));
  });
});
