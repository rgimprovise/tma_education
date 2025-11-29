import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @IsOptional()
  courseId?: string; // ID курса, к которому относится модуль

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  index: number;

  @IsBoolean()
  @IsOptional()
  isExam?: boolean;
}

