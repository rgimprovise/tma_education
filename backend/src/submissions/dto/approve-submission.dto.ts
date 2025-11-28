import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO для одобрения сдачи
 */
export class ApproveSubmissionDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10)
  curatorScore?: number;

  @IsString()
  @IsOptional()
  curatorFeedback?: string;
}

