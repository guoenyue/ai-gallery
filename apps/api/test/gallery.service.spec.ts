import { GalleryService } from "../src/gallery/gallery.service";

function createService() {
  const photoModel = {
    create: jest.fn()
  };
  const configModel = {
    findOneAndUpdate: jest.fn()
  };
  const userModel = {};
  const openaiProxyService = {
    generateImage: jest.fn(),
    editImage: jest.fn()
  };
  const imageStorageService = {
    storeImage: jest.fn()
  };
  const service = new GalleryService(
    photoModel as never,
    configModel as never,
    userModel as never,
    openaiProxyService as never,
    imageStorageService as never
  );

  return {
    service,
    photoModel,
    configModel,
    openaiProxyService,
    imageStorageService
  };
}

describe("GalleryService", () => {
  it("saves and returns the user's OpenAI-compatible base URL", async () => {
    const { service, configModel } = createService();

    configModel.findOneAndUpdate.mockResolvedValue({
      model: "gpt-image-2",
      size: "1024x1024",
      apiKey: "user-key",
      baseUrl: "https://sub.appdock.cn/v1"
    });

    const result = await service.updateConfig("user-id", {
      model: "gpt-image-2",
      size: "1024x1024",
      apiKey: "user-key",
      baseUrl: "https://sub.appdock.cn/v1"
    });

    expect(configModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      {
        $set: {
          model: "gpt-image-2",
          size: "1024x1024",
          apiKey: "user-key",
          baseUrl: "https://sub.appdock.cn/v1"
        }
      },
      {
        new: true,
        upsert: true
      }
    );
    expect(result.baseUrl).toBe("https://sub.appdock.cn/v1");
  });

  it("uses the configured base URL when generating images", async () => {
    const { service, photoModel, configModel, openaiProxyService, imageStorageService } = createService();

    configModel.findOneAndUpdate.mockResolvedValue({
      model: "gpt-image-2",
      size: "1024x1024",
      apiKey: "user-key",
      baseUrl: "https://sub.appdock.cn/v1"
    });
    openaiProxyService.generateImage.mockResolvedValue({
      data: [{ b64_json: "abc123" }]
    });
    imageStorageService.storeImage.mockResolvedValue({
      provider: "local",
      key: "gallery/user-id/photo.png",
      url: "http://localhost:4000/uploads/gallery/user-id/photo.png"
    });
    photoModel.create.mockImplementation(async (photo) => ({
      id: "photo-id",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      ...photo
    }));

    await service.generatePhoto("user-id", {
      prompt: "neon city"
    });

    expect(openaiProxyService.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "neon city",
        model: "gpt-image-2",
        size: "1024x1024"
      }),
      "user-key",
      "https://sub.appdock.cn/v1",
      undefined
    );
  });
});
