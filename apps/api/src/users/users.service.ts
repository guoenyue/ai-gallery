import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { UserLoginDto } from "./dto/user-login.dto";
import { UserRegisterDto } from "./dto/user-register.dto";
import { UserAccount, UserAccountDocument } from "./user.schema";

const scrypt = promisify(scryptCallback);

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserAccount.name) private readonly userModel: Model<UserAccountDocument>,
    @Inject(JwtService) private readonly jwtService: JwtService
  ) {}

  async register(dto: UserRegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const exists = await this.userModel.exists({ email });

    if (exists) {
      throw new ConflictException("该邮箱已注册。");
    }

    const user = await this.userModel.create({
      email,
      passwordHash: await this.hashPassword(dto.password),
      displayName: dto.displayName.trim()
    });

    return this.buildSession(user);
  }

  async login(dto: UserLoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userModel.findOne({ email });

    if (!user || !(await this.verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("邮箱或密码不正确。");
    }

    return this.buildSession(user);
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new UnauthorizedException("登录凭证无效。");
    }

    return this.serializeUser(user);
  }

  private async buildSession(user: UserAccountDocument) {
    const profile = this.serializeUser(user);
    const accessToken = await this.jwtService.signAsync({
      sub: profile.id,
      email: profile.email,
      role: "user"
    });

    return {
      accessToken,
      user: profile
    };
  }

  private serializeUser(user: UserAccountDocument) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return `${salt}:${derivedKey.toString("hex")}`;
  }

  private async verifyPassword(password: string, storedHash: string) {
    const [salt, key] = storedHash.split(":");

    if (!salt || !key) {
      return false;
    }

    const expected = Buffer.from(key, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
