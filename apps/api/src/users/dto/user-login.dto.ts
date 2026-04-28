import { IsEmail, IsString, MinLength } from "class-validator";

export class UserLoginDto {
  @IsEmail({}, { message: "请输入有效邮箱。" })
  email!: string;

  @IsString()
  @MinLength(6, { message: "密码至少需要 6 位。" })
  password!: string;
}
