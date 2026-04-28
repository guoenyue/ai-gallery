import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class UpdateGalleryDemoDto {
  @IsBoolean()
  isDemo!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  demoOrder?: number;
}
