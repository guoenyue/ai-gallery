import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({
  versionKey: false,
  timestamps: true
})
export class GalleryConfig {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId!: string;

  @Prop({ type: String, default: "gpt-image-2" })
  model!: string;

  @Prop({ type: String, default: "1024x1024" })
  size!: string;

  @Prop({ type: String, default: "" })
  apiKey!: string;

  @Prop({ type: String, default: "" })
  baseUrl!: string;
}

export type GalleryConfigDocument = HydratedDocument<GalleryConfig>;
export const GalleryConfigSchema = SchemaFactory.createForClass(GalleryConfig);
