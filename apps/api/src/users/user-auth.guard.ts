import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class UserAuthGuard implements CanActivate {
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
      const user = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get("JWT_SECRET", "change-me")
      });
      if (user?.role !== "user" || !user?.sub) {
        throw new UnauthorizedException("登录凭证无效。");
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException("登录凭证无效。");
    }
  }
}
