import assert from "node:assert/strict";
import { createApiClient, normalizeApiBaseUrl } from "./api-client";

async function testNormalizeApiBaseUrl() {
  assert.equal(normalizeApiBaseUrl("http://192.168.1.8:4000/"), "http://192.168.1.8:4000");
  assert.equal(normalizeApiBaseUrl(""), "http://localhost:4000");
}

async function testAuthHeaderAndJsonBody() {
  const calls: Array<[string, RequestInit]> = [];
  const client = createApiClient({
    baseUrl: "http://api.example.com/",
    fetcher: async (url, init) => {
      calls.push([String(url), init || {}]);
      return {
        ok: true,
        json: async () => ({ ok: true })
      } as Response;
    }
  });

  const result = await client.request<{ ok: boolean }>("/gallery/config", {
    method: "POST",
    token: "token-1",
    body: {
      baseUrl: "https://sub.appdock.cn/v1"
    }
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0][0], "http://api.example.com/gallery/config");
  const headers = calls[0][1].headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer token-1");
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(calls[0][1].body, JSON.stringify({ baseUrl: "https://sub.appdock.cn/v1" }));
}

async function testErrorMessage() {
  const client = createApiClient({
    baseUrl: "http://api.example.com",
    fetcher: async () =>
      ({
        ok: false,
        json: async () => ({ message: "登录失败" })
      }) as Response
  });

  await assert.rejects(() => client.request("/users/login"), /登录失败/);
}

async function main() {
  await testNormalizeApiBaseUrl();
  await testAuthHeaderAndJsonBody();
  await testErrorMessage();
}

void main();
