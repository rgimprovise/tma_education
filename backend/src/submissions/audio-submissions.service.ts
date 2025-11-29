import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AudioSubmissionsService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
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
}

