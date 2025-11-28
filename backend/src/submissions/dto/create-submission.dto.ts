import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

/**
 * DTO для создания сдачи задания
 */
export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  stepId: string;

  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsString()
  @IsOptional()
  answerText?: string;

  @IsString()
  @IsOptional()
  answerFileId?: string;

  @IsEnum(['TEXT', 'AUDIO', 'VIDEO', 'FILE'])
  @IsOptional()
  answerType?: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
}

