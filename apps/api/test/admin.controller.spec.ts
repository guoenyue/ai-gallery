import { AdminController } from "../src/admin/admin.controller";

describe("AdminController", () => {
  it("returns ordinary user gallery records for admins", async () => {
    const adminService = {
      getGalleryPhotos: jest.fn().mockResolvedValue({
        records: [
          {
            id: "photo-id",
            prompt: "neon city",
            imageUrl: "https://cdn.example.com/photo.png",
            storageProvider: "qiniu",
            storageKey: "gallery/user/photo.png",
            createdAt: "2026-04-25T07:00:00.000Z",
            config: {
              model: "gpt-image-2",
              size: "1024x1024"
            },
            user: {
              id: "user-id",
              email: "user@example.com",
              displayName: "User"
            }
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1
        },
        summary: {
          total: 1,
          qiniu: 1,
          local: 0
        }
      })
    };
    const controller = new AdminController(adminService as never);

    await expect(controller.getGalleryPhotos({ page: 1, pageSize: 20 })).resolves.toEqual({
      records: [
        {
          id: "photo-id",
          prompt: "neon city",
          imageUrl: "https://cdn.example.com/photo.png",
          storageProvider: "qiniu",
          storageKey: "gallery/user/photo.png",
          createdAt: "2026-04-25T07:00:00.000Z",
          config: {
            model: "gpt-image-2",
            size: "1024x1024"
          },
          user: {
            id: "user-id",
            email: "user@example.com",
            displayName: "User"
          }
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1
      },
      summary: {
        total: 1,
        qiniu: 1,
        local: 0
      }
    });
  });
});
