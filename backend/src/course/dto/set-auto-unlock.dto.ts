import { IsBoolean } from 'class-validator';

/**
 * DTO для установки флага автоматического открытия модуля для новых учеников
 */
export class SetAutoUnlockDto {
  @IsBoolean()
  autoUnlock: boolean;
}

