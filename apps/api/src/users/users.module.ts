import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserAccount, UserAccountSchema } from "./user.schema";
import { UserAuthGuard } from "./user-auth.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: UserAccount.name, schema: UserAccountSchema }])],
  controllers: [UsersController],
  providers: [UsersService, UserAuthGuard],
  exports: [UsersService]
})
export class UsersModule {}
