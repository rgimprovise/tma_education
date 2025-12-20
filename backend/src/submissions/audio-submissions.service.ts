import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AudioSubmissionsService {
  private readonly logger = new Logger(AudioSubmissionsService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private aiService: AiService,
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Инициировать аудио-сдачу
   * 1. Проверить права доступа
   * 2. Создать/обновить Submission
   * 3. Отправить инструкцию в Telegram
   * 4. Сохранить message_id для связи с reply
   */
  async startAudioSubmission(
    userId: string,
    stepId: string,
    moduleId: string,
  ) {
    // 1. Получить пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, telegramId: true },
    });

    if (!user || !user.telegramId) {
      throw new BadRequestException('User not found or has no Telegram ID');
    }

    // 2. Проверить, что шаг существует и требует аудио/видео
    const step = await this.prisma.courseStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        title: true,
        content: true,
        expectedAnswer: true,
        moduleId: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    if (step.moduleId !== moduleId) {
      throw new BadRequestException('Step does not belong to this module');
    }

    if (step.expectedAnswer !== 'AUDIO' && step.expectedAnswer !== 'VIDEO') {
      throw new BadRequestException(
        'This step does not require audio/video submission',
      );
    }

    // 3. Проверить, что модуль открыт для пользователя
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        moduleId,
        status: 'IN_PROGRESS',
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'Module is not available for this user',
      );
    }

    // 4. Найти или создать Submission
    let submission = await this.prisma.submission.findUnique({
      where: {
        userId_stepId: {
          userId,
          stepId,
        },
      },
    });

    // Если submission уже есть и одобрена - нельзя пересдать
    if (submission && submission.status === 'CURATOR_APPROVED') {
      throw new BadRequestException(
        'This step is already approved by curator',
      );
    }

    // Если submission нет или статус CURATOR_RETURNED - можно создать/обновить
    if (!submission || submission.status === 'CURATOR_RETURNED') {
      // 5. Отправить инструкцию в Telegram
      const instructionText =
        `🎤 Аудио-сдача задания\n\n` +
        `📝 Задание: ${step.title}\n\n` +
        `Запишите ${step.expectedAnswer === 'AUDIO' ? 'голосовое сообщение' : 'видео-кружок'} с ответом на это задание и отправьте его **ответом (реплаем) на это сообщение**.\n\n` +
        `⚠️ Важно: обязательно отправьте аудио/видео **ответом на это сообщение**, иначе бот не сможет связать его с заданием.`;

      const sentMessage = await this.telegramService.sendMessage(
        user.telegramId,
        instructionText,
      );

      const messageId = sentMessage.message_id;

      // 6. Создать или обновить Submission
      if (submission) {
        // Обновляем существующий
        submission = await this.prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: 'SENT',
            answerType: step.expectedAnswer,
            telegramPromptMessageId: messageId,
            answerText: null, // Очищаем старые данные
            answerFileId: null,
            aiScore: null,
            aiFeedback: null,
            curatorScore: null,
            curatorFeedback: null,
            resubmissionRequested: false, // Сбрасываем запрос на повторную отправку
          },
        });
      } else {
        // Создаём новый
        submission = await this.prisma.submission.create({
          data: {
            userId,
            stepId,
            moduleId,
            answerType: step.expectedAnswer,
            status: 'SENT',
            telegramPromptMessageId: messageId,
          },
        });
      }

      return {
        success: true,
        message: 'Instruction sent to Telegram. Please reply with audio/video message.',
        submissionId: submission.id,
        telegramMessageId: messageId,
      };
    } else {
      // Submission уже отправлен и ещё не проверен
      throw new BadRequestException(
        'You have already submitted this step. Please wait for curator review or request resubmission.',
      );
    }
  }

  /**
   * Обработать голосовое/видео сообщение без reply
   * Находит активные сдачи с аудио/видео, возвращает их на доработку и отправляет инструкцию повторно
   */
  async handleVoiceMessageWithoutReply(
    telegramId: string,
  ): Promise<{ found: boolean; message: string }> {
    this.logger.log(`[handleVoiceMessageWithoutReply] Processing for telegramId=${telegramId}`);
    
    try {
      // 1. Найти пользователя
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, telegramId: true, firstName: true, lastName: true },
      });
      
      if (!user) {
        this.logger.warn(`[handleVoiceMessageWithoutReply] User not found: ${telegramId}`);
        return {
          found: false,
          message: '❌ Пользователь не найден в системе.',
        };
      }
      
      // 2. Найти активные сдачи с аудио/видео (статус SENT или AI_REVIEWED, без answerFileId)
      const activeSubmissions = await this.prisma.submission.findMany({
        where: {
          userId: user.id,
          answerType: {
            in: ['AUDIO', 'VIDEO'],
          },
          status: {
            in: ['SENT', 'AI_REVIEWED'],
          },
          answerFileId: null, // Только те, где файл не был получен
        },
        include: {
          step: {
            select: {
              id: true,
              title: true,
              expectedAnswer: true,
            },
          },
          module: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Самые свежие сначала
        },
      });
      
      if (activeSubmissions.length === 0) {
        this.logger.log(`[handleVoiceMessageWithoutReply] No active audio/video submissions found for ${telegramId}`);
        return {
          found: false,
          message: '⚠️ У вас нет активных заданий с аудио/видео ответом. Чтобы сдать задание, отправьте голосовое сообщение **ответом (реплаем)** на инструкцию бота.',
        };
      }
      
      this.logger.log(`[handleVoiceMessageWithoutReply] Found ${activeSubmissions.length} active submissions for ${telegramId}`);
      
      // 3. Для каждой сдачи: вернуть на доработку и отправить инструкцию
      const { SubmissionsService } = await import('./submissions.service');
      const submissionsService = this.moduleRef.get(SubmissionsService, { strict: false });
      
      if (!submissionsService) {
        throw new Error('SubmissionsService not found in ModuleRef');
      }
      
      let processedCount = 0;
      for (const submission of activeSubmissions) {
        try {
          // Возвращаем на доработку
          await submissionsService.updateStatus(
            submission.id,
            'CURATOR_RETURNED',
            undefined,
            'Автоматический возврат: ответ отправлен без reply на инструкцию бота. Пожалуйста, отправьте ответ реплаем на новую инструкцию.',
          );
          
          // Отправляем инструкцию повторно
          await this.startAudioSubmission(
            user.id,
            submission.stepId,
            submission.moduleId,
          );
          
          processedCount++;
          this.logger.log(`[handleVoiceMessageWithoutReply] Processed submission ${submission.id} for step ${submission.step.title}`);
        } catch (error: any) {
          this.logger.error(`[handleVoiceMessageWithoutReply] Error processing submission ${submission.id}:`, error);
          // Продолжаем обработку остальных
        }
      }
      
      if (processedCount > 0) {
        const stepTitles = activeSubmissions
          .slice(0, processedCount)
          .map(s => `"${s.step.title}"`)
          .join(', ');
        
        return {
          found: true,
          message: `⚠️ Вы отправили ${processedCount === 1 ? 'сообщение' : 'сообщения'} без ответа на инструкцию бота.\n\n` +
                   `📝 Задание${processedCount > 1 ? 'я' : ''}: ${stepTitles}\n\n` +
                   `✅ Я вернул ${processedCount === 1 ? 'его' : 'их'} на доработку и отправил новую инструкцию.\n\n` +
                   `⚠️ **Важно:** Отправьте ваш ответ **ответом (реплаем)** на новое сообщение с инструкцией, иначе бот не сможет связать его с заданием.`,
        };
      }
      
      return {
        found: false,
        message: '⚠️ Не удалось обработать ваши сдачи. Попробуйте позже или обратитесь к куратору.',
      };
    } catch (error: any) {
      this.logger.error(`[handleVoiceMessageWithoutReply] Error:`, error);
      return {
        found: false,
        message: '❌ Произошла ошибка при обработке. Попробуйте позже или обратитесь к куратору.',
      };
    }
  }

  /**
   * Обработать голосовое/видео сообщение от пользователя
   * 1. Найти Submission по reply_to_message_id
   * 2. Скачать файл из Telegram
   * 3. Транскрибировать через Whisper
   * 4. Оценить через AI
   * 5. Обновить Submission
   * 6. Уведомить куратора и ученика
   */
  async processVoiceSubmission(
    telegramId: string,
    replyToMessageId: number,
    fileId: string,
  ): Promise<void> {
    this.logger.log(`[processVoiceSubmission] Starting for telegramId=${telegramId}, replyTo=${replyToMessageId}, fileId=${fileId}`);
    
    try {
      // 1. Найти пользователя
      this.logger.debug(`[processVoiceSubmission] Looking up user by telegramId: ${telegramId}`);
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, telegramId: true, firstName: true, lastName: true },
      });
      
      if (!user) {
        this.logger.error(`[processVoiceSubmission] User not found: ${telegramId}`);
        throw new Error(`User not found for telegramId: ${telegramId}`);
      }
      
      this.logger.debug(`[processVoiceSubmission] User found: ${user.id}`);

      // 2. Найти Submission по telegramPromptMessageId
      this.logger.debug(`[processVoiceSubmission] Looking up submission by replyToMessageId: ${replyToMessageId}`);
      const submission = await this.prisma.submission.findFirst({
        where: {
          userId: user.id,
          telegramPromptMessageId: replyToMessageId,
        },
        include: {
          step: {
            select: {
              id: true,
              title: true,
              content: true,
              maxScore: true,
              aiRubric: true,
              requiresAiReview: true,
            },
          },
          module: {
            select: {
              id: true,
              index: true,
              title: true,
            },
          },
        },
      });

      if (!submission) {
        await this.telegramService.sendMessage(
          telegramId,
          '❌ Не удалось найти задание, к которому вы отправили аудио. Попробуйте начать заново из учебного приложения.',
        );
        return;
      }

      this.logger.log(`Processing voice submission ${submission.id} for user ${user.id}`);

      // 3. Скачать файл из Telegram
      const fileUrl = await this.telegramService.getFileUrl(fileId);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Определяем расширение файла (ogg для голосовых, mp4 для видео-заметок)
      const filename = submission.answerType === 'VIDEO' ? 'audio.mp4' : 'audio.ogg';

      this.logger.log(`Downloaded audio file, size: ${audioBuffer.length} bytes`);

      // 4. ВАЖНО: Сохраняем answerFileId СРАЗУ, чтобы файл не потерялся при ошибках транскрипции/ИИ
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          answerFileId: fileId,
        },
      });
      this.logger.log(`Saved answerFileId: ${fileId}`);

      // 5. Транскрибировать через Whisper (с обработкой ошибок)
      let transcription: string | null = null;
      try {
        transcription = await this.aiService.transcribeAudio(audioBuffer, filename);
        this.logger.log(`Transcription: ${transcription.substring(0, 100)}...`);
      } catch (transcriptionError: any) {
        this.logger.error(`[processVoiceSubmission] Transcription failed: ${transcriptionError.message}`);
        // Продолжаем без транскрипции - файл уже сохранен, куратор сможет прослушать вручную
      }

      // 6. Оценить через AI (если требуется и транскрипция успешна)
      let aiScore: number | null = null;
      let aiFeedback: string | null = null;
      let aiReviewStatus: 'SENT' | 'AI_REVIEWED' = 'SENT';

      if (submission.step.requiresAiReview && transcription) {
        try {
          const reviewResult = await this.aiService.reviewSubmission(
            submission.step.content,
            transcription,
            submission.step.maxScore,
            submission.step.aiRubric,
          );
          aiScore = reviewResult.score;
          aiFeedback = reviewResult.feedback;
          aiReviewStatus = 'AI_REVIEWED';
          this.logger.log(`AI review completed: score ${aiScore}/${submission.step.maxScore}`);
        } catch (aiError: any) {
          this.logger.error(`[processVoiceSubmission] AI review failed: ${aiError.message}`);
          // Если ошибка квоты - уведомляем кураторов
          if (aiError.message && (aiError.message.includes('quota') || aiError.message.includes('429'))) {
            this.notifyCuratorsAboutAIQuotaError(submission.id).catch((notifyError) => {
              this.logger.error(`[processVoiceSubmission] Failed to notify curators about quota error:`, notifyError);
            });
          }
          // Продолжаем без ИИ оценки - куратор проверит вручную
        }
      }

      // 7. Обновить Submission с транскрипцией и ИИ оценкой (если есть)
      const updatedSubmission = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          answerText: transcription,
          aiScore,
          aiFeedback,
          status: aiReviewStatus,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          },
          module: {
            select: {
              index: true,
              title: true,
            },
          },
          step: {
            select: {
              index: true,
              title: true,
            },
          },
        },
      });

      // 7. Уведомить ученика (БЕЗ AI оценки - она только для куратора)
      const learnerMessage = `✅ Аудио принято и обработано!\n\n⏳ Ваш ответ отправлен куратору на проверку. Результат появится после проверки куратором.`;

      await this.telegramService.notifyLearnerAboutAudioSubmission(user.telegramId!, learnerMessage);

      // 8. Найти кураторов и уведомить их
      const curators = await this.prisma.user.findMany({
        where: {
          role: { in: ['CURATOR', 'ADMIN'] },
        },
        select: { telegramId: true },
      });

      // Фильтруем кураторов с telegramId и уведомляем
      for (const curator of curators) {
        if (curator.telegramId && curator.telegramId !== null) {
          await this.telegramService.notifyCuratorAboutSubmission(
            curator.telegramId,
            updatedSubmission,
          );
        }
      }

      this.logger.log(`[processVoiceSubmission] Successfully processed voice submission ${submission.id}`);
    } catch (error: any) {
      this.logger.error(`[processVoiceSubmission] Error processing voice submission for ${telegramId}:`, error);
      this.logger.error(`[processVoiceSubmission] Error message: ${error.message}`);
      this.logger.error(`[processVoiceSubmission] Error stack: ${error.stack}`);
      
      // Отправляем ученику общее сообщение об ошибке (БЕЗ технических деталей)
      try {
        await this.telegramService.sendMessage(
          telegramId,
          `❌ Произошла ошибка при обработке аудио.\n\nПопробуйте отправить ответ заново или обратитесь к куратору.`,
        );
      } catch (sendError: any) {
        this.logger.error(`[processVoiceSubmission] Failed to send error message to user:`, sendError);
      }
    }
  }

  /**
   * Уведомить кураторов об ошибке квоты OpenAI API
   */
  private async notifyCuratorsAboutAIQuotaError(submissionId: string): Promise<void> {
    // Загружаем submission с нужными данными
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        step: {
          select: {
            index: true,
            title: true,
          },
        },
        module: {
          select: {
            index: true,
            title: true,
          },
        },
      },
    });

    if (!submission) {
      this.logger.error(`[AudioSubmissionsService.notifyCuratorsAboutAIQuotaError] Submission ${submissionId} not found`);
      return;
    }

    const curators = await this.prisma.user.findMany({
      where: {
        role: {
          in: ['CURATOR', 'ADMIN'],
        },
      },
      select: {
        telegramId: true,
      },
    });

    const curatorsWithTelegram = curators.filter((c) => c.telegramId !== null);

    const user = submission.user;
    const step = submission.step;
    const module = submission.module;

    const message = `⚠️ Ошибка проверки ИИ (аудио)\n\n` +
      `Не удалось проверить аудио-ответ ученика через ИИ из-за превышения квоты OpenAI API.\n\n` +
      `Ученик: ${user?.firstName || ''} ${user?.lastName || ''}\n` +
      `Модуль: ${module?.index || '?'} - ${module?.title || '?'}\n` +
      `Шаг: ${step?.index || '?'} - ${step?.title || '?'}\n\n` +
      `Аудио-файл сохранен. Пожалуйста, прослушайте его вручную в интерфейсе куратора.`;

    const notifications = curatorsWithTelegram.map((curator) =>
      this.telegramService.sendMessage(curator.telegramId!, message).catch((error) => {
        this.logger.error(`Failed to notify curator ${curator.telegramId} about quota error:`, error);
      }),
    );

    await Promise.all(notifications);
  }

  /**
   * Получить аудио-файл из Telegram для воспроизведения куратором
   * @param fileId - Telegram file_id
   * @returns Buffer с аудио + metadata
   */
  async getAudioFile(fileId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    this.logger.log(`[getAudioFile] Downloading file: ${fileId}`);

    try {
      // Получить URL файла из Telegram
      const fileUrl = await this.telegramService.getFileUrl(fileId);
      
      // Скачать файл
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Определить MIME type по file_id или расширению
      // Telegram voice - обычно ogg/opus, video_note - mp4
      const mimeType = fileUrl.includes('.mp4') 
        ? 'video/mp4' 
        : 'audio/ogg';
      
      const filename = fileUrl.includes('.mp4') 
        ? `audio_${Date.now()}.mp4` 
        : `audio_${Date.now()}.ogg`;
      
      this.logger.log(`[getAudioFile] File downloaded: ${buffer.length} bytes, mimeType: ${mimeType}`);
      
      return {
        buffer,
        mimeType,
        filename,
      };
    } catch (error: any) {
      this.logger.error(`[getAudioFile] Error downloading file ${fileId}:`, error);
      throw new Error(`Failed to get audio file: ${error.message}`);
    }
  }

  /**
   * Отправить аудио куратору в Telegram-чат
   * @param submissionId - ID сдачи
   * @param curatorId - ID куратора (текущий пользователь)
   */
  async sendAudioToCurator(submissionId: string, curatorId: string) {
    this.logger.log(`[sendAudioToCurator] Sending audio for submission ${submissionId} to curator ${curatorId}`);

    // 1. Получить куратора
    const curator = await this.prisma.user.findUnique({
      where: { id: curatorId },
      select: { id: true, telegramId: true, firstName: true },
    });

    if (!curator || !curator.telegramId) {
      throw new BadRequestException('Curator not found or has no Telegram ID');
    }

    // 2. Получить submission с answerFileId
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        answerFileId: true,
        answerType: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        step: {
          select: {
            title: true,
            index: true,
          },
        },
        module: {
          select: {
            title: true,
            index: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (!submission.answerFileId) {
      throw new BadRequestException('This submission has no audio file');
    }

    // 3. Отправить аудио в Telegram
    const caption = 
      `🎤 Голосовое сообщение ученика\n\n` +
      `👤 Ученик: ${submission.user.firstName} ${submission.user.lastName}\n` +
      `📚 Модуль ${submission.module.index}: ${submission.module.title}\n` +
      `📝 Задание ${submission.step.index}: ${submission.step.title}`;

    try {
      await this.telegramService.sendVoice(
        curator.telegramId,
        submission.answerFileId,
        caption,
      );

      this.logger.log(`[sendAudioToCurator] Audio sent successfully to curator ${curatorId}`);

      return {
        success: true,
        message: 'Аудио отправлено вам в чат с ботом',
      };
    } catch (error: any) {
      this.logger.error(`[sendAudioToCurator] Error sending voice:`, error);
      throw new BadRequestException('Failed to send audio to Telegram');
    }
  }
}

