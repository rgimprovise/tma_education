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

    // 5. Проверяем, что пользователь ещё не сдавал этот шаг
    const existingSubmission = await this.prisma.submission.findFirst({
      where: {
        userId: data.userId,
        stepId: data.stepId,
      },
    });

    if (existingSubmission) {
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

    // 8. Создаём сдачу
    const submission = await this.prisma.submission.create({
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

    // 9. Если требуется проверка ИИ, запускаем асинхронно
    if (submission.step.requiresAiReview) {
      this.reviewWithAI(submission.id).catch((error) => {
        console.error('AI review failed:', error);
      });
    }

    return submission;
  }

  async reviewWithAI(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        step: true,
        user: true,
      },
    });

    if (!submission || !submission.step.requiresAiReview) {
      return;
    }

    const review = await this.aiService.reviewSubmission(
      submission.step.content,
      submission.answerText || '',
      submission.step.maxScore,
      submission.step.aiRubric || undefined,
    );

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

    const updated = await this.prisma.submission.update({
      where: { id },
      data: {
        status,
        curatorScore,
        curatorFeedback,
      },
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
}

  /**
   * Проверяет, завершён ли модуль, и обновляет статус Enrollment
   * Модуль считается завершённым, если все обязательные шаги имеют
   * Submission со статусом CURATOR_APPROVED
   */
  private async checkAndCompleteModule(moduleId: string, userId: string): Promise<void> {
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

