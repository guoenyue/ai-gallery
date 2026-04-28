import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class UserRegisterDto {
  @IsEmail({}, { message: "请输入有效邮箱。" })
  email!: string;

  @IsString()
  @MinLength(6, { message: "密码至少需要 6 位。" })
  password!: string;

  @IsString()
  @MinLength(1, { message: "请输入显示名称。" })
  @MaxLength(32, { message: "显示名称最多 32 个字符。" })
  displayName!: string;
}
