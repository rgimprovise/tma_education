import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Bot, Context } from 'grammy';
import { UsersService } from '../users/users.service';
import { isCurator } from '../users/curators.config';
import { UserRole } from '@prisma/client';

/**
 * Состояния регистрации пользователя
 */
enum RegistrationState {
  WAITING_FIRST_NAME = 'WAITING_FIRST_NAME',
  WAITING_LAST_NAME = 'WAITING_LAST_NAME',
  WAITING_POSITION = 'WAITING_POSITION',
}

/**
 * Данные состояния регистрации пользователя
 */
interface UserRegistrationData {
  state: RegistrationState;
  userId: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
}

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
  
  // Хранилище состояний регистрации пользователей (telegramId -> RegistrationData)
  private registrationStates: Map<string, UserRegistrationData> = new Map();

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private moduleRef: ModuleRef,
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
      
      const useWebhook = this.configService.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
      
      if (useWebhook) {
        // Webhook режим - инициализируем бот без polling
        await this.bot.init();
        this.isRunning = true;
        const botInfo = await this.bot.api.getMe();
        this.logger.log(`🤖 Telegram Bot initialized (webhook mode): @${botInfo.username}`);
        this.logger.log(`   Bot ID: ${botInfo.id}`);
        this.logger.log(`⚠️ Don't forget to set webhook URL via /telegram/set-webhook`);
      } else {
        // Polling режим (для разработки)
        this.logger.log('Telegram Bot initialization started (polling mode)...');
        
        // Добавляем timeout для диагностики зависаний
        const startTimeout = setTimeout(() => {
          if (!this.isRunning) {
            this.logger.error('⚠️ Telegram Bot start timeout (30s). Possible causes:');
            this.logger.error('  - Another process is using this bot token (long polling conflict)');
            this.logger.error('  - Network connectivity issues');
            this.logger.error('  - Firewall blocking Telegram API');
            this.logger.error('Consider setting TELEGRAM_USE_WEBHOOK=true in .env');
          }
        }, 30000);
        
        this.bot.start()
          .then(() => {
            clearTimeout(startTimeout);
            this.isRunning = true;
            this.logger.log('✅ Bot polling started successfully');
            
            return this.bot.api.getMe();
          })
          .then((botInfo) => {
            this.logger.log(`🤖 Telegram Bot started: @${botInfo.username}`);
            this.logger.log(`Bot ID: ${botInfo.id}`);
          })
          .catch((error) => {
            clearTimeout(startTimeout);
            this.logger.error('❌ Failed to start Telegram Bot:');
            this.logger.error(`Error type: ${error.constructor.name}`);
            this.logger.error(`Error message: ${error.message}`);
            
            if (error.message?.includes('409')) {
              this.logger.error('🔴 CONFLICT: Another instance is using this bot token!');
              this.logger.error('   Solution: Set TELEGRAM_USE_WEBHOOK=true in .env');
            } else if (error.message?.includes('401')) {
              this.logger.error('🔴 UNAUTHORIZED: Bot token is invalid');
            }
          });
      }
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
        this.logger.log(`[/start command] Received from user ${ctx.from?.id}`);
        await this.handleStartCommand(ctx);
        this.logger.log(`[/start command] Processed successfully for user ${ctx.from?.id}`);
      } catch (error) {
        this.logger.error('[/start command] Error handling /start command:', error);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    // Обработка текстовых сообщений (для диалога регистрации и кнопки "Открыть приложение")
    this.bot.on('message:text', async (ctx: Context) => {
      try {
        const telegramId = ctx.from?.id.toString();
        if (!telegramId) return;

        const text = ctx.message?.text?.trim();

        // Обработка кнопки "Открыть приложение"
        if (text === '📚 Открыть приложение') {
          const user = await this.usersService.findByTelegramId(telegramId);
          if (!user) {
            await ctx.reply('❌ Пользователь не найден. Отправьте /start для регистрации.');
            return;
          }

          if (!user.profileCompleted) {
            await ctx.reply('⚠️ Завершите регистрацию, отправив /start');
            return;
          }

          await ctx.reply('Открываю приложение...', {
            reply_markup: {
              inline_keyboard: [
                [
                  this.getAppInlineButton(),
                ],
              ],
            },
          });
          return;
        }

        // Проверяем, находится ли пользователь в процессе регистрации
        const registrationData = this.registrationStates.get(telegramId);
        if (registrationData) {
          await this.handleRegistrationStep(ctx, registrationData);
        }
      } catch (error) {
        this.logger.error('Error handling text message:', error);
        await ctx.reply('❌ Произошла ошибка. Попробуйте снова или отправьте /start.');
      }
    });

    // Обработка голосовых сообщений (для аудио-сдачи заданий)
    this.bot.on('message:voice', async (ctx: Context) => {
      try {
        await this.handleVoiceMessage(ctx, 'voice');
      } catch (error) {
        this.logger.error('Error handling voice message:', error);
        await ctx.reply('❌ Произошла ошибка при обработке голосового сообщения.');
      }
    });

    // Обработка видео-заметок (для аудио-сдачи заданий)
    this.bot.on('message:video_note', async (ctx: Context) => {
      try {
        await this.handleVoiceMessage(ctx, 'video_note');
      } catch (error) {
        this.logger.error('Error handling video note:', error);
        await ctx.reply('❌ Произошла ошибка при обработке видео-сообщения.');
      }
    });

    // Обработка callback_query для куратора (заглушка, будет реализовано позже)
    this.bot.callbackQuery(/^curator_/, async (ctx: Context) => {
      await ctx.answerCallbackQuery('Функция в разработке');
    });
  }

  /**
   * Обработка команды /start
   */
  private async handleStartCommand(ctx: Context) {
    this.logger.log(`[handleStartCommand] START - Processing for user ${ctx.from?.id}`);
    
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      this.logger.warn('[handleStartCommand] No telegramId found in context');
      await ctx.reply('❌ Не удалось определить ваш Telegram ID. Попробуйте позже.');
      return;
    }

    this.logger.debug(`[handleStartCommand] TelegramId: ${telegramId}`);

    // Определение роли: кураторы определяются по telegram_id
    const role: UserRole = isCurator(telegramId) ? 'CURATOR' : 'LEARNER';
    this.logger.debug(`[handleStartCommand] Detected role: ${role}`);

    // Поиск или создание пользователя
    this.logger.debug(`[handleStartCommand] Looking up user by telegramId...`);
    let user = await this.usersService.findByTelegramId(telegramId);
    this.logger.debug(`[handleStartCommand] User found: ${user ? user.id : 'null (will create)'}`);
    
    if (!user) {
      // Создаём нового пользователя с данными из Telegram как черновик
      user = await this.usersService.create({
        telegramId,
        firstName: ctx.from.first_name || undefined,
        lastName: ctx.from.last_name || undefined,
        role,
        profileCompleted: false, // Новый пользователь требует регистрации
      });
      this.logger.log(`New user created: ${telegramId} with role ${role}`);
    } else {
      // Обновляем роль существующего пользователя, если он куратор
      if (isCurator(telegramId) && user.role !== 'CURATOR' && user.role !== 'ADMIN') {
        user = await this.usersService.update(user.id, { role: 'CURATOR' });
        this.logger.log(`User ${telegramId} role updated to CURATOR`);
      }
    }

    // Проверяем, завершена ли регистрация
    this.logger.debug(`[handleStartCommand] User profileCompleted: ${user.profileCompleted}`);
    
    if (!user.profileCompleted) {
      // Запускаем процесс регистрации
      this.logger.log(`[handleStartCommand] Starting registration dialog for user ${user.id}`);
      await this.startRegistrationDialog(ctx, user.id, telegramId);
    } else {
      // Регистрация завершена - отправляем приветствие и WebApp кнопку
      this.logger.log(`[handleStartCommand] Sending welcome message with WebApp for user ${user.id} (role: ${user.role})`);
      await this.sendWelcomeWithWebApp(ctx, user.role);
    }
    
    this.logger.log(`[handleStartCommand] COMPLETE - Successfully processed for user ${telegramId}`);
  }

  /**
   * Запуск диалога регистрации
   */
  private async startRegistrationDialog(ctx: Context, userId: string, telegramId: string) {
    // Сохраняем состояние
    this.registrationStates.set(telegramId, {
      state: RegistrationState.WAITING_FIRST_NAME,
      userId,
      telegramId,
    });

    await ctx.reply(`👋 Добро пожаловать в курс «Пирамида Минто»!

Для начала давайте познакомимся.

📝 Пожалуйста, напишите ваше имя:`);
  }

  /**
   * Обработка шага регистрации
   */
  private async handleRegistrationStep(ctx: Context, registrationData: UserRegistrationData) {
    const text = ctx.message?.text?.trim();
    if (!text) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение.');
      return;
    }

    const { state, userId, telegramId } = registrationData;

    switch (state) {
      case RegistrationState.WAITING_FIRST_NAME:
        // Сохраняем имя
        registrationData.firstName = text;
        registrationData.state = RegistrationState.WAITING_LAST_NAME;
        this.registrationStates.set(telegramId, registrationData);

        await ctx.reply(`✅ Отлично, ${text}!

📝 Теперь напишите вашу фамилию:`);
        break;

      case RegistrationState.WAITING_LAST_NAME:
        // Сохраняем фамилию
        registrationData.lastName = text;
        registrationData.state = RegistrationState.WAITING_POSITION;
        this.registrationStates.set(telegramId, registrationData);

        await ctx.reply(`✅ Хорошо!

📝 И последнее — укажите вашу должность:`);
        break;

      case RegistrationState.WAITING_POSITION:
        // Сохраняем должность и завершаем регистрацию
        registrationData.position = text;

        // Обновляем пользователя в БД
        const user = await this.usersService.update(userId, {
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          position: registrationData.position,
          profileCompleted: true,
        });

        // Удаляем состояние регистрации
        this.registrationStates.delete(telegramId);

        this.logger.log(`User ${telegramId} completed registration`);

        // Отправляем финальное сообщение с WebApp кнопкой
        await ctx.reply(`✅ Регистрация завершена!

Спасибо, ${user.firstName}! Теперь вы можете приступить к обучению.

Нажмите кнопку ниже, чтобы открыть учебное приложение:`, {
          reply_markup: {
            inline_keyboard: [
              [
                this.getAppInlineButton(),
              ],
            ],
          },
        });

        // Отправляем reply-клавиатуру для постоянного доступа
        await ctx.reply('💡 Вы всегда можете открыть приложение, нажав кнопку ниже:', {
          reply_markup: this.getAppReplyKeyboard(),
        });
        break;
    }
  }

  /**
   * Отправка приветствия с WebApp кнопкой и reply-клавиатурой
   */
  private async sendWelcomeWithWebApp(ctx: Context, role: string) {
    const welcomeMessage = this.getWelcomeMessage(role);

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });

    // Отправляем reply-клавиатуру отдельным сообщением для постоянного отображения
    await ctx.reply('💡 Вы всегда можете открыть приложение, нажав кнопку ниже:', {
      reply_markup: this.getAppReplyKeyboard(),
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
   * Получить reply-клавиатуру с кнопкой "Открыть приложение"
   * Используется для постоянной клавиатуры в чате
   */
  private getAppReplyKeyboard() {
    return {
      keyboard: [
        [
          {
            text: '📚 Открыть приложение',
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: false, // Клавиатура всегда видна
    };
  }

  /**
   * Получить inline-кнопку "Открыть приложение"
   * Используется в уведомлениях
   */
  private getAppInlineButton() {
    return {
      text: '📚 Открыть приложение',
      web_app: { url: this.tmaUrl },
    };
  }

  /**
   * Отправить сообщение участнику
   * @param telegramId - Telegram ID пользователя
   * @param text - Текст сообщения
   * @param options - Дополнительные опции (клавиатура, parse_mode и т.д.)
   * @returns Объект отправленного сообщения с message_id
   */
  async sendMessage(telegramId: string, text: string, options?: any): Promise<any> {
    if (!this.bot || !this.isRunning) {
      this.logger.warn('Bot is not running. Cannot send message.');
      throw new Error('Bot is not running');
    }

    try {
      const sentMessage = await this.bot.api.sendMessage(telegramId, text, options);
      this.logger.debug(`Message sent to ${telegramId}, message_id: ${sentMessage.message_id}`);
      return sentMessage;
    } catch (error: any) {
      this.logger.error(`Failed to send message to ${telegramId}:`, error.message);
      throw error;
    }
  }

  /**
   * Отправить голосовое сообщение пользователю
   * @param telegramId - Telegram ID пользователя
   * @param fileId - Telegram file_id аудио
   * @param caption - Подпись к аудио (опционально)
   */
  async sendVoice(telegramId: string, fileId: string, caption?: string): Promise<any> {
    if (!this.bot || !this.isRunning) {
      this.logger.warn('Bot is not running. Cannot send voice.');
      throw new Error('Bot is not running');
    }

    try {
      const sentMessage = await this.bot.api.sendVoice(telegramId, fileId, {
        caption,
      });
      this.logger.debug(`Voice sent to ${telegramId}, message_id: ${sentMessage.message_id}`);
      return sentMessage;
    } catch (error: any) {
      this.logger.error(`Failed to send voice to ${telegramId}:`, error.message);
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
          [
            this.getAppInlineButton(),
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

      await this.sendMessage(learnerTelegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              this.getAppInlineButton(),
            ],
          ],
        },
      });
    } else if (submission.status === 'CURATOR_RETURNED') {
      const message = `↩️ Сдача возвращена на доработку

📚 Модуль: ${moduleIndex}
📝 Задание: ${stepTitle}

💬 Комментарий куратора:
${submission.curatorFeedback || 'Требуется доработка'}

Пожалуйста, доработайте и отправьте снова.`;

      await this.sendMessage(learnerTelegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              this.getAppInlineButton(),
            ],
          ],
        },
      });
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

    await this.sendMessage(learnerTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });
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
            this.getAppInlineButton(),
          ],
        ],
      },
    });
  }

  /**
   * Обработка голосовых сообщений и видео-заметок (для аудио-сдачи)
   * @param ctx - Контекст сообщения grammY
   * @param messageType - Тип сообщения ('voice' или 'video_note')
   */
  private async handleVoiceMessage(ctx: Context, messageType: 'voice' | 'video_note') {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      this.logger.warn('Voice message received without telegramId');
      return;
    }

    this.logger.log(`Received ${messageType} from ${telegramId}`);

    // Проверяем, что это reply на сообщение
    const replyToMessageId = ctx.message?.reply_to_message?.message_id;
    if (!replyToMessageId) {
      this.logger.warn(`${messageType} from ${telegramId} is not a reply to bot message`);
      await ctx.reply(
        '⚠️ Чтобы сдать аудио-задание, отправьте голосовое сообщение **ответом (реплаем)** на инструкцию бота.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    this.logger.log(`${messageType} is reply to message ${replyToMessageId}`);

    // Получаем file_id
    const fileId = messageType === 'voice' 
      ? ctx.message?.voice?.file_id 
      : ctx.message?.video_note?.file_id;
    
    if (!fileId) {
      this.logger.error(`Failed to get file_id from ${messageType}`);
      await ctx.reply('❌ Не удалось получить аудио-файл.');
      return;
    }

    this.logger.log(`Processing ${messageType} with file_id: ${fileId}`);

    // Отправляем подтверждение получения
    await ctx.reply('⏳ Обрабатываю ваше аудио-сообщение. Пожалуйста, подождите...');

    // Вызываем AudioSubmissionsService для обработки
    try {
      // Ленивая инжекция через ModuleRef для избежания циклической зависимости
      this.logger.debug('Getting AudioSubmissionsService from ModuleRef...');
      const { AudioSubmissionsService } = await import('../submissions/audio-submissions.service');
      const audioSubmissionsService = this.moduleRef.get(AudioSubmissionsService, { strict: false });
      
      if (!audioSubmissionsService) {
        throw new Error('AudioSubmissionsService not found in ModuleRef');
      }
      
      this.logger.log(`Calling processVoiceSubmission for ${telegramId}, reply_to: ${replyToMessageId}`);
      
      // Запускаем обработку в фоне (не блокируем обработчик)
      audioSubmissionsService.processVoiceSubmission(telegramId, replyToMessageId, fileId)
        .then(() => {
          this.logger.log(`Voice submission processed successfully for ${telegramId}`);
        })
        .catch((error: Error) => {
          this.logger.error(`Error in background voice processing for ${telegramId}:`, error);
          this.logger.error(`Error stack: ${error.stack}`);
        });
    } catch (error: any) {
      this.logger.error(`Failed to get AudioSubmissionsService: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Получить URL для скачивания файла из Telegram
   * @param fileId - file_id из Telegram
   * @returns URL для скачивания
   */
  async getFileUrl(fileId: string): Promise<string> {
    if (!this.bot || !this.isRunning) {
      throw new Error('Bot is not running');
    }

    try {
      const file = await this.bot.api.getFile(fileId);
      const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    } catch (error: any) {
      this.logger.error(`Failed to get file URL for ${fileId}:`, error.message);
      throw error;
    }
  }

  /**
   * Отправить уведомление о запросе повторной сдачи
   * @param curatorTelegramId - Telegram ID куратора
   * @param submission - Данные о сдаче
   */
  async notifyResubmissionRequested(
    curatorTelegramId: string,
    submission: any,
  ): Promise<void> {
    const userName = `${submission.user?.firstName || ''} ${submission.user?.lastName || ''}`.trim() || 'Участник';
    const moduleTitle = submission.module?.title || `Модуль ${submission.module?.index || '?'}`;
    const stepTitle = submission.step?.title || `Шаг ${submission.step?.index || '?'}`;

    const message = `🔄 Запрос на повторную сдачу

👤 Участник: ${userName}
📚 Модуль: ${moduleTitle}
📝 Задание: ${stepTitle}

Участник просит возможность отправить задание повторно.`;

    await this.sendMessage(curatorTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });
  }

  /**
   * Уведомить куратора о запросе повторной отправки (простая версия)
   * @param curatorTelegramId - Telegram ID куратора
   * @param message - Текст уведомления
   */
  async notifyCuratorAboutResubmissionRequest(
    curatorTelegramId: string,
    message: string,
  ): Promise<void> {
    await this.sendMessage(curatorTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });
  }

  /**
   * Уведомить ученика об удалении сдачи
   * @param learnerTelegramId - Telegram ID ученика
   * @param message - Текст уведомления
   */
  async notifyLearnerAboutSubmissionDeletion(
    learnerTelegramId: string,
    message: string,
  ): Promise<void> {
    await this.sendMessage(learnerTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });
  }

  /**
   * Уведомить ученика о принятии аудио-сдачи
   * @param learnerTelegramId - Telegram ID ученика
   * @param message - Текст уведомления
   */
  async notifyLearnerAboutAudioSubmission(
    learnerTelegramId: string,
    message: string,
  ): Promise<void> {
    await this.sendMessage(learnerTelegramId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            this.getAppInlineButton(),
          ],
        ],
      },
    });
  }

  /**
   * Обработать update от Telegram (для webhook режима)
   * @param update - Update объект от Telegram API
   */
  async handleUpdate(update: any): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialized. Cannot handle update.');
      return;
    }

    try {
      // Логируем входящий update для диагностики
      this.logger.log(`[handleUpdate] Received update: ${JSON.stringify(update).substring(0, 200)}...`);
      
      if (update.message?.text) {
        this.logger.log(`[handleUpdate] Message text: ${update.message.text}`);
      }
      
      if (update.message?.from) {
        this.logger.log(`[handleUpdate] From user: ${update.message.from.id} (${update.message.from.username || update.message.from.first_name})`);
      }
      
      await this.bot.handleUpdate(update);
      this.logger.debug(`[handleUpdate] Update processed successfully`);
    } catch (error: any) {
      this.logger.error('[handleUpdate] Error handling Telegram update:', error);
      this.logger.error(`[handleUpdate] Error message: ${error.message}`);
      this.logger.error(`[handleUpdate] Error stack: ${error.stack}`);
    }
  }

  /**
   * Установить webhook URL в Telegram
   * @param url - URL для webhook (опционально, берётся из env)
   */
  async setWebhook(url?: string): Promise<any> {
    if (!this.bot || !this.isRunning) {
      // В webhook режиме isRunning = true сразу, так что это ок
    }

    const webhookUrl = url || this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    
    if (!webhookUrl) {
      throw new Error('TELEGRAM_WEBHOOK_URL not set in .env');
    }

    try {
      const result = await this.bot.api.setWebhook(webhookUrl, {
        max_connections: 100, // Увеличено с 40 (default) до 100 для лучшей производительности
        drop_pending_updates: false, // Сохраняем необработанные обновления
      });
      this.logger.log(`✅ Webhook set to: ${webhookUrl}`);
      this.logger.log(`   Max connections: 100`);
      return {
        ok: true,
        message: 'Webhook set successfully',
        url: webhookUrl,
        maxConnections: 100,
        result,
      };
    } catch (error: any) {
      this.logger.error('Failed to set webhook:', error);
      throw error;
    }
  }

  /**
   * Получить информацию о текущем webhook
   */
  async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      const info = await this.bot.api.getWebhookInfo();
      return {
        ok: true,
        info,
      };
    } catch (error: any) {
      this.logger.error('Failed to get webhook info:', error);
      throw error;
    }
  }

  /**
   * Удалить webhook (переключиться обратно на polling)
   */
  async deleteWebhook(): Promise<any> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      this.logger.log('✅ Webhook deleted. Bot can use polling now.');
      return {
        ok: true,
        message: 'Webhook deleted successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to delete webhook:', error);
      throw error;
    }
  }
}



