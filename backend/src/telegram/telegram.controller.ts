import { Controller } from '@nestjs/common';
import { TelegramService } from './telegram.service';

/**
 * TelegramController - контроллер для работы с Telegram Bot
 * Пока используется только для экспорта сервиса, обработка команд происходит в TelegramService
 */
@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}
}

