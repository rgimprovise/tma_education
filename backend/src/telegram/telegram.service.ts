import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Bot, Context, InputFile } from 'grammy';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
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
 * Состояния для вопросов куратору
 */
enum QuestionState {
  WAITING_QUESTION = 'WAITING_QUESTION',
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
 * Данные состояния ожидания вопроса от ученика
 */
interface UserQuestionData {
  state: QuestionState;
  userId: string;
  telegramId: string;
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
  
  // Хранилище состояний ожидания вопроса от учеников (telegramId -> QuestionData)
  private questionStates: Map<string, UserQuestionData> = new Map();
  
  // Хранилище соответствий сообщений куратора и ученика (messageId куратора -> telegramId ученика)
  // Используется для обработки reply от куратора
  private curatorReplyMap: Map<number, string> = new Map();

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private prisma: PrismaService,
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

        // Обработка кнопки "Задать вопрос куратору"
        if (text === '❓ Задать вопрос куратору') {
          await this.handleAskQuestionButton(ctx, telegramId);
          return;
        }

        // Проверяем, находится ли пользователь в процессе ожидания вопроса
        const questionData = this.questionStates.get(telegramId);
        if (questionData) {
          await this.handleQuestionMessage(ctx, questionData);
          return;
        }

        // Проверяем, находится ли пользователь в процессе регистрации
        const registrationData = this.registrationStates.get(telegramId);
        if (registrationData) {
          await this.handleRegistrationStep(ctx, registrationData);
          return;
        }

        // Обработка reply от куратора (ответ на вопрос ученика)
        if (ctx.message?.reply_to_message) {
          await this.handleCuratorReply(ctx, telegramId);
          return;
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

    // Обработка callback_query для куратора (одобрение/возврат сдачи)
    this.bot.callbackQuery(/^curator_/, async (ctx: Context) => {
      try {
        const callbackData = ctx.callbackQuery?.data;
        if (!callbackData) {
          await ctx.answerCallbackQuery('Ошибка: нет данных');
          return;
        }

        const telegramId = ctx.from?.id.toString();
        if (!telegramId) {
          await ctx.answerCallbackQuery('Ошибка: не удалось определить пользователя');
          return;
        }

        // Проверяем, что пользователь - куратор
        const user = await this.usersService.findByTelegramId(telegramId);
        if (!user || (user.role !== 'CURATOR' && user.role !== 'ADMIN')) {
          await ctx.answerCallbackQuery('❌ Доступ запрещён. Только кураторы могут проверять работы.');
          return;
        }

        // Парсим callback_data
        if (callbackData.startsWith('curator_approve_')) {
          const submissionId = callbackData.replace('curator_approve_', '');
          await this.handleApproveSubmission(ctx, submissionId, user.id);
        } else if (callbackData.startsWith('curator_return_')) {
          const submissionId = callbackData.replace('curator_return_', '');
          await this.handleReturnSubmission(ctx, submissionId, user.id);
        } else {
          await ctx.answerCallbackQuery('Неизвестная команда');
        }
      } catch (error: any) {
        this.logger.error('Error handling callback query:', error);
        await ctx.answerCallbackQuery('❌ Произошла ошибка. Попробуйте позже.');
      }
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
      
      // Если новый пользователь - LEARNER, автоматически открываем модули с autoUnlockForNewLearners = true
      if (user.role === 'LEARNER') {
        try {
          const { CourseService } = await import('../course/course.service');
          const courseService = this.moduleRef.get(CourseService, { strict: false });
          if (courseService) {
            // Вызываем асинхронно, не блокируя ответ
            courseService.autoUnlockModulesForNewLearner(user.id).catch((error) => {
              this.logger.error(`Failed to auto-unlock modules for new learner ${user.id}:`, error);
            });
          }
        } catch (error) {
          this.logger.error(`Failed to get CourseService for auto-unlock for user ${user.id}:`, error);
          // Не критично, продолжаем
        }
      }
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
          reply_markup: this.getAppReplyKeyboard(user.role),
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
      reply_markup: this.getAppReplyKeyboard(role),
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
  private getAppReplyKeyboard(role?: string) {
    const keyboard: any[] = [
        [
          {
            text: '📚 Открыть приложение',
          },
        ],
    ];

    // Для учеников добавляем кнопку "Задать вопрос куратору"
    if (role === 'LEARNER') {
      keyboard.push([
        {
          text: '❓ Задать вопрос куратору',
        },
      ]);
    }

    return {
      keyboard,
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
    const maxScore = submission.step?.maxScore || 10;
    const aiScore = submission.aiScore !== null && submission.aiScore !== undefined 
      ? `${submission.aiScore}/${maxScore}` 
      : 'не оценено';

    // Очищаем aiFeedback от JSON-форматирования, если оно там есть
    let aiFeedbackText = submission.aiFeedback || '';
    if (aiFeedbackText) {
      try {
        // Если это JSON строка, пытаемся распарсить и извлечь только feedback
        const parsed = JSON.parse(aiFeedbackText);
        if (parsed.feedback && typeof parsed.feedback === 'string') {
          aiFeedbackText = parsed.feedback;
        } else if (typeof parsed === 'string') {
          aiFeedbackText = parsed;
        }
      } catch (e) {
        // Если не JSON, оставляем как есть
      }
      // Убираем markdown code blocks если есть
      aiFeedbackText = aiFeedbackText.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
      aiFeedbackText = aiFeedbackText.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    }

    const message = `📬 Новая сдача задания

👤 Участник: ${userName}
📚 Модуль: ${moduleIndex}
📝 Шаг: ${stepIndex}

🤖 Предварительная оценка ИИ: ${aiScore}

${aiFeedbackText ? `💬 Комментарий ИИ:\n${aiFeedbackText}\n` : ''}
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
    const maxScore = submission.step?.maxScore || 10;

    if (submission.status === 'CURATOR_APPROVED') {
      const message = `✅ Ваша сдача одобрена!

📚 Модуль: ${moduleIndex}
📝 Задание: ${stepTitle}

${submission.curatorScore !== null ? `⭐ Оценка: ${submission.curatorScore}/${maxScore}\n` : ''}
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
   * Отправить уведомление о блокировке модуля
   * @param learnerTelegramId - Telegram ID обучающегося
   * @param moduleIndex - Индекс модуля
   * @param moduleTitle - Название модуля
   */
  async notifyModuleLocked(
    learnerTelegramId: string,
    moduleIndex: number,
    moduleTitle: string,
  ): Promise<void> {
    const message = `🔒 Модуль заблокирован

📚 Модуль ${moduleIndex}: "${moduleTitle}"

Доступ к этому модулю временно закрыт куратором.

Обратитесь к куратору для получения доступа.`;

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

    // Получаем replyToMessageId (может быть null - это нормально, обработаем)
    const replyToMessageId = ctx.message?.reply_to_message?.message_id || null;
    
    if (!replyToMessageId) {
      this.logger.log(`${messageType} from ${telegramId} without reply - will try to find active submission`);
    } else {
      this.logger.log(`${messageType} from ${telegramId} is reply to message ${replyToMessageId}`);
    }

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
    const confirmationMessage = replyToMessageId 
      ? '⏳ Обрабатываю ваше аудио-сообщение. Пожалуйста, подождите...'
      : '⏳ Обрабатываю ваше аудио-сообщение. Ищу соответствующее задание...';
    await ctx.reply(confirmationMessage);

    // Вызываем AudioSubmissionsService для обработки
    try {
      // Ленивая инжекция через ModuleRef для избежания циклической зависимости
      this.logger.debug('Getting AudioSubmissionsService from ModuleRef...');
      const { AudioSubmissionsService } = await import('../submissions/audio-submissions.service');
      const audioSubmissionsService = this.moduleRef.get(AudioSubmissionsService, { strict: false });
      
      if (!audioSubmissionsService) {
        throw new Error('AudioSubmissionsService not found in ModuleRef');
      }
      
      this.logger.log(`Calling processVoiceSubmission for ${telegramId}, reply_to: ${replyToMessageId || 'none'}`);
      
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
   * Уведомить ученика о разрешении повторной отправки
   * @param learnerTelegramId - Telegram ID ученика
   * @param moduleIndex - Индекс модуля
   * @param moduleTitle - Название модуля
   * @param stepIndex - Индекс шага
   * @param stepTitle - Название шага
   */
  async notifyLearnerAboutResubmissionApproval(
    learnerTelegramId: string,
    moduleIndex: number,
    moduleTitle: string,
    stepIndex: number,
    stepTitle: string,
  ): Promise<void> {
    const message = `✅ Ваш запрос на повторную отправку одобрен!

📚 Модуль ${moduleIndex}: ${moduleTitle}
📝 Шаг ${stepIndex}: ${stepTitle}

🔄 Ваш предыдущий ответ был удалён. Теперь вы можете выполнить задание заново.

Откройте приложение и отправьте новый ответ!`;

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
   * Обработать одобрение сдачи через callback-кнопку
   */
  private async handleApproveSubmission(ctx: Context, submissionId: string, curatorId: string) {
    try {
      // Lazy load SubmissionsService
      const { SubmissionsService } = await import('../submissions/submissions.service');
      const submissionsService = this.moduleRef.get(SubmissionsService, { strict: false });

      if (!submissionsService) {
        await ctx.answerCallbackQuery('❌ Ошибка: сервис недоступен');
        return;
      }

      // Получаем submission для проверки
      const submission = await submissionsService.findById(submissionId);
      if (!submission) {
        await ctx.answerCallbackQuery('❌ Сдача не найдена');
        return;
      }

      // Проверяем, что куратор имеет доступ
      // (в будущем можно добавить проверку прав)

      // Одобряем сдачу (используем максимальный балл по умолчанию, если не указан)
      const maxScore = submission.step?.maxScore || 10;
      const curatorScore = maxScore; // По умолчанию максимальный балл при одобрении через кнопку

      await submissionsService.updateStatus(
        submissionId,
        'CURATOR_APPROVED',
        curatorScore,
        'Одобрено куратором через Telegram',
      );

      // Обновляем сообщение в Telegram
      const message = ctx.callbackQuery?.message;
      if (message && 'message_id' in message) {
        const userName = `${submission.user?.firstName || ''} ${submission.user?.lastName || ''}`.trim() || 'Участник';
        const updatedText = `✅ Сдача одобрена куратором

👤 Участник: ${userName}
📚 Модуль: ${submission.module?.index || '?'}
📝 Шаг: ${submission.step?.index || '?'}

⭐ Оценка: ${curatorScore}/${maxScore}
💬 Комментарий: Одобрено куратором через Telegram`;

        try {
          await ctx.api.editMessageText(message.chat.id, message.message_id, updatedText, {
            reply_markup: {
              inline_keyboard: [
                [
                  this.getAppInlineButton(),
                ],
              ],
            },
          });
        } catch (editError: any) {
          this.logger.warn('Failed to edit message:', editError);
          // Не критично, продолжаем
        }
      }

      await ctx.answerCallbackQuery('✅ Сдача одобрена!');
    } catch (error: any) {
      this.logger.error('Error handling approve submission:', error);
      await ctx.answerCallbackQuery('❌ Ошибка при одобрении сдачи');
    }
  }

  /**
   * Обработать возврат сдачи на доработку через callback-кнопку
   */
  private async handleReturnSubmission(ctx: Context, submissionId: string, curatorId: string) {
    try {
      // Lazy load SubmissionsService
      const { SubmissionsService } = await import('../submissions/submissions.service');
      const submissionsService = this.moduleRef.get(SubmissionsService, { strict: false });

      if (!submissionsService) {
        await ctx.answerCallbackQuery('❌ Ошибка: сервис недоступен');
        return;
      }

      // Получаем submission для проверки
      const submission = await submissionsService.findById(submissionId);
      if (!submission) {
        await ctx.answerCallbackQuery('❌ Сдача не найдена');
        return;
      }

      // Возвращаем сдачу на доработку
      await submissionsService.updateStatus(
        submissionId,
        'CURATOR_RETURNED',
        undefined,
        'Возвращено на доработку куратором через Telegram. Пожалуйста, доработайте и отправьте снова.',
      );

      // Обновляем сообщение в Telegram
      const message = ctx.callbackQuery?.message;
      if (message && 'message_id' in message) {
        const userName = `${submission.user?.firstName || ''} ${submission.user?.lastName || ''}`.trim() || 'Участник';
        const updatedText = `↩️ Сдача возвращена на доработку

👤 Участник: ${userName}
📚 Модуль: ${submission.module?.index || '?'}
📝 Шаг: ${submission.step?.index || '?'}

💬 Комментарий: Возвращено на доработку куратором через Telegram. Пожалуйста, доработайте и отправьте снова.`;

        try {
          await ctx.api.editMessageText(message.chat.id, message.message_id, updatedText, {
            reply_markup: {
              inline_keyboard: [
                [
                  this.getAppInlineButton(),
                ],
              ],
            },
          });
        } catch (editError: any) {
          this.logger.warn('Failed to edit message:', editError);
          // Не критично, продолжаем
        }
      }

      await ctx.answerCallbackQuery('↩️ Сдача возвращена на доработку');
    } catch (error: any) {
      this.logger.error('Error handling return submission:', error);
      await ctx.answerCallbackQuery('❌ Ошибка при возврате сдачи');
    }
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

  /**
   * Обработка нажатия кнопки "Задать вопрос куратору"
   */
  private async handleAskQuestionButton(ctx: Context, telegramId: string) {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      await ctx.reply('❌ Пользователь не найден. Отправьте /start для регистрации.');
      return;
    }

    if (!user.profileCompleted) {
      await ctx.reply('⚠️ Завершите регистрацию, отправив /start');
      return;
    }

    if (user.role !== 'LEARNER') {
      await ctx.reply('❌ Эта функция доступна только для учеников.');
      return;
    }

    // Устанавливаем состояние ожидания вопроса
    this.questionStates.set(telegramId, {
      state: QuestionState.WAITING_QUESTION,
      userId: user.id,
      telegramId,
    });

    await ctx.reply('📝 Пожалуйста, напишите ваше сообщение для куратора:');
  }

  /**
   * Обработка сообщения с вопросом от ученика
   */
  private async handleQuestionMessage(ctx: Context, questionData: UserQuestionData) {
    const text = ctx.message?.text?.trim();
    if (!text) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение.');
      return;
    }

    this.logger.log(`[handleQuestionMessage] Processing question from user ${questionData.telegramId}`);

    try {
      // Получаем информацию об ученике
      const user = await this.usersService.findByTelegramId(questionData.telegramId);
      if (!user) {
        this.logger.error(`[handleQuestionMessage] User not found: ${questionData.telegramId}`);
        await ctx.reply('❌ Пользователь не найден.');
        this.questionStates.delete(questionData.telegramId);
        return;
      }

      this.logger.log(`[handleQuestionMessage] User found: ${user.id}, role: ${user.role}`);

      // Формируем информацию об отправителе
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Ученик';
      const userInfo = [
        `👤 От: ${userName}`,
        user.position ? `💼 Должность: ${user.position}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const messageToCurator = `❓ Вопрос от ученика\n\n${userInfo}\n\n📝 Сообщение:\n${text}`;

      // Проверяем, что prisma доступен
      if (!this.prisma) {
        this.logger.error('[handleQuestionMessage] PrismaService is not available');
        throw new Error('PrismaService is not available');
      }

      // Находим всех кураторов
      this.logger.log('[handleQuestionMessage] Searching for curators...');
      const allCurators = await this.prisma.user.findMany({
        where: {
          role: { in: ['CURATOR', 'ADMIN'] },
        },
        select: {
          telegramId: true,
        },
      });
      
      // Фильтруем кураторов с telegramId (не null)
      const curators = allCurators.filter((c) => c.telegramId !== null);

      this.logger.log(`[handleQuestionMessage] Found ${curators.length} curators`);

      if (curators.length === 0) {
        await ctx.reply('❌ К сожалению, сейчас нет доступных кураторов. Попробуйте позже.');
        this.questionStates.delete(questionData.telegramId);
        return;
      }

      // Отправляем сообщение каждому куратору
      this.logger.log('[handleQuestionMessage] Sending messages to curators...');
      const sentMessages = await Promise.all(
        curators.map(async (curator) => {
          if (!curator.telegramId) return null;
          
          try {
            this.logger.log(`[handleQuestionMessage] Sending to curator ${curator.telegramId}`);
            const sentMessage = await this.sendMessage(curator.telegramId, messageToCurator);
            
            // Сохраняем соответствие messageId куратора и telegramId ученика для обработки reply
            if (sentMessage?.message_id) {
              this.curatorReplyMap.set(sentMessage.message_id, questionData.telegramId);
              this.logger.log(`[handleQuestionMessage] Saved reply mapping: messageId ${sentMessage.message_id} -> learner ${questionData.telegramId}`);
            }
            
            return sentMessage;
          } catch (error: any) {
            this.logger.error(`[handleQuestionMessage] Failed to send question to curator ${curator.telegramId}:`, error);
            this.logger.error(`[handleQuestionMessage] Error details: ${error.message}, stack: ${error.stack}`);
            return null;
          }
        }),
      );

      const successCount = sentMessages.filter((m) => m !== null).length;
      this.logger.log(`[handleQuestionMessage] Successfully sent to ${successCount}/${curators.length} curators`);

      // Удаляем состояние ожидания вопроса
      this.questionStates.delete(questionData.telegramId);

      // Подтверждаем ученику
      await ctx.reply('✅ Ваше сообщение успешно отправлено куратору. Ответ придет в этом чате.');
    } catch (error: any) {
      this.logger.error('[handleQuestionMessage] Error handling question message:', error);
      this.logger.error(`[handleQuestionMessage] Error type: ${error?.constructor?.name}`);
      this.logger.error(`[handleQuestionMessage] Error message: ${error?.message}`);
      this.logger.error(`[handleQuestionMessage] Error stack: ${error?.stack}`);
      await ctx.reply('❌ Произошла ошибка при отправке сообщения. Попробуйте позже.');
      this.questionStates.delete(questionData.telegramId);
    }
  }

  /**
   * Обработка reply от куратора (ответ на вопрос ученика)
   */
  private async handleCuratorReply(ctx: Context, curatorTelegramId: string) {
    const replyToMessage = ctx.message?.reply_to_message;
    if (!replyToMessage) {
      return; // Не reply сообщение
    }

    const replyToMessageId = replyToMessage.message_id;
    const learnerTelegramId = this.curatorReplyMap.get(replyToMessageId);

    if (!learnerTelegramId) {
      // Это не reply на вопрос ученика, игнорируем
      return;
    }

    // Проверяем, что отправитель - куратор
    const curator = await this.usersService.findByTelegramId(curatorTelegramId);
    if (!curator || (curator.role !== UserRole.CURATOR && curator.role !== UserRole.ADMIN)) {
      await ctx.reply('❌ Только кураторы могут отвечать на вопросы учеников.');
      return;
    }

    const replyText = ctx.message?.text?.trim();
    if (!replyText) {
      await ctx.reply('❌ Пожалуйста, отправьте текстовое сообщение.');
      return;
    }

    // Формируем ответ для ученика
    const curatorName = `${curator.firstName || ''} ${curator.lastName || ''}`.trim() || 'Куратор';
    const messageToLearner = `💬 Ответ от куратора ${curatorName}:\n\n${replyText}`;

    try {
      // Отправляем ответ ученику
      await this.sendMessage(learnerTelegramId, messageToLearner);
      
      // Подтверждаем куратору
      await ctx.reply('✅ Ваш ответ отправлен ученику.');
    } catch (error) {
      this.logger.error(`Failed to send reply to learner ${learnerTelegramId}:`, error);
      await ctx.reply('❌ Произошла ошибка при отправке ответа. Попробуйте позже.');
    }
  }

  /**
   * Отправить HTML-файл (отчёт) пользователю
   * @param telegramId - Telegram ID пользователя
   * @param htmlContent - Содержимое HTML файла
   * @param filename - Имя файла
   * @param caption - Подпись к файлу (опционально)
   */
  async sendDocument(
    telegramId: string,
    htmlContent: string,
    filename: string,
    caption?: string,
  ): Promise<any> {
    if (!this.bot || !this.isRunning) {
      this.logger.warn('Bot is not running. Cannot send document.');
      throw new Error('Bot is not running');
    }

    try {
      // Создаём InputFile из строки HTML
      const file = new InputFile(
        Buffer.from(htmlContent, 'utf-8'),
        filename,
      );

      const sentMessage = await this.bot.api.sendDocument(telegramId, file, {
        caption,
        parse_mode: 'HTML',
      });

      this.logger.debug(`Document sent to ${telegramId}, message_id: ${sentMessage.message_id}`);
      return sentMessage;
    } catch (error: any) {
      this.logger.error(`Failed to send document to ${telegramId}:`, error.message);
      throw error;
    }
  }
}



