import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, posix } from "node:path";

interface StoredImage {
  provider: "qiniu" | "local";
  key: string;
  url: string;
}

@Injectable()
export class ImageStorageService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async storeImage(userId: string, imageUrl: string): Promise<StoredImage> {
    const image = await this.loadImage(imageUrl);
    const key = this.buildObjectKey(userId, image.extension);

    if (this.isQiniuConfigured()) {
      try {
        return await this.uploadToQiniu(key, image.buffer, image.mimeType);
      } catch {
        // 七牛失败时继续落本地，生成记录仍保留最终存储位置。
      }
    }

    return this.saveLocal(key, image.buffer);
  }

  private async loadImage(imageUrl: string) {
    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (!match) {
        throw new Error("图片数据格式无效。");
      }

      const mimeType = match[1];
      return {
        buffer: Buffer.from(match[2], "base64"),
        mimeType,
        extension: this.extensionFromMime(mimeType)
      };
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error("远端图片下载失败。");
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    const urlExtension = extname(new URL(imageUrl).pathname).replace(".", "");

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
      extension: urlExtension || this.extensionFromMime(mimeType)
    };
  }

  private async uploadToQiniu(key: string, buffer: Buffer, mimeType: string): Promise<StoredImage> {
    const token = this.createQiniuUploadToken(key);
    const fileName = posix.basename(key);
    const uploadUrl = this.normalizeUploadUrl(this.configService.get<string>("QINIU_UPLOAD_URL", "https://upload.qiniup.com"));
    const response = await this.uploadQiniuForm(uploadUrl, token, key, fileName, buffer, mimeType);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = this.extractQiniuError(payload);
      const suggestedUploadUrl = this.extractSuggestedQiniuUploadUrl(message);

      if (suggestedUploadUrl && suggestedUploadUrl !== uploadUrl) {
        const retryResponse = await this.uploadQiniuForm(suggestedUploadUrl, token, key, fileName, buffer, mimeType);
        const retryPayload = await retryResponse.json().catch(() => ({}));

        if (retryResponse.ok) {
          return {
            provider: "qiniu",
            key,
            url: this.buildQiniuUrl(key)
          };
        }

        throw new Error(this.extractQiniuError(retryPayload));
      }

      throw new Error(message);
    }

    return {
      provider: "qiniu",
      key,
      url: this.buildQiniuUrl(key)
    };
  }

  private uploadQiniuForm(uploadUrl: string, token: string, key: string, fileName: string, buffer: Buffer, mimeType: string) {
    const formData = new FormData();

    formData.set("token", token);
    formData.set("key", key);
    formData.set("file", new Blob([buffer] as unknown as BlobPart[], { type: mimeType }), fileName);

    return fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
  }

  private extractQiniuError(payload: unknown) {
    if (payload && typeof payload === "object" && "error" in payload) {
      const error = (payload as { error?: unknown }).error;

      if (typeof error === "string" && error.trim()) {
        return error.trim();
      }
    }

    return "七牛云上传失败。";
  }

  private extractSuggestedQiniuUploadUrl(message: string) {
    const match = message.match(/please use\s+([a-z0-9.-]+qiniup\.com)/i);

    if (!match?.[1]) {
      return "";
    }

    return this.normalizeUploadUrl(match[1]);
  }

  private normalizeUploadUrl(uploadUrl: string) {
    const trimmed = uploadUrl.trim().replace(/\/$/, "");

    if (!trimmed) {
      return "https://upload.qiniup.com";
    }

    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  private async saveLocal(key: string, buffer: Buffer): Promise<StoredImage> {
    const uploadRoot = this.configService.get<string>("LOCAL_UPLOAD_DIR", join(process.cwd(), "uploads"));
    const fullPath = join(uploadRoot, key);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    const publicBaseUrl = this.configService.get<string>("PUBLIC_API_BASE_URL", "http://localhost:4000").replace(/\/$/, "");

    return {
      provider: "local",
      key,
      url: `${publicBaseUrl}/uploads/${key.split("\\").join("/")}`
    };
  }

  private createQiniuUploadToken(key: string) {
    const accessKey = this.configService.getOrThrow<string>("QINIU_ACCESS_KEY");
    const secretKey = this.configService.getOrThrow<string>("QINIU_SECRET_KEY");
    const bucket = this.configService.getOrThrow<string>("QINIU_BUCKET");
    const encodedPolicy = this.urlSafeBase64(
      JSON.stringify({
        scope: `${bucket}:${key}`,
        deadline: Math.floor(Date.now() / 1000) + Number(this.configService.get("QINIU_UPLOAD_TOKEN_EXPIRES", 3600)),
        insertOnly: 1,
        mimeLimit: "image/*",
        returnBody: '{"key":"$(key)","hash":"$(etag)","bucket":"$(bucket)","fsize":$(fsize)}'
      })
    );
    const encodedSign = this.urlSafeBase64(createHmac("sha1", secretKey).update(encodedPolicy).digest());

    return `${accessKey}:${encodedSign}:${encodedPolicy}`;
  }

  private buildQiniuUrl(key: string) {
    const domain = this.configService.getOrThrow<string>("QINIU_PUBLIC_DOMAIN").replace(/\/$/, "");

    return `${domain}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  private buildObjectKey(userId: string, extension: string) {
    const prefix = this.configService.get<string>("QINIU_KEY_PREFIX", "gallery").replace(/^\/+|\/+$/g, "");
    const safeExtension = extension.replace(/^\./, "") || "png";

    return posix.join(prefix, userId, `${Date.now()}-${randomUUID()}.${safeExtension}`);
  }

  private extensionFromMime(mimeType: string) {
    const normalized = mimeType.toLowerCase();

    if (normalized.includes("jpeg")) {
      return "jpg";
    }
    if (normalized.includes("webp")) {
      return "webp";
    }
    if (normalized.includes("gif")) {
      return "gif";
    }

    return "png";
  }

  private isQiniuConfigured() {
    return Boolean(
      this.configService.get<string>("QINIU_ACCESS_KEY") &&
        this.configService.get<string>("QINIU_SECRET_KEY") &&
        this.configService.get<string>("QINIU_BUCKET") &&
        this.configService.get<string>("QINIU_PUBLIC_DOMAIN")
    );
  }

  private urlSafeBase64(input: string | Buffer) {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  }
}
