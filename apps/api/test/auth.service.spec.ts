import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { constants, generateKeyPairSync, publicEncrypt } from "node:crypto";
import { AuthService } from "../src/auth/auth.service";

describe("AuthService", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });

  const createConfig = () =>
    ({
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          ADMIN_USERNAME: "admin",
          ADMIN_PASSWORD: "secret",
          ADMIN_LOGIN_RSA_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
        };
        return values[key];
      }),
      get: jest.fn((key: string) => {
        const values: Record<string, string | undefined> = {
          ADMIN_LOGIN_RSA_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
          ADMIN_LOGIN_RSA_PUBLIC_KEY: publicKey.export({ type: "spki", format: "pem" }).toString()
        };

        return values[key];
      })
    }) as unknown as ConfigService;

  it("returns a public key for the frontend to encrypt credentials", () => {
    const jwtService = {
      signAsync: jest.fn()
    } as unknown as JwtService;

    const service = new AuthService(createConfig(), jwtService);

    expect(service.getPublicKey()).toContain("BEGIN PUBLIC KEY");
  });

  it("throws a clear Chinese error when the configured RSA public key is invalid", () => {
    const jwtService = {
      signAsync: jest.fn()
    } as unknown as JwtService;
    const configService =
      ({
        getOrThrow: jest.fn((key: string) => {
          const values: Record<string, string> = {
            ADMIN_USERNAME: "admin",
            ADMIN_PASSWORD: "secret",
            ADMIN_LOGIN_RSA_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
          };
          return values[key];
        }),
        get: jest.fn((key: string) => {
          const values: Record<string, string | undefined> = {
            ADMIN_LOGIN_RSA_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
            ADMIN_LOGIN_RSA_PUBLIC_KEY: "invalid-public-key"
          };

          return values[key];
        })
      }) as unknown as ConfigService;

    const service = new AuthService(configService, jwtService);

    expect(() => service.onModuleInit()).toThrow("后台登录 RSA 公钥配置无效，请检查 ADMIN_LOGIN_RSA_PUBLIC_KEY。");
  });

  it("throws a clear Chinese error when the configured RSA private key is invalid", () => {
    const jwtService = {
      signAsync: jest.fn()
    } as unknown as JwtService;
    const configService =
      ({
        getOrThrow: jest.fn((key: string) => {
          const values: Record<string, string> = {
            ADMIN_USERNAME: "admin",
            ADMIN_PASSWORD: "secret",
            ADMIN_LOGIN_RSA_PRIVATE_KEY: "invalid-private-key"
          };
          return values[key];
        }),
        get: jest.fn((key: string) => {
          const values: Record<string, string | undefined> = {
            ADMIN_LOGIN_RSA_PRIVATE_KEY: "invalid-private-key",
            ADMIN_LOGIN_RSA_PUBLIC_KEY: undefined
          };

          return values[key];
        })
      }) as unknown as ConfigService;

    const service = new AuthService(configService, jwtService);

    expect(() => service.onModuleInit()).toThrow("后台登录 RSA 私钥配置无效，请检查 ADMIN_LOGIN_RSA_PRIVATE_KEY。");
  });

  it("does not block application startup when admin RSA private key is absent", () => {
    const jwtService = {
      signAsync: jest.fn()
    } as unknown as JwtService;
    const configService =
      ({
        get: jest.fn(() => undefined)
      }) as unknown as ConfigService;

    const service = new AuthService(configService, jwtService);

    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.getPublicKey()).toThrow("后台登录 RSA 私钥未配置，请检查 ADMIN_LOGIN_RSA_PRIVATE_KEY。");
  });

  it("returns a jwt for valid encrypted credentials", async () => {
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed-token")
    } as unknown as JwtService;

    const service = new AuthService(createConfig(), jwtService);
    const encryptedCredentials = publicEncrypt(
      {
        key: publicKey.export({ type: "spki", format: "pem" }).toString(),
        oaepHash: "sha256",
        padding: constants.RSA_PKCS1_OAEP_PADDING
      },
      Buffer.from(JSON.stringify({ username: "admin", password: "secret" }))
    ).toString("base64");

    await expect(service.login({ encryptedCredentials })).resolves.toEqual({
      accessToken: "signed-token"
    });
  });

  it("rejects invalid credentials", async () => {
    const jwtService = {
      signAsync: jest.fn()
    } as unknown as JwtService;

    const service = new AuthService(createConfig(), jwtService);
    const encryptedCredentials = publicEncrypt(
      {
        key: publicKey.export({ type: "spki", format: "pem" }).toString(),
        oaepHash: "sha256",
        padding: constants.RSA_PKCS1_OAEP_PADDING
      },
      Buffer.from(JSON.stringify({ username: "admin", password: "wrong" }))
    ).toString("base64");

    await expect(service.login({ encryptedCredentials })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
