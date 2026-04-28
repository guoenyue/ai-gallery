import { Body, Controller, Delete, Get, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { GenerateGalleryPhotoDto } from "./dto/generate-gallery-photo.dto";
import { UpdateGalleryConfigDto } from "./dto/update-gallery-config.dto";
import { GalleryService } from "./gallery.service";
import { UserAuthGuard } from "../users/user-auth.guard";

type UserRequest = Request & {
  user?: {
    sub?: string;
  };
};

@Controller("gallery/demos")
export class GalleryDemoController {
  constructor(@Inject(GalleryService) private readonly galleryService: GalleryService) {}

  @Get()
  list() {
    return this.galleryService.listDemoPhotos();
  }
}

@Controller("gallery/photos")
@UseGuards(UserAuthGuard)
export class GalleryController {
  constructor(@Inject(GalleryService) private readonly galleryService: GalleryService) {}

  @Get()
  list(@Req() request: UserRequest) {
    return this.galleryService.listPhotos(request.user?.sub ?? "");
  }

  @Post("generate")
  generate(@Req() request: UserRequest, @Body() dto: GenerateGalleryPhotoDto) {
    return this.galleryService.generatePhoto(request.user?.sub ?? "", dto);
  }

  @Post("generate-stream")
  generateStream(@Req() request: UserRequest, @Body() dto: GenerateGalleryPhotoDto, @Res() response: Response) {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.socket?.setKeepAlive(true);

    const startedAt = Date.now();
    const writeEvent = (event: string, data: Record<string, unknown>) => {
      if (!response.writableEnded) {
        response.write(`event: ${event}\n`);
        response.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    writeEvent("open", {
      elapsedSeconds: 0
    });

    const heartbeat = setInterval(() => {
      writeEvent("ping", {
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000)
      });
    }, 15000);

    response.on("close", () => clearInterval(heartbeat));

    void this.galleryService
      .generatePhoto(request.user?.sub ?? "", dto, {
        onStreamEvent: (event) => {
          writeEvent("upstream", event);
        }
      })
      .then((photo) => {
        writeEvent("done", {
          data: photo
        });
      })
      .catch((error) => {
        writeEvent("error", {
          message: error instanceof Error ? error.message : "图片生成失败。"
        });
      })
      .finally(() => {
        clearInterval(heartbeat);
        response.end();
      });
  }

  @Post(":id/retry")
  retry(@Req() request: UserRequest, @Param("id") id: string) {
    return this.galleryService.retryPhoto(request.user?.sub ?? "", id);
  }

  @Delete(":id")
  delete(@Req() request: UserRequest, @Param("id") id: string) {
    return this.galleryService.deletePhoto(request.user?.sub ?? "", id);
  }
}

@Controller("gallery/config")
@UseGuards(UserAuthGuard)
export class GalleryConfigController {
  constructor(@Inject(GalleryService) private readonly galleryService: GalleryService) {}

  @Get()
  getConfig(@Req() request: UserRequest) {
    return this.galleryService.getConfig(request.user?.sub ?? "");
  }

  @Post()
  updateConfig(@Req() request: UserRequest, @Body() dto: UpdateGalleryConfigDto) {
    return this.galleryService.updateConfig(request.user?.sub ?? "", dto);
  }
}
