import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { TelegramService } from '../telegram/telegram.service';
import { AnswerType, SubmissionStatus, StepType } from '@prisma/client';

interface CreateSubmissionDto {
  userId: string;
  stepId: string;
  moduleId: string;
  answerText?: string;
  answerFileId?: string;
  answerType: AnswerType;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private telegramService: TelegramService,
  ) {}

  /**
   * Создать сдачу задания с валидацией
   * Проверяет:
   * - Модуль доступен (IN_PROGRESS)
   * - Шаг существует и правильного типа (не INFO)
   * - Нельзя сдать шаг дважды
   * - Тип ответа соответствует ожидаемому
   */
  async create(data: CreateSubmissionDto) {
    // 1. Проверяем, что шаг существует
    const step = await this.prisma.courseStep.findUnique({
      where: { id: data.stepId },
      include: {
        module: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    // 2. Проверяем, что шаг принадлежит указанному модулю
    if (step.moduleId !== data.moduleId) {
      throw new BadRequestException('Step does not belong to the specified module');
    }

    // 3. Проверяем, что шаг не является информационным (INFO)
    if (step.type === 'INFO') {
      throw new BadRequestException('Cannot submit answer for INFO step');
    }

    // 4. Проверяем, что модуль доступен пользователю (IN_PROGRESS)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: data.userId,
        moduleId: data.moduleId,
      },
    });

    if (!enrollment || enrollment.status !== 'IN_PROGRESS') {
      throw new ForbiddenException('Module is not available. Please wait for curator to unlock it.');
    }

    // 5. Проверяем, существует ли submission для этого шага
    const existingSubmission = await this.prisma.submission.findFirst({
      where: {
        userId: data.userId,
        stepId: data.stepId,
      },
    });

    // Если submission существует и статус не CURATOR_RETURNED - блокируем
    // Если статус CURATOR_RETURNED - разрешаем обновление (ученик переделывает задание)
    if (existingSubmission && existingSubmission.status !== 'CURATOR_RETURNED') {
      throw new BadRequestException('You have already submitted this step');
    }

    // 6. Валидация типа ответа
    if (step.expectedAnswer !== data.answerType) {
      throw new BadRequestException(
        `Expected answer type is ${step.expectedAnswer}, but got ${data.answerType}`,
      );
    }

    // 7. Проверяем наличие ответа
    if (data.answerType === 'TEXT' && !data.answerText?.trim()) {
      throw new BadRequestException('Answer text is required for TEXT type');
    }

    if (data.answerType !== 'TEXT' && !data.answerFileId) {
      throw new BadRequestException(`File ID is required for ${data.answerType} type`);
    }

    // 8. Создаём или обновляем сдачу
    // Если submission существует со статусом CURATOR_RETURNED - обновляем (ученик переделывает задание)
    // Иначе создаём новую
    let submission;
    if (existingSubmission && existingSubmission.status === 'CURATOR_RETURNED') {
      // Обновляем существующую submission (ученик переделывает задание после возврата)
      submission = await this.prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          answerText: data.answerText,
          answerFileId: data.answerFileId,
          answerType: data.answerType,
          status: 'SENT', // Сбрасываем статус на SENT для новой проверки
          // Очищаем оценки и комментарии куратора (они сохранены в истории)
          curatorScore: null,
          curatorFeedback: null,
          // Очищаем оценки ИИ (будет новая проверка)
          aiScore: null,
          aiFeedback: null,
        },
        include: {
          step: {
            select: {
              id: true,
              title: true,
              index: true,
              type: true,
              requiresAiReview: true,
              content: true,
              maxScore: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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
    } else {
      // Создаём новую submission
      submission = await this.prisma.submission.create({
      data: {
        userId: data.userId,
        stepId: data.stepId,
        moduleId: data.moduleId,
        answerText: data.answerText,
        answerFileId: data.answerFileId,
        answerType: data.answerType,
        status: 'SENT',
      },
      include: {
        step: {
          select: {
            id: true,
            title: true,
            index: true,
            type: true,
            requiresAiReview: true,
            content: true,
            maxScore: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
    }

    // 9. Если требуется проверка ИИ, запускаем асинхронно
    console.log(`[SubmissionsService.create] Step ${submission.step.id} requiresAiReview: ${submission.step.requiresAiReview}`);
    if (submission.step.requiresAiReview) {
      console.log(`[SubmissionsService.create] Starting AI review for submission ${submission.id}`);
      this.reviewWithAI(submission.id).catch((error) => {
        console.error('[SubmissionsService.create] AI review failed:', error);
        console.error('[SubmissionsService.create] Error message:', error.message);
        if (error.stack) {
          console.error('[SubmissionsService.create] Error stack:', error.stack);
        }
        // Если ошибка квоты - уведомляем кураторов
        if (error.message && (error.message.includes('quota') || error.message.includes('429'))) {
          this.notifyCuratorsAboutAIQuotaError(submission.id).catch((notifyError) => {
            console.error('[SubmissionsService.create] Failed to notify curators about quota error:', notifyError);
          });
        }
      });
    } else {
      console.log(`[SubmissionsService.create] AI review skipped - requiresAiReview is false/null`);
    }

    return submission;
  }

  async reviewWithAI(submissionId: string) {
    console.log(`[SubmissionsService.reviewWithAI] Starting review for submission ${submissionId}`);
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        step: true,
        user: true,
      },
    });

    if (!submission) {
      console.error(`[SubmissionsService.reviewWithAI] Submission ${submissionId} not found`);
      return;
    }

    console.log(`[SubmissionsService.reviewWithAI] Submission found, step requiresAiReview: ${submission.step.requiresAiReview}`);
    console.log(`[SubmissionsService.reviewWithAI] Step ID: ${submission.step.id}, aiRubric: ${submission.step.aiRubric ? 'present' : 'missing'}`);

    if (!submission.step.requiresAiReview) {
      console.log(`[SubmissionsService.reviewWithAI] Skipping - requiresAiReview is false/null`);
      return;
    }

    console.log(`[SubmissionsService.reviewWithAI] Calling aiService.reviewSubmission...`);
    let review: { score: number; feedback: string } | null = null;
    try {
      review = await this.aiService.reviewSubmission(
        submission.step.content,
        submission.answerText || '',
        submission.step.maxScore,
        submission.step.aiRubric || undefined,
      );
      console.log(`[SubmissionsService.reviewWithAI] AI review completed: score=${review.score}`);
    } catch (aiError: any) {
      console.error(`[SubmissionsService.reviewWithAI] AI review failed: ${aiError.message}`);
      // Если ошибка квоты - уведомляем кураторов
      if (aiError.message && (aiError.message.includes('quota') || aiError.message.includes('429'))) {
        this.notifyCuratorsAboutAIQuotaError(submissionId).catch((notifyError) => {
          console.error(`[SubmissionsService.reviewWithAI] Failed to notify curators about quota error:`, notifyError);
        });
      }
      // Продолжаем без ИИ оценки - submission остается в статусе SENT для ручной проверки
      return;
    }

    if (!review) {
      console.error(`[SubmissionsService.reviewWithAI] Review is null, skipping update`);
      return;
    }

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiScore: review.score,
        aiFeedback: review.feedback,
        status: 'AI_REVIEWED',
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            lastName: true,
          },
        },
        step: {
          select: {
            id: true,
            title: true,
            index: true,
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

    // Отправляем уведомление кураторам
    await this.notifyCuratorsAboutSubmission(updated).catch((error) => {
      console.error('Failed to notify curators:', error);
    });
  }

  /**
   * Уведомить всех кураторов о новой сдаче
   */
  private async notifyCuratorsAboutSubmission(submission: any): Promise<void> {
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

    // Отправляем уведомление каждому куратору
    const notifications = curators.map((curator) =>
      this.telegramService
        .notifyCuratorAboutSubmission(curator.telegramId, submission)
        .catch((error) => {
          console.error(`Failed to notify curator ${curator.telegramId}:`, error);
        }),
    );

    await Promise.all(notifications);
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
      console.error(`[SubmissionsService.notifyCuratorsAboutAIQuotaError] Submission ${submissionId} not found`);
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

    const message = `⚠️ Ошибка проверки ИИ\n\n` +
      `Не удалось проверить ответ ученика через ИИ из-за превышения квоты OpenAI API.\n\n` +
      `Ученик: ${user?.firstName || ''} ${user?.lastName || ''}\n` +
      `Модуль: ${module?.index || '?'} - ${module?.title || '?'}\n` +
      `Шаг: ${step?.index || '?'} - ${step?.title || '?'}\n\n` +
      `Пожалуйста, проверьте ответ вручную в интерфейсе куратора.`;

    const notifications = curatorsWithTelegram.map((curator) =>
      this.telegramService.sendMessage(curator.telegramId!, message).catch((error) => {
        console.error(`Failed to notify curator ${curator.telegramId} about quota error:`, error);
      }),
    );

    await Promise.all(notifications);
  }

  async findAll(userId?: string): Promise<any[]> {
    return this.prisma.submission.findMany({
      where: userId ? { userId } : undefined,
      include: {
        step: {
          select: {
            id: true,
            title: true,
            index: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Найти все сдачи пользователя
   */
  async findByUserId(userId: string): Promise<any[]> {
    return this.findAll(userId);
  }

  async findById(id: string): Promise<any> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        stepId: true,
        moduleId: true,
        answerText: true,
        answerFileId: true,
        answerType: true, // ← КРИТИЧНО! Добавлено явно
        aiScore: true,
        aiFeedback: true,
        curatorScore: true,
        curatorFeedback: true,
        status: true,
        resubmissionRequested: true,
        resubmissionRequestedAt: true,
        createdAt: true,
        updatedAt: true,
        step: {
          select: {
            id: true,
            title: true,
            index: true,
            type: true,
            content: true,
            maxScore: true,
            formSchema: true,
            expectedAnswer: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  /**
   * Обновить статус сдачи
   * Используется куратором для одобрения или возврата на доработку
   */
  async updateStatus(
    id: string,
    status: SubmissionStatus,
    curatorScore?: number,
    curatorFeedback?: string,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        step: {
          select: {
            maxScore: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Валидация оценки
    if (curatorScore !== undefined) {
      if (curatorScore < 0 || curatorScore > submission.step.maxScore) {
        throw new BadRequestException(
          `Score must be between 0 and ${submission.step.maxScore}`,
        );
      }
    }

    // Если возвращаем на доработку - сохраняем текущий ответ в историю
    if (status === 'CURATOR_RETURNED') {
      // Сохраняем текущий ответ в историю перед очисткой
      await this.prisma.submissionHistory.create({
        data: {
          submissionId: id,
          answerText: submission.answerText,
          answerFileId: submission.answerFileId,
          answerType: submission.answerType,
          aiScore: submission.aiScore,
          aiFeedback: submission.aiFeedback,
          curatorScore: submission.curatorScore,
          curatorFeedback: submission.curatorFeedback,
          status: submission.status,
          reason: 'RETURNED',
        },
      });
    }

    // Подготавливаем данные для обновления
    const updateData: any = {
      status,
      curatorScore,
      curatorFeedback,
    };

    // Если возвращаем на доработку - очищаем ответ, чтобы ученик мог сразу переделать
    if (status === 'CURATOR_RETURNED') {
      updateData.answerText = null;
      updateData.answerFileId = null;
      // Сбрасываем оценки ИИ, так как ответ будет новый
      updateData.aiScore = null;
      updateData.aiFeedback = null;
    }

    // Если возвращаем на доработку или одобряем - сбрасываем запрос на повторную отправку
    // (запрос выполнен: куратор разрешил пересдачу)
    if (status === 'CURATOR_RETURNED' || status === 'CURATOR_APPROVED') {
      updateData.resubmissionRequested = false;
      updateData.resubmissionRequestedAt = null;
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data: updateData,
      include: {
        step: {
          select: {
            id: true,
            title: true,
            index: true,
            moduleId: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Отправляем уведомление участнику о результате проверки
    if (status === 'CURATOR_APPROVED' || status === 'CURATOR_RETURNED') {
      this.telegramService
        .notifyLearnerAboutReview(updated.user.telegramId, updated)
        .catch((error) => {
          console.error('Failed to notify learner:', error);
        });
    }

    // Проверяем, не завершён ли модуль после одобрения сдачи
    if (status === 'CURATOR_APPROVED') {
      this.checkAndCompleteModule(submission.moduleId, submission.userId).catch(
        (error) => {
          console.error('Module completion check failed:', error);
        },
      );
    }

    return updated;
  }

  /**
   * Получить все сдачи с фильтрами (для куратора)
   */
  async findAllWithFilters(
    moduleId?: string,
    status?: SubmissionStatus,
  ): Promise<any[]> {
    const where: any = {};

    if (moduleId) {
      where.moduleId = moduleId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.submission.findMany({
      where,
      include: {
        step: {
          select: {
            id: true,
            title: true,
            index: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            telegramId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Запросить повторную отправку ответа
   * Только владелец submission может запросить повторную отправку
   * 
   * @param submissionId ID сдачи
   * @param userId ID текущего пользователя
   * @returns Обновленная сдача с сообщением
   */
  async requestResubmission(
    submissionId: string,
    userId: string,
  ): Promise<{ message: string; submission: any }> {
    // 1. Найти submission
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        step: { select: { id: true, title: true, index: true } },
        module: { select: { id: true, title: true, index: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // 2. Проверить, что пользователь - владелец
    if (submission.userId !== userId) {
      throw new ForbiddenException('You can only request resubmission for your own submissions');
    }

    // 3. Проверить статус (не разрешаем для CURATOR_APPROVED)
    if (submission.status === 'CURATOR_APPROVED') {
      throw new BadRequestException('Cannot request resubmission for approved submissions');
    }

    // 4. Проверить, что запрос еще не был сделан
    if (submission.resubmissionRequested) {
      throw new BadRequestException('Запрос на повторную отправку уже отправлен. Дождитесь ответа куратора.');
    }

    // 5. Обновить submission
    const updatedSubmission = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        resubmissionRequested: true,
        resubmissionRequestedAt: new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        step: { select: { id: true, title: true, index: true } },
        module: { select: { id: true, title: true, index: true } },
      },
    });

    // 6. Отправить уведомление кураторам (опционально, асинхронно)
    const userName = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() || 'Ученик';
    const notificationText = 
      `🔄 Запрос на повторную отправку\n\n` +
      `Ученик: ${userName}\n` +
      `Модуль ${submission.module.index}: ${submission.module.title}\n` +
      `Шаг ${submission.step.index}: ${submission.step.title}\n\n` +
      `Ученик просит разрешить повторную отправку ответа.`;

    // Получаем всех кураторов для уведомления
    const curators = await this.prisma.user.findMany({
      where: {
        role: { in: ['CURATOR', 'ADMIN'] },
      },
      select: { telegramId: true },
    });

    // Отправляем уведомления асинхронно (не блокируем ответ)
    // Фильтруем кураторов с telegramId
    curators.forEach((curator) => {
      if (curator.telegramId && curator.telegramId !== null) {
        this.telegramService
          .notifyCuratorAboutResubmissionRequest(curator.telegramId, notificationText)
          .catch((error) => {
            console.error('Failed to notify curator about resubmission request:', error);
          });
      }
    });

    return {
      message: 'Запрос на повторную отправку отправлен куратору',
      submission: updatedSubmission,
    };
  }

  /**
   * Разрешить повторную отправку (подтвердить запрос ученика)
   * Удаляет submission, очищает ответ и отправляет уведомление ученику
   * 
   * @param submissionId ID сдачи
   * @returns Сообщение об успехе
   */
  async approveResubmissionRequest(submissionId: string): Promise<{ message: string }> {
    // 1. Найти submission
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, telegramId: true } },
        step: { select: { id: true, title: true, index: true } },
        module: { select: { id: true, title: true, index: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // 2. Проверяем, что запрос на повторную отправку был сделан
    if (!submission.resubmissionRequested) {
      throw new BadRequestException('Ученик не запрашивал повторную отправку для этой сдачи');
    }

    // 3. Сохраняем текущий ответ в историю перед удалением
    await this.prisma.submissionHistory.create({
      data: {
        submissionId: submissionId,
        answerText: submission.answerText,
        answerFileId: submission.answerFileId,
        answerType: submission.answerType,
        aiScore: submission.aiScore,
        aiFeedback: submission.aiFeedback,
        curatorScore: submission.curatorScore,
        curatorFeedback: submission.curatorFeedback,
        status: submission.status,
        reason: 'RESUBMISSION',
      },
    }).catch((error) => {
      // Если submission уже удалена или ошибка - логируем, но не блокируем процесс
      console.error('Failed to save submission history:', error);
    });

    // 4. Удаляем submission (очищаем ответ)
    await this.prisma.submission.delete({
      where: { id: submissionId },
    });

    // 4. Уведомляем ученика о разрешении повторной отправки
    const userName = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() || 'Ученик';
    if (submission.user.telegramId) {
      this.telegramService
        .notifyLearnerAboutResubmissionApproval(
          submission.user.telegramId,
          submission.module.index,
          submission.module.title,
          submission.step.index,
          submission.step.title,
        )
        .catch((error) => {
          console.error('Failed to notify learner about resubmission approval:', error);
        });
    }

    // 5. Проверяем статус модуля (возможно, он был завершён, а теперь снова незавершён)
    // Если был COMPLETED, переводим обратно в IN_PROGRESS
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: submission.userId,
        moduleId: submission.moduleId,
      },
    });

    if (enrollment && enrollment.status === 'COMPLETED') {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return {
      message: `Запрос на повторную отправку одобрен. Ученик ${userName} может выполнить задание заново.`,
    };
  }

  /**
   * Удалить сдачу (очистить прогресс ученика по шагу)
   * Позволяет куратору сбросить прогресс и разрешить повторную сдачу
   * 
   * @param submissionId ID сдачи для удаления
   * @returns Сообщение об успехе
   */
  async deleteSubmission(submissionId: string): Promise<{ message: string }> {
    // 1. Найти submission
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, telegramId: true } },
        step: { select: { id: true, title: true, index: true } },
        module: { select: { id: true, title: true, index: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // 2. Удаляем submission
    await this.prisma.submission.delete({
      where: { id: submissionId },
    });

    // 3. Уведомляем ученика (опционально)
    const userName = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() || 'Ученик';
    const notificationText = 
      `🔄 Сдача задания сброшена\n\n` +
      `Модуль ${submission.module.index}: ${submission.module.title}\n` +
      `Шаг ${submission.step.index}: ${submission.step.title}\n\n` +
      `Куратор удалил вашу сдачу. Вы можете выполнить задание заново.`;

    if (submission.user.telegramId) {
      this.telegramService
        .notifyLearnerAboutSubmissionDeletion(submission.user.telegramId, notificationText)
        .catch((error) => {
          console.error('Failed to notify learner about submission deletion:', error);
        });
    }

    // 4. Проверяем статус модуля (возможно, он был завершён, а теперь снова незавершён)
    // Если был COMPLETED, переводим обратно в IN_PROGRESS
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: submission.userId,
        moduleId: submission.moduleId,
      },
    });

    if (enrollment && enrollment.status === 'COMPLETED') {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return {
      message: `Сдача задания удалена. Ученик ${userName} может выполнить задание заново.`,
    };
  }

  /**
   * Проверяет, завершён ли модуль, и обновляет статус Enrollment
   * Модуль считается завершённым, если все обязательные шаги имеют
   * Submission со статусом CURATOR_APPROVED
   */
  private async checkAndCompleteModule(
    moduleId: string,
    userId: string,
  ): Promise<void> {
    // Получаем модуль со всеми шагами
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: {
        steps: {
          select: {
            id: true,
            type: true,
            isRequired: true,
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!module) {
      return;
    }

    // Получаем все обязательные шаги (isRequired = true и не INFO)
    const requiredSteps = module.steps.filter(
      (step) => step.isRequired && step.type !== 'INFO',
    );

    if (requiredSteps.length === 0) {
      return; // Если нет обязательных шагов, ничего не делаем
    }

    // Получаем все сдачи пользователя по этому модулю
    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        moduleId,
      },
    });

    // Проверяем, что все обязательные шаги имеют одобренную сдачу
    const allApproved = requiredSteps.every((step) => {
      const submission = submissions.find((s) => s.stepId === step.id);
      return submission && submission.status === 'CURATOR_APPROVED';
    });

    if (allApproved) {
      // Обновляем статус Enrollment на COMPLETED
      await this.prisma.enrollment.updateMany({
        where: {
          userId,
          moduleId,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Отправляем уведомление пользователю о завершении модуля
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramId: true },
      });

      if (user && user.telegramId) {
        this.telegramService
          .notifyModuleCompleted(user.telegramId, module.index, module.title)
          .catch((error) => {
            console.error('Failed to notify user about module completion:', error);
          });
      }
    }
  }
}

