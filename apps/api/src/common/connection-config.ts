import type { ConfigService } from "@nestjs/config";

function encodeCredential(value?: string) {
  return value ? encodeURIComponent(value) : "";
}

export function buildMongoUri(configService: ConfigService) {
  const directUri = configService.get<string>("MONGODB_URI");

  if (directUri) {
    return directUri;
  }

  const host = configService.get("MONGODB_HOST", "127.0.0.1");
  const port = configService.get("MONGODB_PORT", "27017");
  const database = configService.get("MONGODB_DATABASE", "ai-gallery");
  const username = configService.get<string>("MONGODB_USERNAME");
  const password = configService.get<string>("MONGODB_PASSWORD");
  const authSource = configService.get<string>("MONGODB_AUTH_SOURCE");
  const credentials =
    username && password ? `${encodeCredential(username)}:${encodeCredential(password)}@` : "";
  const authQuery = authSource ? `?authSource=${encodeURIComponent(authSource)}` : "";

  return `mongodb://${credentials}${host}:${port}/${database}${authQuery}`;
}
