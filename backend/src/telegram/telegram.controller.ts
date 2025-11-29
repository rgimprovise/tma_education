import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';

/**
 * TelegramController - контроллер для работы с Telegram Bot
 * Обрабатывает webhook от Telegram API
 */
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private telegramService: TelegramService) {}

  /**
   * POST /telegram/webhook
   * Принимает updates от Telegram API в webhook режиме
   */
  @Post('webhook')
  async handleWebhook(@Body() update: any) {
    this.logger.log(`[POST /telegram/webhook] Received webhook request`);
    this.logger.debug(`[POST /telegram/webhook] Update keys: ${Object.keys(update).join(', ')}`);
    
    try {
      await this.telegramService.handleUpdate(update);
      this.logger.debug(`[POST /telegram/webhook] Successfully processed update`);
      return { ok: true };
    } catch (error: any) {
      this.logger.error('[POST /telegram/webhook] Error handling webhook update:', error);
      this.logger.error(`[POST /telegram/webhook] Error message: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  /**
   * POST /telegram/set-webhook
   * Устанавливает webhook URL в Telegram
   */
  @Post('set-webhook')
  async setWebhook(@Body('url') url?: string) {
    try {
      const result = await this.telegramService.setWebhook(url);
      return result;
    } catch (error: any) {
      this.logger.error('Error setting webhook:', error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * GET /telegram/webhook-info
   * Получить информацию о текущем webhook
   */
  @Get('webhook-info')
  async getWebhookInfo() {
    try {
      return await this.telegramService.getWebhookInfo();
    } catch (error: any) {
      this.logger.error('Error getting webhook info:', error);
      return { ok: false, error: error.message };
    }
  }
}

