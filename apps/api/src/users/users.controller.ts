import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserLoginDto } from "./dto/user-login.dto";
import { UserRegisterDto } from "./dto/user-register.dto";
import { UserAuthGuard } from "./user-auth.guard";
import { UsersService } from "./users.service";

type UserRequest = Request & {
  user?: {
    sub?: string;
  };
};

@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Post("register")
  register(@Body() dto: UserRegisterDto) {
    return this.usersService.register(dto);
  }

  @Post("login")
  login(@Body() dto: UserLoginDto) {
    return this.usersService.login(dto);
  }

  @Get("me")
  @UseGuards(UserAuthGuard)
  me(@Req() request: UserRequest) {
    return this.usersService.getProfile(request.user?.sub ?? "");
  }
}
