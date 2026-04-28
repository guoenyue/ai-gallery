import { Module } from "@nestjs/common";
import { GalleryModule } from "../gallery/gallery.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [GalleryModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
