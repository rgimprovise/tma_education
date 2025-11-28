import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO для возврата сдачи на доработку
 */
export class ReturnSubmissionDto {
  @IsString()
  @IsNotEmpty()
  curatorFeedback: string;
}

