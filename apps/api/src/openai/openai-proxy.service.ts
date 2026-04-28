import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Agent, fetch as undiciFetch } from "undici";
import { ImageGenerationDto } from "./dto/image-generation.dto";

export type OpenAIStreamDebugEvent = {
  event: string;
  keys: string[];
  hasImage: boolean;
  b64JsonLength: number;
  urlPreview: string;
};

type UpstreamResponse = {
  ok: boolean;
  status: number;
  headers: {
    get(name: string): string | null;
  };
  body: {
    getReader(): ReadableStreamDefaultReader<Uint8Array>;
  } | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type UpstreamErrorPayload = {
  error?: unknown;
  message?: unknown;
  detail?: unknown;
  error_description?: unknown;
  code?: unknown;
  raw?: string;
  [key: string]: unknown;
};

@Injectable()
export class OpenAIProxyService {
  private upstreamAgent?: Agent;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async generateImage(
    dto: ImageGenerationDto,
    clientApiKey?: string,
    clientBaseUrl?: string,
    onStreamEvent?: (event: OpenAIStreamDebugEvent) => void
  ) {
    const apiKey = clientApiKey?.trim() || this.configService.get<string>("OPENAI_API_KEY")?.trim();

    if (!apiKey) {
      throw new UnauthorizedException("缺少 OpenAI API Key。");
    }

    const upstreamBaseUrl = this.resolveUpstreamBaseUrl(clientBaseUrl || dto.baseUrl);
    const upstreamUrl = `${upstreamBaseUrl.replace(/\/$/, "")}/images/generations`;
    const useStream = this.configService.get<string>("OPENAI_IMAGE_STREAM", "true") !== "false";
    const requestBody = {
      model: dto.model || "gpt-image-2",
      prompt: this.buildServiceCompatiblePrompt(dto.prompt),
      n: 1,
      size: dto.size || "1024x1024",
      response_format: "b64_json",
      ...(useStream
        ? {
            stream: true,
            partial_images: Number(this.configService.get<string>("OPENAI_IMAGE_PARTIAL_IMAGES", "1"))
          }
        : {})
    };

    const response = await this.fetchUpstream(
      upstreamUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: useStream ? "text/event-stream" : "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (useStream) {
      return this.readImageStream(response, "OpenAI 图片生成失败。", onStreamEvent);
    }

    if (!response.ok) {
      const payload = await this.readUpstreamErrorPayload(response);

      throw new BadRequestException(this.extractUpstreamErrorMessage(payload, "OpenAI 图片生成失败。"));
    }

    const payload = await response.json().catch(() => ({}));

    return payload;
  }

  async editImage(
    dto: ImageGenerationDto,
    clientApiKey?: string,
    clientBaseUrl?: string,
    onStreamEvent?: (event: OpenAIStreamDebugEvent) => void
  ) {
    const apiKey = clientApiKey?.trim() || this.configService.get<string>("OPENAI_API_KEY")?.trim();

    if (!apiKey) {
      throw new UnauthorizedException("缺少 OpenAI API Key。");
    }

    if (!dto.imageUrl) {
      throw new BadRequestException("缺少图生图参考图。");
    }

    const upstreamBaseUrl = this.resolveUpstreamBaseUrl(clientBaseUrl || dto.baseUrl);
    const upstreamUrl = `${upstreamBaseUrl.replace(/\/$/, "")}/images/edits`;
    const useStream = this.configService.get<string>("OPENAI_IMAGE_EDIT_STREAM", "true") !== "false";
    const image = await this.loadImage(dto.imageUrl);
    const formData = new FormData();

    formData.set("model", dto.model || "gpt-image-2");
    formData.set("prompt", this.buildServiceCompatiblePrompt(dto.prompt));
    formData.set("n", "1");
    formData.set("size", dto.size || "1024x1024");
    formData.set("response_format", "b64_json");
    if (useStream) {
      formData.set("stream", "true");
    }
    formData.set("image", new Blob([image.buffer] as unknown as BlobPart[], { type: image.mimeType }), image.fileName);

    const response = await this.fetchUpstream(
      upstreamUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: useStream ? "text/event-stream" : "application/json"
        },
        body: formData
      }
    );

    if (useStream) {
      return this.readImageStream(response, "OpenAI 图片编辑失败。", onStreamEvent);
    }

    if (!response.ok) {
      const payload = await this.readUpstreamErrorPayload(response);

      throw new BadRequestException(this.extractUpstreamErrorMessage(payload, "OpenAI 图片编辑失败。"));
    }

    const payload = await response.json().catch(() => ({}));

    return payload;
  }

  private resolveUpstreamBaseUrl(clientBaseUrl?: string) {
    const configuredBaseUrl = clientBaseUrl?.trim() || this.configService.get<string>("OPENAI_IMAGE_BASE_URL", "https://sub.appdock.cn/v1");
    const normalized = configuredBaseUrl.trim().replace(/\/$/, "");

    if (!/^https?:\/\/[^/]+/i.test(normalized)) {
      throw new BadRequestException("OpenAI Base URL 必须是 http(s) 地址。");
    }

    return normalized;
  }

  private async loadImage(imageUrl: string) {
    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (!match) {
        throw new BadRequestException("参考图数据格式无效。");
      }

      return {
        buffer: Buffer.from(match[2], "base64"),
        mimeType: match[1],
        fileName: `reference.${this.extensionFromMime(match[1])}`
      };
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new BadRequestException("参考图读取失败。");
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    const pathname = new URL(imageUrl).pathname;
    const fileName = pathname.split("/").filter(Boolean).pop() || `reference.${this.extensionFromMime(mimeType)}`;

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
      fileName
    };
  }

  private extensionFromMime(mimeType: string) {
    const normalized = mimeType.toLowerCase();

    if (normalized.includes("jpeg")) {
      return "jpg";
    }
    if (normalized.includes("webp")) {
      return "webp";
    }

    return "png";
  }

  private async fetchUpstream(url: string, init: RequestInit) {
    const startedAt = Date.now();

    try {
      return await this.fetchWithOptionalDispatcher(url, init, true);
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      if (durationMs < 1000) {
        return this.fetchWithOptionalDispatcher(url, init, false);
      }

      throw error;
    }
  }

  private fetchWithOptionalDispatcher(url: string, init: RequestInit, useDispatcher: boolean) {
    if (!useDispatcher) {
      return fetch(url, init);
    }

    return undiciFetch(url, {
      ...init,
      dispatcher: this.getUpstreamAgent()
    } as Parameters<typeof undiciFetch>[1] & { dispatcher: Agent });
  }

  private getUpstreamAgent() {
    if (!this.upstreamAgent) {
      const timeoutMs = Number(this.configService.get<string>("OPENAI_UPSTREAM_TIMEOUT_MS", "600000"));

      this.upstreamAgent = new Agent({
        connectTimeout: Math.min(timeoutMs, 60000),
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs
      });
    }

    return this.upstreamAgent;
  }

  private async readImageStream(response: UpstreamResponse, fallbackMessage: string, onStreamEvent?: (event: OpenAIStreamDebugEvent) => void) {
    if (!response.ok) {
      const payload = await this.readUpstreamErrorPayload(response);

      throw new BadRequestException(this.extractUpstreamErrorMessage(payload, fallbackMessage));
    }

    if (!response.body) {
      throw new BadRequestException("上游未返回流式响应。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastPayload: unknown;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const chunks = buffer.includes("\n\n") ? buffer.split("\n\n") : buffer.split("\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const payload = this.parseStreamChunk(chunk);

        if (!payload) {
          continue;
        }

        if (this.isDonePayload(payload)) {
          continue;
        }

        const eventType = this.getPayloadEventType(payload);

        if (this.isErrorPayload(payload, eventType)) {
          throw new BadRequestException(this.extractUpstreamErrorMessage(payload, fallbackMessage));
        }

        onStreamEvent?.(this.buildStreamDebugEvent(payload));

        if (eventType.includes("partial_image")) {
          lastPayload = payload;
          continue;
        }

        if (this.isFinalImagePayload(payload)) {
          return this.normalizeImagePayload(payload);
        }

        lastPayload = payload;
      }
    }

    if (lastPayload && this.extractImageUrl(lastPayload)) {
      return this.normalizeImagePayload(lastPayload);
    }

    throw new BadRequestException("上游流式响应中未找到图片。");
  }

  private async readUpstreamErrorPayload(response: UpstreamResponse): Promise<UpstreamErrorPayload> {
    const text = await response.text().catch(() => "");

    if (!text) {
      return {};
    }

    try {
      const payload = JSON.parse(text);

      return payload && typeof payload === "object" ? (payload as UpstreamErrorPayload) : { raw: text };
    } catch {
      return {
        raw: text.slice(0, 2000)
      };
    }
  }

  private isErrorPayload(payload: unknown, eventType: string) {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    return eventType.includes("error") || "error" in payload || "error_description" in payload;
  }

  private extractUpstreamErrorMessage(payload: unknown, fallbackMessage: string) {
    if (!payload || typeof payload !== "object") {
      return fallbackMessage;
    }

    const record = payload as UpstreamErrorPayload;
    const error = record.error;
    const errorRecord = error && typeof error === "object" ? (error as Record<string, unknown>) : undefined;
    const candidates = [
      errorRecord?.message,
      errorRecord?.detail,
      typeof error === "string" ? error : undefined,
      record.message,
      record.error_description,
      record.detail,
      record.raw
    ];
    const message = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
    const codeCandidate = errorRecord?.code ?? record.code;
    const code = typeof codeCandidate === "string" && codeCandidate.trim() ? codeCandidate.trim() : "";

    if (typeof message === "string") {
      const trimmed = message.trim();

      return code && !trimmed.includes(code) ? `${trimmed} (${code})` : trimmed;
    }

    return fallbackMessage;
  }

  private parseStreamChunk(chunk: string) {
    const trimmed = chunk.trim();

    if (!trimmed) {
      return undefined;
    }

    const dataLines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim());
    const eventLine = trimmed
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("event:"));
    const event = eventLine?.slice("event:".length).trim();
    const dataText = dataLines.length > 0 ? dataLines.join("\n") : trimmed;

    if (!dataText || dataText === "[DONE]") {
      return { done: true };
    }

    try {
      const payload = JSON.parse(dataText);

      return payload && typeof payload === "object"
        ? {
            ...(payload as Record<string, unknown>),
            ...(event ? { event } : {})
          }
        : payload;
    } catch {
      return undefined;
    }
  }

  private isDonePayload(payload: unknown) {
    return Boolean(payload && typeof payload === "object" && "done" in payload);
  }

  private normalizeImagePayload(payload: unknown) {
    if (payload && typeof payload === "object" && "data" in payload) {
      return payload;
    }

    return {
      data: [payload]
    };
  }

  private isFinalImagePayload(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    const eventType = this.getPayloadEventType(payload);

    if (eventType.includes("partial_image")) {
      return false;
    }

    if (eventType.includes("completed")) {
      return Boolean(this.extractImageUrl(payload));
    }

    return Boolean(this.extractImageUrl(payload));
  }

  private getPayloadEventType(payload: unknown) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const record = payload as Record<string, unknown>;

    return typeof record.event === "string" ? record.event : typeof record.type === "string" ? record.type : "";
  }

  private buildStreamDebugEvent(payload: unknown): OpenAIStreamDebugEvent {
    const event = this.getPayloadEventType(payload) || "message";
    const keys = payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>).filter((key) => key !== "b64_json") : [];
    const imageInfo = this.extractImageInfo(payload);

    return {
      event,
      keys,
      hasImage: Boolean(imageInfo.b64JsonLength || imageInfo.urlPreview),
      b64JsonLength: imageInfo.b64JsonLength,
      urlPreview: imageInfo.urlPreview
    };
  }

  private extractImageUrl(payload: unknown): string {
    const imageInfo = this.extractImageInfo(payload);

    return imageInfo.b64JsonLength ? "b64_json" : imageInfo.urlPreview;
  }

  private extractImageInfo(payload: unknown): { b64JsonLength: number; urlPreview: string } {
    if (!payload || typeof payload !== "object") {
      return { b64JsonLength: 0, urlPreview: "" };
    }

    const record = payload as Record<string, unknown>;
    const data = Array.isArray(record.data) ? record.data : [record];

    for (const item of data) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const image = item as Record<string, unknown>;

      if (typeof image.b64_json === "string" && image.b64_json) {
        return { b64JsonLength: image.b64_json.length, urlPreview: "" };
      }
      if (typeof image.url === "string" && image.url) {
        return { b64JsonLength: 0, urlPreview: image.url.slice(0, 120) };
      }
    }

    return { b64JsonLength: 0, urlPreview: "" };
  }

  private buildServiceCompatiblePrompt(prompt: string) {
    const trimmed = prompt.trim();

    if (!/[^\x00-\x7F]/.test(trimmed)) {
      return trimmed;
    }

    const encoded = Array.from(trimmed)
      .map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`)
      .join(" ");

    return [
      "The user's visual prompt is encoded below as Unicode code points.",
      "Decode the code points exactly to the original text before generating the image.",
      "Use the decoded text as the complete image prompt.",
      "Do not render the code points or mention this encoding unless the decoded prompt asks for text.",
      `Encoded prompt: ${encoded}`
    ].join("\n");
  }
}
