import { Module } from "@nestjs/common";
import { OpenAIProxyController } from "./openai-proxy.controller";
import { OpenAIProxyService } from "./openai-proxy.service";
import { UserAuthGuard } from "../users/user-auth.guard";

@Module({
  controllers: [OpenAIProxyController],
  providers: [OpenAIProxyService, UserAuthGuard],
  exports: [OpenAIProxyService]
})
export class OpenAIProxyModule {}
