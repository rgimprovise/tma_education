import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportType, ExportFormat } from './dto/export-params.dto';
import { SubmissionExportRow } from './dto/submission-export-row.dto';
import { UserProgressExportRow } from './dto/user-progress-export-row.dto';

/**
 * ExportService - сервис для экспорта данных в различных форматах
 * 
 * Предназначен для выгрузки "сырых" данных для последующего анализа в ИИ:
 * - Поиск слов-паразитов
 * - Анализ ошибок
 * - Оценка сложности формулировок
 * - Анализ эффективности обучения
 * 
 * Поддерживает два типа экспорта:
 * 1. SUBMISSIONS - сырые данные по каждой сдаче
 * 2. USER_PROGRESS - агрегированный прогресс по каждому пользователю
 * 
 * Форматы экспорта:
 * - CSV (запятые, UTF-8 с BOM)
 * - TSV (табуляция, UTF-8)
 * - JSON (массив объектов, UTF-8)
 */
@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Экспортировать данные по курсу
   * 
   * @param courseId - ID курса (обязательный)
   * @param moduleId - ID модуля (опционально, фильтр)
   * @param dateFrom - Начальная дата (опционально)
   * @param dateTo - Конечная дата (опционально)
   * @param type - Тип экспорта (SUBMISSIONS или USER_PROGRESS)
   * @param format - Формат экспорта (CSV, TSV, JSON)
   * @returns Строка с данными в выбранном формате
   */
  async exportData(
    courseId: string,
    moduleId: string | undefined,
    dateFrom: string | undefined,
    dateTo: string | undefined,
    type: ExportType,
    format: ExportFormat,
  ): Promise<string> {
    // Проверяем, что курс существует
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Проверяем модуль, если указан
    if (moduleId) {
      const module = await this.prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { id: true, courseId: true },
      });

      if (!module) {
        throw new NotFoundException('Module not found');
      }

      if (module.courseId !== courseId) {
        throw new BadRequestException('Module does not belong to the specified course');
      }
    }

    // Парсим даты
    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;

    // Выбираем тип экспорта
    if (type === ExportType.SUBMISSIONS) {
      const rows = await this.exportSubmissions(courseId, moduleId, fromDate, toDate);
      return this.formatData(rows, format);
    } else if (type === ExportType.USER_PROGRESS) {
      const rows = await this.exportUserProgress(courseId, moduleId, fromDate, toDate);
      return this.formatData(rows, format);
    } else {
      throw new BadRequestException(`Unsupported export type: ${type}`);
    }
  }

  /**
   * Экспортировать сырые данные по сдачам
   */
  private async exportSubmissions(
    courseId: string,
    moduleId: string | undefined,
    dateFrom: Date | undefined,
    dateTo: Date | undefined,
  ): Promise<SubmissionExportRow[]> {
    // Строим фильтр для Prisma
    const where: any = {
      module: {
        courseId: courseId,
      },
    };

    if (moduleId) {
      where.moduleId = moduleId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = dateFrom;
      }
      if (dateTo) {
        where.createdAt.lte = dateTo;
      }
    }

    // Загружаем все сдачи с полными данными
    const submissions = await this.prisma.submission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            role: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        step: {
          select: {
            id: true,
            index: true,
            title: true,
            type: true,
            isRequired: true,
            maxScore: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { userId: 'asc' },
        { module: { index: 'asc' } },
        { step: { index: 'asc' } },
      ],
    });

    // Преобразуем в SubmissionExportRow
    return submissions.map((submission) => {
      const userFullName = this.formatUserName(
        submission.user.firstName,
        submission.user.lastName,
      );

      // Определяем answerTextOrTranscript
      let answerTextOrTranscript = '';
      if (submission.answerType === 'TEXT') {
        answerTextOrTranscript = submission.answerText || '';
      } else if (submission.answerType === 'AUDIO' || submission.answerType === 'VIDEO') {
        // Для аудио/видео используем транскрипт, если есть
        answerTextOrTranscript = submission.answerText || `[${submission.answerType}_FILE]`;
      } else {
        // Для FILE
        answerTextOrTranscript = '[FILE]';
      }

      return {
        submissionId: submission.id,
        userId: submission.userId,
        userFullName,
        userPosition: submission.user.position,
        userRole: submission.user.role,
        courseId: submission.module.course.id,
        courseTitle: submission.module.course.title,
        moduleId: submission.moduleId,
        moduleTitle: submission.module.title,
        moduleIndex: submission.module.index,
        stepId: submission.stepId,
        stepTitle: submission.step.title,
        stepIndex: submission.step.index,
        stepType: submission.step.type,
        isRequired: submission.step.isRequired,
        answerType: submission.answerType,
        answerTextOrTranscript,
        aiScore: submission.aiScore,
        curatorScore: submission.curatorScore,
        status: submission.status,
        aiFeedback: submission.aiFeedback,
        curatorFeedback: submission.curatorFeedback,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        resubmissionRequested: submission.resubmissionRequested,
        resubmissionRequestedAt: submission.resubmissionRequestedAt,
        telegramPromptMessageId: submission.telegramPromptMessageId,
        maxScore: submission.step.maxScore,
      };
    });
  }

  /**
   * Экспортировать агрегированный прогресс пользователей
   */
  private async exportUserProgress(
    courseId: string,
    moduleId: string | undefined,
    dateFrom: Date | undefined,
    dateTo: Date | undefined,
  ): Promise<UserProgressExportRow[]> {
    // Получаем курс с модулями
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          where: moduleId ? { id: moduleId } : undefined,
          include: {
            steps: {
              where: {
                isRequired: true, // Только обязательные шаги для подсчёта modulesCount
              },
            },
            enrollments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    position: true,
                    role: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Получаем все сдачи по курсу/модулю
    const submissionsWhere: any = {
      module: {
        courseId: courseId,
      },
    };

    if (moduleId) {
      submissionsWhere.moduleId = moduleId;
    }

    if (dateFrom || dateTo) {
      submissionsWhere.createdAt = {};
      if (dateFrom) {
        submissionsWhere.createdAt.gte = dateFrom;
      }
      if (dateTo) {
        submissionsWhere.createdAt.lte = dateTo;
      }
    }

    const allSubmissions = await this.prisma.submission.findMany({
      where: submissionsWhere,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Группируем по пользователям
    const submissionsByUser = new Map<string, typeof allSubmissions>();
    allSubmissions.forEach((submission) => {
      if (!submissionsByUser.has(submission.userId)) {
        submissionsByUser.set(submission.userId, []);
      }
      submissionsByUser.get(submission.userId)!.push(submission);
    });

    // Получаем уникальных пользователей
    const uniqueUserIds = Array.from(submissionsByUser.keys());
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        role: true,
        createdAt: true,
      },
    });

    // Подсчитываем обязательные модули
    const requiredModules = course.modules.filter((m) =>
      m.steps.some((s) => s.isRequired),
    );
    const modulesCount = requiredModules.length;

    // Формируем строки экспорта
    return users.map((user) => {
      const userSubmissions = submissionsByUser.get(user.id) || [];
      const userEnrollments = course.modules.flatMap((m) =>
        m.enrollments.filter((e) => e.userId === user.id),
      );

      // Подсчитываем завершённые модули
      const completedModulesCount = userEnrollments.filter(
        (e) => e.status === 'COMPLETED',
      ).length;

      // Подсчитываем метрики по сдачам
      const aiScores = userSubmissions
        .map((s) => s.aiScore)
        .filter((score): score is number => score !== null && score !== undefined);
      const curatorScores = userSubmissions
        .map((s) => s.curatorScore)
        .filter((score): score is number => score !== null && score !== undefined);

      const returnsCount = userSubmissions.filter(
        (s) => s.status === 'CURATOR_RETURNED',
      ).length;
      const approvedCount = userSubmissions.filter(
        (s) => s.status === 'CURATOR_APPROVED',
      ).length;
      const pendingCount = userSubmissions.filter(
        (s) => s.status === 'SENT' || s.status === 'AI_REVIEWED',
      ).length;
      const resubmissionRequestedCount = userSubmissions.filter(
        (s) => s.resubmissionRequested,
      ).length;

      // Временные метки
      const submissionDates = userSubmissions.map((s) => s.createdAt);
      const firstActivityAt =
        submissionDates.length > 0 ? new Date(Math.min(...submissionDates.map((d) => d.getTime()))) : null;
      const lastActivityAt =
        submissionDates.length > 0 ? new Date(Math.max(...submissionDates.map((d) => d.getTime()))) : null;

      const activityPeriodDays =
        firstActivityAt && lastActivityAt
          ? Math.ceil((lastActivityAt.getTime() - firstActivityAt.getTime()) / (1000 * 60 * 60 * 24))
          : null;

      return {
        userId: user.id,
        userFullName: this.formatUserName(user.firstName, user.lastName),
        userPosition: user.position,
        userRole: user.role,
        courseId: course.id,
        courseTitle: course.title,
        modulesCount,
        completedModulesCount,
        completionPercent: modulesCount > 0 ? (completedModulesCount / modulesCount) * 100 : 0,
        totalSubmissions: userSubmissions.length,
        avgAiScore: aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null,
        avgCuratorScore:
          curatorScores.length > 0
            ? curatorScores.reduce((a, b) => a + b, 0) / curatorScores.length
            : null,
        returnsCount,
        returnsPercent:
          userSubmissions.length > 0 ? (returnsCount / userSubmissions.length) * 100 : 0,
        firstActivityAt,
        lastActivityAt,
        activityPeriodDays,
        approvedSubmissionsCount: approvedCount,
        pendingSubmissionsCount: pendingCount,
        resubmissionRequestedCount,
        userCreatedAt: user.createdAt,
      };
    });
  }

  /**
   * Форматировать данные в выбранный формат
   */
  private formatData(rows: SubmissionExportRow[] | UserProgressExportRow[], format: ExportFormat): string {
    if (rows.length === 0) {
      return format === ExportFormat.JSON ? '[]' : '';
    }

    if (format === ExportFormat.JSON) {
      return JSON.stringify(rows, null, 2);
    }

    // Для CSV/TSV нужно определить заголовки и значения
    const headers = Object.keys(rows[0]);
    const separator = format === ExportFormat.CSV ? ',' : '\t';

    // Формируем CSV/TSV
    const lines: string[] = [];

    // Заголовки
    if (format === ExportFormat.CSV) {
      // CSV с BOM для корректного отображения в Excel
      lines.push('\uFEFF' + headers.map((h) => this.escapeCsvValue(h)).join(separator));
    } else {
      // TSV
      lines.push(headers.join(separator));
    }

    // Данные
    rows.forEach((row) => {
      const values = headers.map((header) => {
        const value = (row as any)[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'boolean') {
          return value ? '1' : '0';
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        // Строка
        if (format === ExportFormat.CSV) {
          return this.escapeCsvValue(String(value));
        } else {
          // TSV - заменяем табуляции и переносы строк
          return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
        }
      });
      lines.push(values.join(separator));
    });

    return lines.join('\n');
  }

  /**
   * Экранировать значение для CSV
   */
  private escapeCsvValue(value: string): string {
    // Если содержит запятую, кавычки или перенос строки - оборачиваем в кавычки
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      // Экранируем кавычки удвоением
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Форматировать имя пользователя
   */
  private formatUserName(firstName: string | null, lastName: string | null): string {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    if (lastName) {
      return lastName;
    }
    return 'Не указано';
  }
}

