import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ModuleWithProgressDto } from './dto/module-response.dto';
import { StepWithProgressDto } from './dto/step-response.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateStepDto } from './dto/create-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { ModuleStatus } from '@prisma/client';

@Injectable()
export class CourseService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  /**
   * Получить все модули с прогрессом пользователя
   * Определяет статус модуля: LOCKED, IN_PROGRESS, COMPLETED
   */
  async getModulesWithProgress(userId: string): Promise<ModuleWithProgressDto[]> {
    const modules = await this.prisma.courseModule.findMany({
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
      orderBy: { index: 'asc' },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
    });

    const enrollmentMap = new Map(enrollments.map((e) => [e.moduleId, e]));

    // Получаем все сдачи пользователя для проверки завершения модулей
    const allSubmissions = await this.prisma.submission.findMany({
      where: { userId },
      include: {
        step: {
          select: {
            moduleId: true,
            type: true,
          },
        },
      },
    });

    // Группируем сдачи по модулям
    const submissionsByModule = new Map<string, typeof allSubmissions>();
    allSubmissions.forEach((submission) => {
      const moduleId = submission.step.moduleId;
      if (!submissionsByModule.has(moduleId)) {
        submissionsByModule.set(moduleId, []);
      }
      submissionsByModule.get(moduleId)!.push(submission);
    });

    return modules.map((module) => {
      const enrollment = enrollmentMap.get(module.id);
      let status: ModuleStatus = 'LOCKED';

      if (enrollment) {
        // Если есть enrollment, проверяем его статус
        status = enrollment.status;

        // Если статус IN_PROGRESS, проверяем, не завершён ли модуль
        if (status === 'IN_PROGRESS') {
          const isCompleted = this.checkModuleCompletion(
            module,
            submissionsByModule.get(module.id) || [],
          );
          if (isCompleted) {
            status = 'COMPLETED';
            // Обновляем статус в БД, если он ещё не обновлён
            if (enrollment.status !== 'COMPLETED') {
              this.prisma.enrollment
                .update({
                  where: { id: enrollment.id },
                  data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                  },
                })
                .catch(console.error);
            }
          }
        }
      } else {
        // Если нет enrollment, модуль заблокирован
        status = 'LOCKED';
      }

      return {
        ...module,
        steps: undefined, // Не включаем steps в ответ для списка модулей
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status,
              unlockedAt: enrollment.unlockedAt || undefined,
              completedAt: enrollment.completedAt || undefined,
            }
          : {
              id: '', // Временный ID для отображения (модуль заблокирован)
              status,
              unlockedAt: undefined,
              completedAt: undefined,
            },
      };
    });
  }

  /**
   * Проверяет, завершён ли модуль
   * Модуль считается завершённым, если все обязательные шаги (isRequired = true)
   * имеют Submission со статусом CURATOR_APPROVED
   */
  private checkModuleCompletion(
    module: { steps: Array<{ id: string; type: string; isRequired: boolean }> },
    submissions: Array<{ stepId: string; status: string }>,
  ): boolean {
    // Получаем только обязательные шаги (isRequired = true и не INFO)
    const requiredSteps = module.steps.filter(
      (step) => step.isRequired && step.type !== 'INFO',
    );

    if (requiredSteps.length === 0) {
      return true; // Если нет обязательных шагов, модуль считается завершённым
    }

    // Создаём карту сдач по stepId
    const submissionMap = new Map(
      submissions.map((s) => [s.stepId, s]),
    );

    // Проверяем, что все обязательные шаги имеют одобренную сдачу
    return requiredSteps.every((step) => {
      const submission = submissionMap.get(step.id);
      return submission && submission.status === 'CURATOR_APPROVED';
    });
  }

  /**
   * Определяет текущий модуль для кнопки "Продолжить обучение"
   * Возвращает первый модуль со статусом IN_PROGRESS
   * Если нет IN_PROGRESS модулей, возвращает null (нужно ждать разблокировки куратором)
   */
  async getCurrentModule(userId: string): Promise<ModuleWithProgressDto | null> {
    const modules = await this.getModulesWithProgress(userId);

    // Ищем первый модуль со статусом IN_PROGRESS
    const inProgressModule = modules.find(
      (m) => m.enrollment?.status === 'IN_PROGRESS',
    );

    return inProgressModule || null;
  }

  /**
   * Найти модуль по ID с прогрессом пользователя
   */
  async findModuleById(moduleId: string, userId?: string): Promise<ModuleWithProgressDto> {
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: {
        steps: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    let enrollment = null;
    if (userId) {
      enrollment = await this.prisma.enrollment.findFirst({
        where: {
          userId,
          moduleId: module.id,
        },
      });
    }

    return {
      ...module,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            status: enrollment.status,
            unlockedAt: enrollment.unlockedAt || undefined,
            completedAt: enrollment.completedAt || undefined,
          }
        : undefined,
    };
  }

  /**
   * Получить шаги модуля с прогрессом пользователя
   * Показывает состояние каждого шага: не начато / отправлено / на проверке / зачтено
   */
  async getModuleStepsWithProgress(
    moduleId: string,
    userId: string,
  ): Promise<StepWithProgressDto[]> {
    // Проверяем, что модуль существует
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Получаем enrollment пользователя для этого модуля
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        moduleId,
      },
    });

    // Получаем все шаги модуля
    const steps = await this.prisma.courseStep.findMany({
      where: { moduleId },
      orderBy: { index: 'asc' },
    });

    // Получаем все сдачи пользователя по этому модулю
    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        moduleId,
      },
    });

    // Создаём карту сдач по stepId
    const submissionMap = new Map(submissions.map((s) => [s.stepId, s]));

    return steps.map((step) => {
      const submission = submissionMap.get(step.id);
      return {
        id: step.id,
        moduleId: step.moduleId,
        index: step.index,
        type: step.type,
        title: step.title,
        content: step.content,
        requiresAiReview: step.requiresAiReview,
        expectedAnswer: step.expectedAnswer,
        maxScore: step.maxScore,
        formSchema: step.formSchema || undefined,
        aiRubric: step.aiRubric || undefined,
        isRequired: step.isRequired,
        module: {
          id: module.id,
          title: module.title,
          enrollment: enrollment
            ? {
                id: enrollment.id,
                status: enrollment.status,
              }
            : undefined,
        },
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              answerText: submission.answerText || undefined,
              aiScore: submission.aiScore || undefined,
              aiFeedback: submission.aiFeedback || undefined,
              curatorScore: submission.curatorScore || undefined,
              curatorFeedback: submission.curatorFeedback || undefined,
              resubmissionRequested: submission.resubmissionRequested,
              resubmissionRequestedAt: submission.resubmissionRequestedAt || undefined,
              createdAt: submission.createdAt,
            }
          : undefined,
      };
    });
  }

  /**
   * Получить шаг с прогрессом пользователя
   * Включает информацию о сдаче, если она есть
   */
  async getStepWithProgress(stepId: string, userId: string): Promise<StepWithProgressDto> {
    const step = await this.prisma.courseStep.findUnique({
      where: { id: stepId },
      include: {
        module: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    // Получаем enrollment пользователя для этого модуля
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        moduleId: step.moduleId,
      },
    });

    // Получаем сдачу пользователя по этому шагу
    const submission = await this.prisma.submission.findFirst({
      where: {
        userId,
        stepId: step.id,
      },
    });

    return {
      id: step.id,
      moduleId: step.moduleId,
      index: step.index,
      type: step.type,
      title: step.title,
      content: step.content,
      requiresAiReview: step.requiresAiReview,
      expectedAnswer: step.expectedAnswer,
      maxScore: step.maxScore,
      formSchema: step.formSchema || undefined,
      aiRubric: step.aiRubric || undefined,
      isRequired: step.isRequired,
      module: {
        id: step.module.id,
        title: step.module.title,
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status: enrollment.status,
            }
          : undefined,
      },
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            answerText: submission.answerText || undefined,
            aiScore: submission.aiScore || undefined,
            aiFeedback: submission.aiFeedback || undefined,
            curatorScore: submission.curatorScore || undefined,
            curatorFeedback: submission.curatorFeedback || undefined,
            resubmissionRequested: submission.resubmissionRequested,
            resubmissionRequestedAt: submission.resubmissionRequestedAt || undefined,
            createdAt: submission.createdAt,
          }
        : undefined,
    };
  }

  /**
   * Открыть модуль для пользователей (для куратора)
   * Создаёт или обновляет Enrollment для указанных пользователей
   */
  async unlockModuleForUsers(
    moduleId: string,
    userIds: string[],
    allCompletedPrevious: boolean,
    forAll: boolean,
    curatorId: string,
  ): Promise<{ unlocked: number; message: string }> {
    // Проверяем, что модуль существует
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    let targetUserIds: string[] = [];

    if (forAll) {
      // Открываем для всех зарегистрированных учеников
      const allLearners = await this.prisma.user.findMany({
        where: { role: 'LEARNER' },
        select: { id: true },
      });
      targetUserIds = allLearners.map((u) => u.id);
    } else if (allCompletedPrevious) {
      // Находим всех пользователей, которые завершили предыдущий модуль
      const previousModuleIndex = module.index - 1;

      if (previousModuleIndex < 1) {
        // Если это первый модуль, открываем всем обучающимся
        const allLearners = await this.prisma.user.findMany({
          where: { role: 'LEARNER' },
          select: { id: true },
        });
        targetUserIds = allLearners.map((u) => u.id);
      } else {
        // Находим предыдущий модуль
        const previousModule = await this.prisma.courseModule.findUnique({
          where: { index: previousModuleIndex },
        });

        if (!previousModule) {
          throw new NotFoundException('Previous module not found');
        }

        // Находим всех, кто завершил предыдущий модуль
        const completedEnrollments = await this.prisma.enrollment.findMany({
          where: {
            moduleId: previousModule.id,
            status: 'COMPLETED',
          },
          select: { userId: true },
        });

        targetUserIds = completedEnrollments.map((e) => e.userId);
      }
    } else {
      targetUserIds = userIds;
    }

    if (targetUserIds.length === 0) {
      return {
        unlocked: 0,
        message: 'No users to unlock module for',
      };
    }

    // Получаем информацию о пользователях для уведомлений
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: targetUserIds,
        },
      },
      select: {
        id: true,
        telegramId: true,
      },
    });

    // Создаём или обновляем Enrollment для каждого пользователя
    const results = await Promise.all(
      targetUserIds.map(async (userId) => {
        const existing = await this.prisma.enrollment.findFirst({
          where: {
            userId,
            moduleId,
          },
        });

        if (existing) {
          // Обновляем существующий Enrollment
          return this.prisma.enrollment.update({
            where: { id: existing.id },
            data: {
              status: 'IN_PROGRESS',
              unlockedById: curatorId,
              unlockedAt: new Date(),
            },
          });
        } else {
          // Создаём новый Enrollment
          return this.prisma.enrollment.create({
            data: {
              userId,
              moduleId,
              status: 'IN_PROGRESS',
              unlockedById: curatorId,
              unlockedAt: new Date(),
            },
          });
        }
      }),
    );

    // КРИТИЧЕСКИ ВАЖНО: Если модуль открывается "для всех", устанавливаем флаг autoUnlockForNewLearners = true
    // Это гарантирует, что новые регистрирующиеся ученики автоматически получат доступ к модулю
    if (forAll) {
      await this.prisma.courseModule.update({
        where: { id: moduleId },
        data: {
          autoUnlockForNewLearners: true,
        },
      });
    }

    // Отправляем уведомления пользователям об открытии модуля
    const userMap = new Map(users.map((u) => [u.id, u]));
    results.forEach((enrollment) => {
      const user = userMap.get(enrollment.userId);
      if (user && user.telegramId) {
        this.telegramService
          .notifyModuleUnlocked(user.telegramId, module.index, module.title)
          .catch((error) => {
            console.error(`Failed to notify user ${user.telegramId}:`, error);
          });
      }
    });

    return {
      unlocked: results.length,
      message: `Module unlocked for ${results.length} user(s)${forAll ? ' and will be automatically unlocked for new learners' : ''}`,
    };
  }

  /**
   * Заблокировать модуль для пользователей (для куратора)
   * Удаляет Enrollment для указанных пользователей или переводит в LOCKED
   */
  async lockModuleForUsers(
    moduleId: string,
    userIds: string[],
    forAll: boolean,
    curatorId: string,
  ): Promise<{ locked: number; message: string }> {
    // Проверяем, что модуль существует
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    let targetUserIds: string[] = [];

    if (forAll) {
      // Блокируем для всех зарегистрированных учеников
      const allLearners = await this.prisma.user.findMany({
        where: { role: 'LEARNER' },
        select: { id: true },
      });
      targetUserIds = allLearners.map((u) => u.id);
    } else {
      targetUserIds = userIds;
    }

    if (targetUserIds.length === 0) {
      return {
        locked: 0,
        message: 'No users to lock module for',
      };
    }

    // Получаем информацию о пользователях для уведомлений
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: targetUserIds,
        },
      },
      select: {
        id: true,
        telegramId: true,
      },
    });

    // Удаляем Enrollment для каждого пользователя
    const results = await Promise.all(
      targetUserIds.map(async (userId) => {
        const existing = await this.prisma.enrollment.findFirst({
          where: {
            userId,
            moduleId,
          },
        });

        if (existing) {
          // Удаляем Enrollment (модуль становится LOCKED)
          await this.prisma.enrollment.delete({
            where: { id: existing.id },
          });
          return userId;
        }
        return null;
      }),
    );

    const lockedCount = results.filter((id) => id !== null).length;

    // КРИТИЧЕСКИ ВАЖНО: Если модуль блокируется "для всех", сбрасываем флаг autoUnlockForNewLearners = false
    // Это гарантирует, что новые регистрирующиеся ученики НЕ получат доступ к заблокированному модулю
    if (forAll) {
      await this.prisma.courseModule.update({
        where: { id: moduleId },
        data: {
          autoUnlockForNewLearners: false,
        },
      });
    }

    // Отправляем уведомления пользователям о блокировке модуля
    const userMap = new Map(users.map((u) => [u.id, u]));
    results.forEach((userId) => {
      if (userId) {
        const user = userMap.get(userId);
        if (user && user.telegramId) {
          this.telegramService
            .notifyModuleLocked(user.telegramId, module.index, module.title)
            .catch((error) => {
              console.error(`Failed to notify user ${user.telegramId}:`, error);
            });
        }
      }
    });

    return {
      locked: lockedCount,
      message: `Module locked for ${lockedCount} user(s)`,
    };
  }

  /**
   * Установить флаг автоматического открытия модуля для новых учеников
   * @param moduleId - ID модуля
   * @param autoUnlock - true = открывать для новых, false = не открывать
   */
  async setAutoUnlockForNewLearners(
    moduleId: string,
    autoUnlock: boolean,
  ): Promise<{ message: string }> {
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    await this.prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        autoUnlockForNewLearners: autoUnlock,
      },
    });

    return {
      message: autoUnlock
        ? 'Модуль будет автоматически открываться для новых учеников'
        : 'Автоматическое открытие модуля для новых учеников отключено',
    };
  }

  /**
   * Открыть модуль для нового ученика (если модуль имеет autoUnlockForNewLearners = true)
   * Вызывается при создании нового пользователя с ролью LEARNER
   * @param userId - ID нового ученика
   */
  async autoUnlockModulesForNewLearner(userId: string): Promise<void> {
    // Находим все модули с autoUnlockForNewLearners = true
    const autoUnlockModules = await this.prisma.courseModule.findMany({
      where: {
        autoUnlockForNewLearners: true,
      },
      select: {
        id: true,
        index: true,
        title: true,
      },
    });

    if (autoUnlockModules.length === 0) {
      return; // Нет модулей для автоматического открытия
    }

    // Создаём Enrollment для каждого модуля
    const enrollments = await Promise.all(
      autoUnlockModules.map((module) =>
        this.prisma.enrollment.create({
          data: {
            userId,
            moduleId: module.id,
            status: 'IN_PROGRESS',
            unlockedAt: new Date(),
            // unlockedById не устанавливаем, так как это автоматическое открытие
          },
        }),
      ),
    );

    // Отправляем уведомления пользователю
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });

    if (user && user.telegramId) {
      // Уведомляем о первом открытом модуле (обычно это модуль 1)
      const firstModule = autoUnlockModules[0];
      this.telegramService
        .notifyModuleUnlocked(user.telegramId, firstModule.index, firstModule.title)
        .catch((error) => {
          console.error(`Failed to notify user ${user.telegramId} about auto-unlocked module:`, error);
        });
    }
  }
}

