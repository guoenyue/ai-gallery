import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({
  versionKey: false,
  timestamps: true
})
export class UserAccount {
  @Prop({ type: String, required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, required: true, trim: true })
  displayName!: string;
}

export type UserAccountDocument = HydratedDocument<UserAccount>;
export const UserAccountSchema = SchemaFactory.createForClass(UserAccount);
