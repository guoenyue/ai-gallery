import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGalleryQueryDto } from "../gallery/dto/admin-gallery-query.dto";
import { UpdateGalleryDemoDto } from "../gallery/dto/update-gallery-demo.dto";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get("gallery/photos")
  getGalleryPhotos(@Query() query: AdminGalleryQueryDto) {
    return this.adminService.getGalleryPhotos(query);
  }

  @Post("gallery/photos/:id/demo")
  updateGalleryDemo(@Param("id") id: string, @Body() dto: UpdateGalleryDemoDto) {
    return this.adminService.updateGalleryDemo(id, dto);
  }
}
