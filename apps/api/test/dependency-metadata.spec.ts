import "reflect-metadata";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { GalleryConfigController, GalleryController, GalleryDemoController } from "../src/gallery/gallery.controller";
import { GalleryService } from "../src/gallery/gallery.service";
import { ImageStorageService } from "../src/gallery/image-storage.service";
import { OpenAIProxyController } from "../src/openai/openai-proxy.controller";
import { OpenAIProxyService } from "../src/openai/openai-proxy.service";
import { UserAuthGuard } from "../src/users/user-auth.guard";
import { UsersController } from "../src/users/users.controller";
import { UsersService } from "../src/users/users.service";

function expectExplicitInject(target: object, index: number, param: unknown) {
  const metadata = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) ?? [];

  expect(metadata).toEqual(expect.arrayContaining([expect.objectContaining({ index, param })]));
}

describe("Explicit dependency metadata", () => {
  it("declares runtime injection tokens for dev loaders that do not emit design:paramtypes", () => {
    expectExplicitInject(AuthService, 0, ConfigService);
    expectExplicitInject(AuthService, 1, JwtService);
    expectExplicitInject(JwtAuthGuard, 0, JwtService);
    expectExplicitInject(JwtAuthGuard, 1, ConfigService);
    expectExplicitInject(UserAuthGuard, 0, JwtService);
    expectExplicitInject(UserAuthGuard, 1, ConfigService);
    expectExplicitInject(UsersService, 1, JwtService);
    expectExplicitInject(UsersController, 0, UsersService);
    expectExplicitInject(OpenAIProxyService, 0, ConfigService);
    expectExplicitInject(OpenAIProxyController, 0, OpenAIProxyService);
    expectExplicitInject(ImageStorageService, 0, ConfigService);
    expectExplicitInject(GalleryService, 3, OpenAIProxyService);
    expectExplicitInject(GalleryService, 4, ImageStorageService);
    expectExplicitInject(GalleryDemoController, 0, GalleryService);
    expectExplicitInject(GalleryController, 0, GalleryService);
    expectExplicitInject(GalleryConfigController, 0, GalleryService);
    expectExplicitInject(AdminService, 0, GalleryService);
    expectExplicitInject(AdminController, 0, AdminService);
    expectExplicitInject(AuthController, 0, AuthService);
  });
});
