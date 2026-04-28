import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ImageGenerationDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsIn(["1024x1024", "1024x1536", "1536x1024", "auto"])
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1)
  n?: number;

  @IsOptional()
  @IsIn(["png", "jpeg", "webp"])
  output_format?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}
