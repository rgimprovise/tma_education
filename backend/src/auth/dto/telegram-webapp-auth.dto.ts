import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO для аутентификации через Telegram WebApp
 */
export class TelegramWebAppAuthDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

/**
 * Ответ при успешной аутентификации
 */
export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    telegramId: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
}

