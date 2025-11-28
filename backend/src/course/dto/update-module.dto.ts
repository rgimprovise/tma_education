import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class UpdateModuleDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  index?: number;

  @IsBoolean()
  @IsOptional()
  isExam?: boolean;
}

