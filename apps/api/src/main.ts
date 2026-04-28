import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, static as expressStatic, urlencoded } from "express";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";

export function configureHttpMiddleware(
  app: Pick<INestApplication, "use" | "enableCors" | "useGlobalPipes">,
  options: {
    uploadRoot: string;
    bodyLimit: string;
  }
) {
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.use(json({ limit: options.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: options.bodyLimit }));
  mkdirSync(options.uploadRoot, { recursive: true });
  app.use("/uploads", expressStatic(options.uploadRoot));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const uploadRoot = process.env.LOCAL_UPLOAD_DIR || join(process.cwd(), "uploads");
  const bodyLimit = process.env.REQUEST_BODY_LIMIT || "25mb";

  configureHttpMiddleware(app, { uploadRoot, bodyLimit });

  await app.listen(process.env.PORT ?? 4000);
}

if (require.main === module) {
  void bootstrap();
}
