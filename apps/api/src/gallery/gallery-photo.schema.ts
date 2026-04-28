import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({
  versionKey: false,
  timestamps: true
})
export class GalleryPhoto {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, trim: true })
  prompt!: string;

  @Prop({ type: String, default: "" })
  imageUrl!: string;

  @Prop({ type: String, default: "succeeded", index: true })
  status!: "succeeded" | "failed";

  @Prop({ type: String, default: "generate" })
  operation!: "generate" | "edit";

  @Prop({ type: String, default: "none" })
  storageProvider!: "qiniu" | "local" | "none";

  @Prop({ type: String, default: "" })
  storageKey!: string;

  @Prop({ type: String, default: "gpt-image-2" })
  model!: string;

  @Prop({ type: String, default: "1024x1024" })
  size!: string;

  @Prop({ type: String, default: "" })
  aspectRatio!: string;

  @Prop({ type: String, default: "" })
  layout!: string;

  @Prop({ type: String, default: "" })
  resolution!: string;

  @Prop({ type: String, default: "" })
  baseUrl!: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDemo!: boolean;

  @Prop({ type: Number, default: 0 })
  demoOrder!: number;

  @Prop({ type: String, default: "" })
  errorMessage!: string;

  @Prop({ type: String, default: "" })
  sourcePhotoId!: string;

  @Prop({ type: String, default: "" })
  sourceImageUrl!: string;

  @Prop({ type: String, default: "none" })
  sourceStorageProvider!: "qiniu" | "local" | "none";

  @Prop({ type: String, default: "" })
  sourceStorageKey!: string;
}

export type GalleryPhotoDocument = HydratedDocument<GalleryPhoto>;
export const GalleryPhotoSchema = SchemaFactory.createForClass(GalleryPhoto);
GalleryPhotoSchema.index({ userId: 1, createdAt: -1 });
GalleryPhotoSchema.index({ isDemo: 1, demoOrder: 1, createdAt: -1 });
