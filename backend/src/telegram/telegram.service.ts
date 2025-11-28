import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { UsersService } from '../users/users.service';
import { isCurator } from '../users/curators.config';
import { UserRole } from '@prisma/client';

/**
 * TelegramService - сервис для работы с Telegram Bot
 * Использует библиотеку grammY
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot;
  private tmaUrl: string;
  private isRunning = false;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.tmaUrl = this.configService.get<string>('TMA_URL', 'http://localhost:5173');

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not found in environment variables');
      return;
    }

    this.bot = new Bot(token);
    this.setupErrorHandling();
  }

  async onModuleInit() {
    if (!this.bot) {
      this.logger.error('Bot not initialized. Check TELEGRAM_BOT_TOKEN in .env');
      return;
    }

    try {
      this.setupHandlers();
      
      // Запускаем бота через polling в фоновом режиме (для разработки)
      // В production можно использовать webhook
      // Не используем await, чтобы не блокировать запуск основного приложения
      this.bot.start().then(() => {
        this.isRunning = true;
        this.bot.api.getMe().then((botInfo) => {
          this.logger.log(`🤖 Telegram Bot started: @${botInfo.username}`);
        });
      }).catch((error) => {
        this.logger.error('Failed to start Telegram Bot:', error);
      });
      
      this.logger.log('Telegram Bot initialization started...');
    } catch (error) {
      this.logger.error('Error initializing Telegram Bot:', error);
    }
  }

  async onModuleDestroy() {
    if (this.bot && this.isRunning) {
      await this.bot.stop();
      this.logger.log('Telegram Bot stopped');
    }
  }

  /**
   * Настройка обработки ошибок
   */
  private setupErrorHandling() {
    this.bot.catch((err) => {
      this.logger.error('Telegram Bot error:', err);
    });
  }

  /**
   * Настройка обработчиков команд и сообщений
   */
  private setupHandlers() {
    // Команда /start
    this.bot.command('start', async (ctx: Context) => {
      try {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId) {
          await ctx.reply('❌ Не удалось определить ваш Telegram ID. Попробуйте позже.');
          return;
        }

        // Определение роли: кураторы определяются по telegram_id
        const role: UserRole = isCurator(telegramId) ? 'CURATOR' : 'LEARNER';

        // Поиск или создание пользователя
        let user = await this.usersService.findByTelegramId(telegramId);
        if (!user) {
          user = await this.usersService.create({
            telegramId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            role,
          });
          this.logger.log(`New user created: ${telegramId} with role ${role}`);
        } else {
          // Обновляем роль существующего пользователя, если он куратор
          // (на случай, если куратор был добавлен после регистрации)
          if (isCurator(telegramId) && user.role !== 'CURATOR' && user.role !== 'ADMIN') {
            user = await this.usersService.update(user.id, { role: 'CURATOR' });
            this.logger.log(`User ${telegramId} role updated to CURATOR`);
          }
        }

        // Формируем приветственное сообщение
        const welcomeMessage = this.getWelcomeMessage(user.role);

        // Отправка кнопки для открытия Mini App
        await ctx.reply(welcomeMessage, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📚 Открыть учебное приложение',
                  web_app: { url: this.tmaUrl },
                },
              ],
            ],
          },
        });
      } catch (error) {
        this.logger.error('Error handling /start command:', error);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    // Обработка callback_query для куратора (заглушка, будет реализовано позже)
    this.bot.callbackQuery(/^curator_/, async (ctx: Context) => {
      await ctx.answerCallbackQuery('Функция в разработке');
    });
  }

  /**
   * Формирует приветственное сообщение в зависимости от роли
   */
  private getWelcomeMessage(role: string): string {
    if (role === 'CURATOR' || role === 'ADMIN') {
      return `👨‍🏫 Добро пожаловать, куратор!

Вы можете управлять курсом и проверять работы участников.

Нажмите кнопку ниже, чтобы открыть панель управления.`;
    }

    return `👋 Добро пожаловать в курс «Пирамида Минто»!

В этом курсе вы научитесь:
• Структурировать свои мысли
• Применять принцип пирамиды Минто
• Эффективно коммуницировать

Нажмите кнопку ниже, чтобы открыть учебное приложение.`;
  }

  /**
   * Отправить сообщение участнику
   * @param telegramId - Telegram ID пользователя
   * @param text - Текст сообщения
   * @param options - Дополнительные опции (клавиатура, parse_mode и т.д.)
   */
  async sendMessage(telegramId: string, text: string, options?: any): Promise<void> {
    if (!this.bot || !this.isRunning) {
      this.logger.warn('Bot is not running. Cannot send message.');
      return;
    }

    try {
      await this.bot.api.sendMessage(telegramId, text, options);
      this.logger.debug(`Message sent to ${telegramId}`);
    } catch (error: any) {
      this.logger.error(`Failed to send message to ${telegramId}:`, error.message);
      throw error;
    }
  }

  /**
   * Отправить уведомление куратору о новой сдаче
   * @param curatorTelegramId - Telegram ID куратора
   * @param submission - Данные о сдаче
   */
  async notifyCuratorAboutSubmission(
    curatorTelegramId: string,
    submission: any,
  ): Promise<void> {
    const userName = `${submission.user?.firstName || ''} ${submission.user?.lastName || ''}`.trim() || 'Участник';
    const moduleIndex = submission.module?.index || '?';
    const stepIndex = submission.step?.index || '?';
    const aiScore = submission.aiScore !== null && submission.aiScore !== undefined 
      ? `${submission.aiScore}/10` 
      : 'не оценено';

    const message = `📬 Новая сдача задания

👤 Участник: ${userName}
📚 Модуль: ${moduleIndex}
📝 Шаг: ${stepIndex}

🤖 Предварительная оценка ИИ: ${aiScore}

${submission.aiFeedback ? `💬 Комментарий ИИ:\n${submission.aiFeedback}\n` : ''}
---`;

    await this.sendMessage(curatorTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '✅ Одобрить',
              callback_data: `curator_approve_${submission.id}`,
            },
            {
              text: '↩️ Вернуть на доработку',
              callback_data: `curator_return_${submission.id}`,
            },
          ],
        ],
      },
    });
  }

  /**
   * Отправить уведомление участнику о результате проверки
   * @param learnerTelegramId - Telegram ID обучающегося
   * @param submission - Данные о сдаче
   */
  async notifyLearnerAboutReview(
    learnerTelegramId: string,
    submission: any,
  ): Promise<void> {
    const moduleIndex = submission.module?.index || '?';
    const stepTitle = submission.step?.title || 'Задание';

    if (submission.status === 'CURATOR_APPROVED') {
      const message = `✅ Ваша сдача одобрена!

📚 Модуль: ${moduleIndex}
📝 Задание: ${stepTitle}

${submission.curatorScore !== null ? `⭐ Оценка: ${submission.curatorScore}/10\n` : ''}
${submission.curatorFeedback ? `💬 Комментарий куратора:\n${submission.curatorFeedback}` : ''}

Продолжайте в том же духе! 🎉`;

      await this.sendMessage(learnerTelegramId, message);
    } else if (submission.status === 'CURATOR_RETURNED') {
      const message = `↩️ Сдача возвращена на доработку

📚 Модуль: ${moduleIndex}
📝 Задание: ${stepTitle}

💬 Комментарий куратора:
${submission.curatorFeedback || 'Требуется доработка'}

Пожалуйста, доработайте и отправьте снова.`;

      await this.sendMessage(learnerTelegramId, message);
    }
  }

  /**
   * Отправить уведомление о завершении модуля
   * @param learnerTelegramId - Telegram ID обучающегося
   * @param moduleIndex - Индекс модуля
   * @param moduleTitle - Название модуля
   */
  async notifyModuleCompleted(
    learnerTelegramId: string,
    moduleIndex: number,
    moduleTitle: string,
  ): Promise<void> {
    const message = `🎉 Поздравляем!

Вы успешно завершили ${moduleIndex} модуль: "${moduleTitle}"

Ждите открытия следующего модуля куратором.`;

    await this.sendMessage(learnerTelegramId, message);
  }

  /**
   * Отправить уведомление об открытии модуля
   * @param learnerTelegramId - Telegram ID обучающегося
   * @param moduleIndex - Индекс модуля
   * @param moduleTitle - Название модуля
   */
  async notifyModuleUnlocked(
    learnerTelegramId: string,
    moduleIndex: number,
    moduleTitle: string,
  ): Promise<void> {
    const message = `🔓 Новый модуль открыт!

📚 Модуль ${moduleIndex}: "${moduleTitle}"

Теперь вы можете приступить к изучению нового материала.

Нажмите кнопку ниже, чтобы открыть учебное приложение.`;

    await this.sendMessage(learnerTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📚 Открыть учебное приложение',
              web_app: { url: this.tmaUrl },
            },
          ],
        ],
      },
    });
  }
}

