import { Body, Controller, Headers, Inject, Post, UseGuards } from "@nestjs/common";
import { ImageGenerationDto } from "./dto/image-generation.dto";
import { OpenAIProxyService } from "./openai-proxy.service";
import { UserAuthGuard } from "../users/user-auth.guard";

@Controller("openai")
export class OpenAIProxyController {
  constructor(@Inject(OpenAIProxyService) private readonly openaiProxyService: OpenAIProxyService) {}

  @Post("images/generations")
  @UseGuards(UserAuthGuard)
  generateImage(@Body() dto: ImageGenerationDto, @Headers("x-openai-api-key") apiKey?: string) {
    return this.openaiProxyService.generateImage(dto, apiKey);
  }
}
