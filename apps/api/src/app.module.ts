import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { resolve } from "node:path";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { buildMongoUri } from "./common/connection-config";
import { GalleryModule } from "./gallery/gallery.module";
import { OpenAIProxyModule } from "./openai/openai-proxy.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env")
      ]
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: buildMongoUri(configService)
      })
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET", "change-me"),
        signOptions: {
          expiresIn: "12h"
        }
      })
    }),
    AuthModule,
    AdminModule,
    UsersModule,
    OpenAIProxyModule,
    GalleryModule
  ]
})
export class AppModule {}
