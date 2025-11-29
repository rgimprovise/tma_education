import { IsArray, IsOptional, IsBoolean, IsString, ValidateIf } from 'class-validator';

/**
 * DTO для открытия модуля пользователям
 */
export class UnlockModuleDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => !o.allCompletedPrevious && !o.forAll)
  userIds?: string[];

  @IsBoolean()
  @IsOptional()
  @ValidateIf((o) => !o.userIds || o.userIds.length === 0)
  allCompletedPrevious?: boolean;

  @IsBoolean()
  @IsOptional()
  @ValidateIf((o) => !o.userIds || o.userIds.length === 0)
  forAll?: boolean; // Открыть для всех зарегистрированных учеников
}

