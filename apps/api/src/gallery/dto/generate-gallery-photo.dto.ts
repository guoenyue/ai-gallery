import { IsOptional, IsString } from "class-validator";

export class GenerateGalleryPhotoDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  layout?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  sourcePhotoId?: string;

  @IsOptional()
  @IsString()
  sourceImageData?: string;
}
