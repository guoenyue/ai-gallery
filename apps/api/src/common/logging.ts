const REDACTED_KEYS = new Set([
  "authorization",
  "password",
  "seasoninfo",
  "sessioninfo",
  "session_info",
  "token",
  "encryptedcredentials",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "sourceimagedata",
  "x-openai-api-key",
  "qiniu_access_key",
  "qiniu_secret_key"
]);

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? "[已脱敏]" : redactForLog(entryValue)
      ])
    );
  }

  return value;
}
