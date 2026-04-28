import { Inject, Injectable } from "@nestjs/common";
import { AdminGalleryQueryDto } from "../gallery/dto/admin-gallery-query.dto";
import { UpdateGalleryDemoDto } from "../gallery/dto/update-gallery-demo.dto";
import { GalleryService } from "../gallery/gallery.service";

@Injectable()
export class AdminService {
  constructor(@Inject(GalleryService) private readonly galleryService: GalleryService) {}

  getGalleryPhotos(query: AdminGalleryQueryDto) {
    return this.galleryService.getAdminPhotos(query);
  }

  updateGalleryDemo(id: string, dto: UpdateGalleryDemoDto) {
    return this.galleryService.updateDemoStatus(id, dto);
  }
}
