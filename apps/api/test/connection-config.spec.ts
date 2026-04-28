import type { ConfigService } from "@nestjs/config";
import { buildMongoUri } from "../src/common/connection-config";

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue
  } as ConfigService;
}

describe("connection config", () => {
  it("prefers configured mongodb uri", () => {
    const config = createConfig({
      MONGODB_URI: "mongodb://custom-host:27017/custom-db"
    });

    expect(buildMongoUri(config)).toBe("mongodb://custom-host:27017/custom-db");
  });

  it("builds mongodb uri from split credentials", () => {
    const config = createConfig({
      MONGODB_HOST: "db.internal",
      MONGODB_PORT: "27018",
      MONGODB_DATABASE: "gallery",
      MONGODB_USERNAME: "root",
      MONGODB_PASSWORD: "p@ss:word",
      MONGODB_AUTH_SOURCE: "admin"
    });

    expect(buildMongoUri(config)).toBe(
      "mongodb://root:p%40ss%3Aword@db.internal:27018/gallery?authSource=admin"
    );
  });
});
