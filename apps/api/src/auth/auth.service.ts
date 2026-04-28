import { Inject, Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { constants, createPrivateKey, createPublicKey, privateDecrypt } from "node:crypto";
import { LoginDto } from "./dto/login.dto";
import { derivePublicKeyFromPrivateKey, normalizePemKey } from "./rsa-key.util";

@Injectable()
export class AuthService implements OnModuleInit {
  private validatedPrivateKey?: string;
  private validatedPublicKey?: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(JwtService) private readonly jwtService: JwtService
  ) {}

  onModuleInit() {
    if (!this.configService.get<string>("ADMIN_LOGIN_RSA_PRIVATE_KEY")) {
      return;
    }

    this.getValidatedPrivateKey();
    this.getValidatedPublicKey();
  }

  getPublicKey() {
    return this.getValidatedPublicKey();
  }

  async login(dto: LoginDto) {
    const adminUsername = this.configService.getOrThrow<string>("ADMIN_USERNAME");
    const adminPassword = this.configService.getOrThrow<string>("ADMIN_PASSWORD");
    const privateKey = this.getValidatedPrivateKey();
    const { username, password } = this.decryptCredentials(dto.encryptedCredentials, privateKey);

    if (username !== adminUsername || password !== adminPassword) {
      throw new UnauthorizedException("用户名或密码错误。");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: "admin",
      username,
      role: "admin"
    });

    return { accessToken };
  }

  private decryptCredentials(encryptedCredentials: string, privateKey: string) {
    try {
      const decrypted = privateDecrypt(
        {
          key: privateKey,
          oaepHash: "sha256",
          padding: constants.RSA_PKCS1_OAEP_PADDING
        },
        Buffer.from(encryptedCredentials, "base64")
      ).toString("utf8");
      const parsed = JSON.parse(decrypted) as {
        username?: string;
        password?: string;
      };

      if (!parsed.username || !parsed.password) {
        throw new Error("missing credentials");
      }

      return {
        username: parsed.username,
        password: parsed.password
      };
    } catch {
      throw new UnauthorizedException("登录凭证解密失败。");
    }
  }

  private getValidatedPrivateKey() {
    if (this.validatedPrivateKey) {
      return this.validatedPrivateKey;
    }

    const configuredPrivateKey = this.configService.get<string>("ADMIN_LOGIN_RSA_PRIVATE_KEY");

    if (!configuredPrivateKey) {
      throw new Error("后台登录 RSA 私钥未配置，请检查 ADMIN_LOGIN_RSA_PRIVATE_KEY。");
    }

    const privateKey = normalizePemKey(configuredPrivateKey);

    try {
      createPrivateKey(privateKey);
    } catch {
      throw new Error("后台登录 RSA 私钥配置无效，请检查 ADMIN_LOGIN_RSA_PRIVATE_KEY。");
    }

    this.validatedPrivateKey = privateKey;
    return privateKey;
  }

  private getValidatedPublicKey() {
    if (this.validatedPublicKey) {
      return this.validatedPublicKey;
    }

    const configuredPublicKey = this.configService.get<string>("ADMIN_LOGIN_RSA_PUBLIC_KEY");

    if (configuredPublicKey) {
      const normalizedPublicKey = normalizePemKey(configuredPublicKey);

      try {
        createPublicKey(normalizedPublicKey);
      } catch {
        throw new Error("后台登录 RSA 公钥配置无效，请检查 ADMIN_LOGIN_RSA_PUBLIC_KEY。");
      }

      this.validatedPublicKey = normalizedPublicKey;
      return normalizedPublicKey;
    }

    this.validatedPublicKey = derivePublicKeyFromPrivateKey(this.getValidatedPrivateKey()).toString();
    return this.validatedPublicKey;
  }
}
