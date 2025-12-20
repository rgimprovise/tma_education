import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO для одобрения сдачи
 * Валидация максимальной оценки происходит в сервисе на основе maxScore шага
 */
export class ApproveSubmissionDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  curatorScore?: number;

  @IsString()
  @IsOptional()
  curatorFeedback?: string;
}

