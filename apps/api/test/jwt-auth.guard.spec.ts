import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

function createContext(authorization = "Bearer token") {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization
        }
      })
    })
  } as never;
}

describe("JwtAuthGuard", () => {
  const configService = {
    get: jest.fn(() => "secret")
  } as unknown as ConfigService;

  it("allows admin tokens", async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: "admin", role: "admin" })
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, configService);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it("rejects signed ordinary user tokens for admin routes", async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: "user-id", role: "user" })
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, configService);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
