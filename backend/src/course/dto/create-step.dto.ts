import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { StepType, AnswerType } from '@prisma/client';

export class CreateStepDto {
  @IsString()
  moduleId: string;

  @IsString()
  title: string;

  @IsEnum(StepType)
  type: StepType;

  @IsInt()
  @Min(0)
  index: number;

  @IsString()
  content: string;

  @IsEnum(AnswerType)
  @IsOptional()
  expectedAnswer?: AnswerType;

  @IsBoolean()
  @IsOptional()
  requiresAiReview?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  maxScore?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.formSchema !== null)
  formSchema?: any; // JSON

  @IsString()
  @IsOptional()
  aiRubric?: string;
}

