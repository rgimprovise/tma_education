import { IsArray, IsOptional, IsBoolean, IsString, ValidateIf } from 'class-validator';

/**
 * DTO для блокировки модуля для пользователей
 */
export class LockModuleDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ValidateIf((o) => !o.forAll)
  userIds?: string[];

  @IsBoolean()
  @IsOptional()
  @ValidateIf((o) => !o.userIds || o.userIds.length === 0)
  forAll?: boolean; // Заблокировать для всех зарегистрированных учеников
}

