import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("缺少登录凭证。");
    }

    const token = authHeader.replace("Bearer ", "").trim();

    try {
      request.user = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get("JWT_SECRET", "change-me")
      });
      if (request.user?.role !== "admin") {
        throw new UnauthorizedException("登录凭证无效。");
      }
      return true;
    } catch {
      throw new UnauthorizedException("登录凭证无效。");
    }
  }
}
