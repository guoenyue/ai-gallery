import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OpenAIProxyModule } from "../openai/openai-proxy.module";
import { UserAuthGuard } from "../users/user-auth.guard";
import { UserAccount, UserAccountSchema } from "../users/user.schema";
import { GalleryConfigController, GalleryController, GalleryDemoController } from "./gallery.controller";
import { GalleryConfig, GalleryConfigSchema } from "./gallery-config.schema";
import { GalleryPhoto, GalleryPhotoSchema } from "./gallery-photo.schema";
import { GalleryService } from "./gallery.service";
import { ImageStorageService } from "./image-storage.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GalleryPhoto.name, schema: GalleryPhotoSchema },
      { name: GalleryConfig.name, schema: GalleryConfigSchema },
      { name: UserAccount.name, schema: UserAccountSchema }
    ]),
    OpenAIProxyModule
  ],
  controllers: [GalleryDemoController, GalleryController, GalleryConfigController],
  providers: [GalleryService, ImageStorageService, UserAuthGuard],
  exports: [GalleryService]
})
export class GalleryModule {}
