import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AdminGalleryQueryDto } from "./dto/admin-gallery-query.dto";
import { GenerateGalleryPhotoDto } from "./dto/generate-gallery-photo.dto";
import { UpdateGalleryDemoDto } from "./dto/update-gallery-demo.dto";
import { UpdateGalleryConfigDto } from "./dto/update-gallery-config.dto";
import { GalleryConfig, GalleryConfigDocument } from "./gallery-config.schema";
import { GalleryPhoto, GalleryPhotoDocument } from "./gallery-photo.schema";
import { ImageStorageService } from "./image-storage.service";
import { OpenAIProxyService } from "../openai/openai-proxy.service";
import type { OpenAIStreamDebugEvent } from "../openai/openai-proxy.service";
import { UserAccount, UserAccountDocument } from "../users/user.schema";

type SourceImage = {
  inputImageUrl: string;
  sourcePhotoId?: string;
  sourceImageUrl: string;
  sourceStorageProvider: "qiniu" | "local" | "none";
  sourceStorageKey: string;
};

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_OPENAI_BASE_URL = "https://sub.appdock.cn/v1";
const SUPPORTED_IMAGE_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class GalleryService {
  constructor(
    @InjectModel(GalleryPhoto.name) private readonly photoModel: Model<GalleryPhotoDocument>,
    @InjectModel(GalleryConfig.name) private readonly configModel: Model<GalleryConfigDocument>,
    @InjectModel(UserAccount.name) private readonly userModel: Model<UserAccountDocument>,
    @Inject(OpenAIProxyService) private readonly openaiProxyService: OpenAIProxyService,
    @Inject(ImageStorageService) private readonly imageStorageService: ImageStorageService
  ) {}

  async listPhotos(userId: string) {
    const photos = await this.photoModel.find({ userId }).sort({ createdAt: -1 }).lean();

    return photos.map((photo) => this.serializePhoto(photo));
  }

  async generatePhoto(userId: string, dto: GenerateGalleryPhotoDto, options: { onStreamEvent?: (event: OpenAIStreamDebugEvent) => void } = {}) {
    const config = await this.getConfig(userId);
    const model = dto.model?.trim() || config.model;
    const aspectRatio = dto.aspectRatio?.trim() || "";
    const layout = dto.layout?.trim() || "";
    const sizeConfig = this.resolveGenerationSize(dto.size, config.size, aspectRatio);
    const size = sizeConfig.size;
    const baseUrl = dto.baseUrl?.trim() || config.baseUrl;
    const requestedResolution = dto.resolution?.trim() || "";
    const resolution = requestedResolution || sizeConfig.promptResolution || size;
    const resolutionPrompt = this.isSupportedImageSize(requestedResolution) ? sizeConfig.promptResolution : requestedResolution || sizeConfig.promptResolution;
    const prompt = dto.prompt.trim();
    let source: SourceImage | undefined;

    try {
      source = await this.resolveSourceImage(userId, dto);

      return await this.createGenerationRecord(userId, {
        prompt,
        model,
        size,
        aspectRatio,
        layout,
        resolution,
        resolutionPrompt,
        apiKey: dto.apiKey || config.apiKey,
        baseUrl,
        source,
        onStreamEvent: options.onStreamEvent
      });
    } catch (error) {
      const failure = await this.photoModel.create({
        userId,
        prompt,
        imageUrl: "",
        status: "failed",
        operation: source || dto.sourcePhotoId || dto.sourceImageData ? "edit" : "generate",
        storageProvider: "none",
        storageKey: "",
        model,
        size,
        aspectRatio,
        layout,
        resolution,
        baseUrl,
        sourcePhotoId: source?.sourcePhotoId ?? "",
        sourceImageUrl: source?.sourceImageUrl ?? "",
        sourceStorageProvider: source?.sourceStorageProvider ?? "none",
        sourceStorageKey: source?.sourceStorageKey ?? "",
        errorMessage: error instanceof Error ? error.message : "图片生成失败。"
      });

      return this.serializePhoto(failure);
    }
  }

  async retryPhoto(userId: string, photoId: string) {
    const sourcePhoto = await this.photoModel.findOne({ _id: photoId, userId }).lean();

    if (!sourcePhoto) {
      throw new NotFoundException("作品不存在。");
    }

    const config = await this.getConfig(userId);
    const aspectRatio = sourcePhoto.aspectRatio || "";
    const sizeConfig = this.resolveGenerationSize(sourcePhoto.size, config.size, aspectRatio);
    const requestedResolution = sourcePhoto.resolution || "";
    const resolutionPrompt = this.isSupportedImageSize(requestedResolution) ? sizeConfig.promptResolution : requestedResolution || sizeConfig.promptResolution;
    const source = sourcePhoto.sourceImageUrl
      ? {
          inputImageUrl: sourcePhoto.sourceImageUrl,
          sourcePhotoId: sourcePhoto.sourcePhotoId || undefined,
          sourceImageUrl: sourcePhoto.sourceImageUrl,
          sourceStorageProvider: sourcePhoto.sourceStorageProvider || "none",
          sourceStorageKey: sourcePhoto.sourceStorageKey || ""
        }
      : undefined;

    try {
      return await this.createGenerationRecord(userId, {
        prompt: sourcePhoto.prompt,
        model: sourcePhoto.model || config.model,
        size: sizeConfig.size,
        aspectRatio,
        layout: sourcePhoto.layout || "",
        resolution: requestedResolution || sizeConfig.promptResolution || sizeConfig.size,
        resolutionPrompt,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        source
      });
    } catch (error) {
      const failure = await this.photoModel.create({
        userId,
        prompt: sourcePhoto.prompt,
        imageUrl: "",
        status: "failed",
        operation: source ? "edit" : "generate",
        storageProvider: "none",
        storageKey: "",
        model: sourcePhoto.model || config.model,
        size: sizeConfig.size,
        aspectRatio,
        layout: sourcePhoto.layout || "",
        resolution: requestedResolution || sizeConfig.promptResolution || sizeConfig.size,
        baseUrl: config.baseUrl,
        sourcePhotoId: source?.sourcePhotoId ?? "",
        sourceImageUrl: source?.sourceImageUrl ?? "",
        sourceStorageProvider: source?.sourceStorageProvider ?? "none",
        sourceStorageKey: source?.sourceStorageKey ?? "",
        errorMessage: error instanceof Error ? error.message : "图片生成失败。"
      });

      return this.serializePhoto(failure);
    }
  }

  async deletePhoto(userId: string, photoId: string) {
    const deleted = await this.photoModel.findOneAndDelete({ _id: photoId, userId });

    if (!deleted) {
      throw new NotFoundException("作品不存在。");
    }

    return {
      success: true
    };
  }

  async listDemoPhotos() {
    const photos = await this.photoModel
      .find({
        isDemo: true,
        status: "succeeded",
        imageUrl: { $ne: "" }
      })
      .sort({ demoOrder: 1, createdAt: -1 })
      .limit(24)
      .lean();

    return photos.map((photo) => this.serializePhoto(photo));
  }

  async updateDemoStatus(photoId: string, dto: UpdateGalleryDemoDto) {
    const updated = await this.photoModel.findOneAndUpdate(
      {
        _id: photoId,
        status: "succeeded",
        imageUrl: { $ne: "" }
      },
      {
        $set: {
          isDemo: dto.isDemo,
          demoOrder: dto.demoOrder ?? 0
        }
      },
      {
        new: true
      }
    );

    if (!updated) {
      throw new NotFoundException("可展示作品不存在。");
    }

    return this.serializePhoto(updated);
  }

  async getConfig(userId: string) {
    const config = await this.configModel.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          model: "gpt-image-2",
          size: DEFAULT_IMAGE_SIZE,
          apiKey: "",
          baseUrl: ""
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return this.serializeConfig(config);
  }

  async updateConfig(userId: string, dto: UpdateGalleryConfigDto) {
    const config = await this.configModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          model: dto.model?.trim() || "gpt-image-2",
          size: this.normalizeImageSize(dto.size),
          apiKey: dto.apiKey?.trim() || "",
          baseUrl: this.normalizeBaseUrl(dto.baseUrl)
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return this.serializeConfig(config);
  }

  async getAdminPhotos(query: AdminGalleryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = query.keyword?.trim();
    const filter = keyword
      ? {
          $or: [
            { prompt: { $regex: keyword, $options: "i" } },
            { model: { $regex: keyword, $options: "i" } },
            { storageProvider: { $regex: keyword, $options: "i" } },
            { status: { $regex: keyword, $options: "i" } },
            { operation: { $regex: keyword, $options: "i" } },
            { errorMessage: { $regex: keyword, $options: "i" } }
          ]
        }
      : {};
    const [records, total, summary] = await Promise.all([
      this.photoModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.photoModel.countDocuments(filter),
      this.photoModel.aggregate<{ total: number; qiniu: number; local: number; succeeded: number; failed: number }>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            qiniu: { $sum: { $cond: [{ $eq: ["$storageProvider", "qiniu"] }, 1, 0] } },
            local: { $sum: { $cond: [{ $eq: ["$storageProvider", "local"] }, 1, 0] } },
            succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
          }
        }
      ])
    ]);
    const users = await this.userModel
      .find({ _id: { $in: [...new Set(records.map((record) => record.userId))] } })
      .select({ email: 1, displayName: 1 })
      .lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const counts = summary[0] ?? { total: 0, qiniu: 0, local: 0, succeeded: 0, failed: 0 };

    return {
      records: records.map((record) => {
        const user = userMap.get(record.userId);

        return {
          ...this.serializePhoto(record),
          user: {
            id: record.userId,
            email: user?.email ?? "",
            displayName: user?.displayName ?? ""
          }
        };
      }),
      pagination: {
        page,
        pageSize,
        total
      },
      summary: counts
    };
  }

  private async createGenerationRecord(
    userId: string,
    options: {
      prompt: string;
      model: string;
      size: string;
      aspectRatio?: string;
      layout?: string;
      resolution?: string;
      resolutionPrompt?: string;
      apiKey?: string;
      baseUrl?: string;
      source?: SourceImage;
      onStreamEvent?: (event: OpenAIStreamDebugEvent) => void;
    }
  ) {
    const prompt = this.buildPromptWithGenerationOptions(options.prompt, {
      aspectRatio: options.aspectRatio,
      layout: options.layout,
      resolution: options.resolutionPrompt
    });
    const response = options.source
      ? await this.openaiProxyService.editImage(
          {
            prompt,
            model: options.model,
            size: this.normalizeImageSize(options.size),
            n: 1,
            output_format: "png",
            imageUrl: options.source.inputImageUrl
          },
          options.apiKey,
          options.baseUrl,
          options.onStreamEvent
        )
      : await this.openaiProxyService.generateImage(
          {
            prompt,
            model: options.model,
            size: this.normalizeImageSize(options.size),
            n: 1,
            output_format: "png"
          },
          options.apiKey,
          options.baseUrl,
          options.onStreamEvent
        );
    const generatedImageUrl = this.pickImageUrl(response);
    const storedImage = await this.imageStorageService.storeImage(userId, generatedImageUrl);
    const photo = await this.photoModel.create({
      userId,
      prompt: options.prompt,
      imageUrl: storedImage.url,
      status: "succeeded",
      operation: options.source ? "edit" : "generate",
      storageProvider: storedImage.provider,
      storageKey: storedImage.key,
      model: options.model,
      size: this.normalizeImageSize(options.size),
      aspectRatio: options.aspectRatio ?? "",
      layout: options.layout ?? "",
      resolution: options.resolution ?? "",
      baseUrl: options.baseUrl ?? "",
      sourcePhotoId: options.source?.sourcePhotoId ?? "",
      sourceImageUrl: options.source?.sourceImageUrl ?? "",
      sourceStorageProvider: options.source?.sourceStorageProvider ?? "none",
      sourceStorageKey: options.source?.sourceStorageKey ?? ""
    });

    return this.serializePhoto(photo);
  }

  private async resolveSourceImage(userId: string, dto: GenerateGalleryPhotoDto): Promise<SourceImage | undefined> {
    if (dto.sourceImageData?.trim()) {
      const sourceImageData = dto.sourceImageData.trim();

      if (this.getDataUrlByteLength(sourceImageData) > MAX_REFERENCE_IMAGE_BYTES) {
        throw new BadRequestException("参考图大小不能超过 2MB，请压缩后重新上传。");
      }

      const storedSource = await this.imageStorageService.storeImage(userId, sourceImageData);

      return {
        inputImageUrl: sourceImageData,
        sourceImageUrl: storedSource.url,
        sourceStorageProvider: storedSource.provider,
        sourceStorageKey: storedSource.key
      };
    }

    if (!dto.sourcePhotoId?.trim()) {
      return undefined;
    }

    const sourcePhoto = await this.photoModel.findOne({ _id: dto.sourcePhotoId.trim(), userId }).lean();

    if (!sourcePhoto?.imageUrl || sourcePhoto.status === "failed") {
      throw new NotFoundException("参考作品不存在。");
    }

    return {
      inputImageUrl: sourcePhoto.imageUrl,
      sourcePhotoId: sourcePhoto._id.toString(),
      sourceImageUrl: sourcePhoto.imageUrl,
      sourceStorageProvider: sourcePhoto.storageProvider || "none",
      sourceStorageKey: sourcePhoto.storageKey || ""
    };
  }

  private getDataUrlByteLength(dataUrl: string) {
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);

    if (!match) {
      return Buffer.byteLength(dataUrl, "utf8");
    }

    return Buffer.byteLength(match[1], "base64");
  }

  private pickImageUrl(response: { data?: Array<{ b64_json?: string; url?: string }> }) {
    const image = response.data?.[0];
    const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;

    if (!imageUrl) {
      throw new Error("OpenAI 响应中未找到图片。");
    }

    return imageUrl;
  }

  private buildPromptWithGenerationOptions(
    prompt: string,
    options: {
      aspectRatio?: string;
      layout?: string;
      resolution?: string;
    }
  ) {
    const additions = [
      options.aspectRatio ? `Use an ${options.aspectRatio} visual composition if the requested API size cannot exactly match it.` : "",
      options.layout ? `Layout/composition guidance: ${options.layout}.` : "",
      options.resolution ? `Resolution/detail preference: ${options.resolution}. Treat this as prompt guidance because it is not an API size parameter.` : ""
    ].filter(Boolean);

    if (additions.length === 0) {
      return prompt;
    }

    return [prompt, "", "Generation settings:", ...additions].join("\n");
  }

  private serializePhoto(
    photo: (GalleryPhotoDocument & { createdAt?: Date }) | (GalleryPhoto & { _id?: { toString(): string }; id?: string; createdAt?: Date })
  ) {
    return {
      id: photo._id?.toString?.() ?? photo.id,
      prompt: photo.prompt,
      imageUrl: photo.imageUrl || "",
      status: photo.status || "succeeded",
      operation: photo.operation || "generate",
      storageProvider: photo.storageProvider || "none",
      storageKey: photo.storageKey || "",
      createdAt: photo.createdAt,
      errorMessage: photo.errorMessage || "",
      sourcePhotoId: photo.sourcePhotoId || "",
      sourceImageUrl: photo.sourceImageUrl || "",
      sourceStorageProvider: photo.sourceStorageProvider || "none",
      sourceStorageKey: photo.sourceStorageKey || "",
      config: {
        model: photo.model,
        size: photo.size,
        aspectRatio: photo.aspectRatio || "",
        layout: photo.layout || "",
        resolution: photo.resolution || "",
        baseUrl: photo.baseUrl || ""
      },
      isDemo: Boolean(photo.isDemo),
      demoOrder: photo.demoOrder || 0
    };
  }

  private serializeConfig(config: GalleryConfigDocument | GalleryConfig) {
    return {
      model: config.model || "gpt-image-2",
      size: this.normalizeImageSize(config.size),
      apiKey: config.apiKey || "",
      baseUrl: config.baseUrl || ""
    };
  }

  private normalizeBaseUrl(baseUrl?: string) {
    const trimmed = baseUrl?.trim() || "";

    if (!trimmed) {
      return "";
    }

    const normalized = trimmed.replace(/\/$/, "");

    if (!/^https?:\/\/[^/]+/i.test(normalized)) {
      throw new BadRequestException("OpenAI Base URL 必须是 http(s) 地址。");
    }

    return normalized || DEFAULT_OPENAI_BASE_URL;
  }

  private resolveGenerationSize(requestedSize?: string, fallbackSize?: string, aspectRatio?: string) {
    const trimmedSize = requestedSize?.trim() || "";
    const aspectSize = this.sizeFromAspectRatio(aspectRatio);

    if (this.isSupportedImageSize(trimmedSize)) {
      return {
        size: trimmedSize,
        promptResolution: ""
      };
    }

    return {
      size: aspectSize || this.normalizeImageSize(fallbackSize),
      promptResolution: trimmedSize
    };
  }

  private normalizeImageSize(size?: string) {
    const trimmed = size?.trim() || "";

    return this.isSupportedImageSize(trimmed) ? trimmed : DEFAULT_IMAGE_SIZE;
  }

  private isSupportedImageSize(size?: string) {
    return Boolean(size && SUPPORTED_IMAGE_SIZES.has(size));
  }

  private sizeFromAspectRatio(aspectRatio?: string) {
    if (aspectRatio === "1:1") {
      return "1024x1024";
    }
    if (aspectRatio === "2:3" || aspectRatio === "9:16") {
      return "1024x1536";
    }
    if (aspectRatio === "3:2" || aspectRatio === "16:9") {
      return "1536x1024";
    }

    return "";
  }
}
