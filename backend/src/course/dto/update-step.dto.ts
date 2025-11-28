import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { StepType, AnswerType } from '@prisma/client';

export class UpdateStepDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(StepType)
  @IsOptional()
  type?: StepType;

  @IsInt()
  @Min(0)
  @IsOptional()
  index?: number;

  @IsString()
  @IsOptional()
  content?: string;

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
  formSchema?: any; // JSON

  @IsString()
  @IsOptional()
  aiRubric?: string;
}

