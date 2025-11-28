import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramWebAppAuthDto, AuthResponseDto } from './dto/telegram-webapp-auth.dto';

/**
 * AuthController - обработка аутентификации через Telegram WebApp
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/telegram-webapp
   * Принимает initData из Telegram WebApp, валидирует подпись,
   * находит/создаёт пользователя, возвращает JWT
   */
  @Post('telegram-webapp')
  async authenticate(@Body() dto: TelegramWebAppAuthDto): Promise<AuthResponseDto> {
    return this.authService.validateTelegramWebApp(dto.initData);
  }
}

