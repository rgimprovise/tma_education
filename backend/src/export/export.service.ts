import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportFormat } from './dto/export-params.dto';
import { SubmissionExportRow } from './dto/submission-export-row.dto';
import { UserProgressExportRow } from './dto/user-progress-export-row.dto';
import * as ExcelJS from 'exceljs';

/**
 * Опции для экспорта сдач
 */
export interface SubmissionExportOptions {
  moduleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Опции для экспорта прогресса пользователей
 */
export interface UserProgressExportOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

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
   * Построить экспорт сырых данных по сдачам
   * 
   * @param courseId - ID курса
   * @param options - Опции фильтрации (moduleId, dateFrom, dateTo)
   * @returns Массив строк экспорта SubmissionExportRow
   */
  async buildSubmissionExport(
    courseId: string,
    options: SubmissionExportOptions = {},
  ): Promise<SubmissionExportRow[]> {
    // Проверяем, что курс существует
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Проверяем модуль, если указан
    if (options.moduleId) {
      const module = await this.prisma.courseModule.findUnique({
        where: { id: options.moduleId },
        select: { id: true, courseId: true },
      });

      if (!module) {
        throw new NotFoundException('Module not found');
      }

      if (module.courseId !== courseId) {
        throw new BadRequestException('Module does not belong to the specified course');
      }
    }

    // Строим фильтр для Prisma
    const where: any = {
      module: {
        courseId: courseId,
      },
    };

    if (options.moduleId) {
      where.moduleId = options.moduleId;
    }

    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) {
        where.createdAt.gte = options.dateFrom;
      }
      if (options.dateTo) {
        where.createdAt.lte = options.dateTo;
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
      // ПРИМЕЧАНИЕ: В текущей модели Submission.answerText содержит:
      // - Для TEXT: текст ответа напрямую
      // - Для AUDIO/VIDEO: транскрипт после распознавания через Whisper (если был обработан)
      // - Для FILE: null
      // 
      // Экспорт ограничен текстовыми ответами и транскриптами аудио/видео.
      // Если транскрипта нет, поле будет пустым или содержать метку типа файла.
      let answerTextOrTranscript = '';
      if (submission.answerType === 'TEXT') {
        // Текстовый ответ - используем напрямую
        answerTextOrTranscript = submission.answerText || '';
      } else if (submission.answerType === 'AUDIO' || submission.answerType === 'VIDEO') {
        // Для аудио/видео: если есть транскрипт (после обработки через Whisper), используем его
        // Если транскрипта нет - оставляем пустым или ставим метку
        // В будущем можно добавить логику повторной транскрипции для экспорта
        answerTextOrTranscript = submission.answerText || '';
        // Если транскрипта нет, можно оставить пустым для ИИ-анализа
        // или добавить метку: `[${submission.answerType}_NO_TRANSCRIPT]`
      } else {
        // Для FILE - текстового контента нет
        answerTextOrTranscript = '';
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
   * Построить экспорт агрегированного прогресса пользователей
   * 
   * @param courseId - ID курса
   * @param options - Опции фильтрации (dateFrom, dateTo)
   * @returns Массив строк экспорта UserProgressExportRow
   */
  async buildUserProgressExport(
    courseId: string,
    options: UserProgressExportOptions = {},
  ): Promise<UserProgressExportRow[]> {
    // Проверяем, что курс существует
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Получаем все модули курса с обязательными шагами
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: courseId },
      include: {
        steps: {
          where: {
            isRequired: true, // Только обязательные шаги для подсчёта modulesCount
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { index: 'asc' },
    });

    // Подсчитываем обязательные модули (модули с хотя бы одним обязательным шагом)
    const requiredModules = modules.filter((m) => m.steps.length > 0);
    const modulesCount = requiredModules.length;

    // Получаем все enrollments по курсу
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        moduleId: { in: modules.map((m) => m.id) },
      },
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
    });

    // Получаем все сдачи по курсу с фильтрацией по датам
    const submissionsWhere: any = {
      module: {
        courseId: courseId,
      },
    };

    if (options.dateFrom || options.dateTo) {
      submissionsWhere.createdAt = {};
      if (options.dateFrom) {
        submissionsWhere.createdAt.gte = options.dateFrom;
      }
      if (options.dateTo) {
        submissionsWhere.createdAt.lte = options.dateTo;
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

    // Группируем enrollments по пользователям
    const enrollmentsByUser = new Map<string, typeof enrollments>();
    enrollments.forEach((enrollment) => {
      if (!enrollmentsByUser.has(enrollment.userId)) {
        enrollmentsByUser.set(enrollment.userId, []);
      }
      enrollmentsByUser.get(enrollment.userId)!.push(enrollment);
    });

    // Группируем submissions по пользователям
    const submissionsByUser = new Map<string, typeof allSubmissions>();
    allSubmissions.forEach((submission) => {
      if (!submissionsByUser.has(submission.userId)) {
        submissionsByUser.set(submission.userId, []);
      }
      submissionsByUser.get(submission.userId)!.push(submission);
    });

    // Получаем уникальных пользователей (из enrollments, так как они точно есть в курсе)
    const uniqueUserIds = Array.from(new Set([
      ...enrollmentsByUser.keys(),
      ...submissionsByUser.keys(),
    ]));
    
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

    // Формируем строки экспорта
    return users.map((user) => {
      const userSubmissions = submissionsByUser.get(user.id) || [];
      const userEnrollments = enrollmentsByUser.get(user.id) || [];

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

      // Количество возвратов: статус CURATOR_RETURNED или resubmissionRequested = true
      const returnsCount = userSubmissions.filter(
        (s) => s.status === 'CURATOR_RETURNED' || s.resubmissionRequested,
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
   * 
   * @param rows - Массив строк экспорта
   * @param format - Формат (CSV, TSV, JSON)
   * @returns Строка с данными в выбранном формате
   */
  formatData(rows: SubmissionExportRow[] | UserProgressExportRow[], format: ExportFormat): string {
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

  /**
   * Создать полный экспорт всех таблиц базы данных по курсу в Excel
   * Каждая таблица на отдельном листе
   * 
   * @param courseId - ID курса
   * @returns Buffer с Excel файлом
   */
  async buildFullDatabaseExport(courseId: string): Promise<Buffer> {
    // Проверяем, что курс существует
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Получаем все модули курса
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: courseId },
      select: { id: true },
    });

    const moduleIds = modules.map((m) => m.id);

    // Создаем Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MINTO Education System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. Лист User - все пользователи, связанные с курсом
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { enrollments: { some: { moduleId: { in: moduleIds } } } },
          { submissions: { some: { moduleId: { in: moduleIds } } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const userSheet = workbook.addWorksheet('User');
    userSheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'telegramId', key: 'telegramId', width: 20 },
      { header: 'firstName', key: 'firstName', width: 20 },
      { header: 'lastName', key: 'lastName', width: 20 },
      { header: 'position', key: 'position', width: 30 },
      { header: 'role', key: 'role', width: 15 },
      { header: 'profileCompleted', key: 'profileCompleted', width: 15 },
      { header: 'createdAt', key: 'createdAt', width: 25 },
      { header: 'updatedAt', key: 'updatedAt', width: 25 },
    ];
    userSheet.addRows(users);

    // 2. Лист CourseModule - модули курса
    const courseModules = await this.prisma.courseModule.findMany({
      where: { courseId: courseId },
      include: {
        course: {
          select: { title: true },
        },
      },
      orderBy: { index: 'asc' },
    });

    const moduleSheet = workbook.addWorksheet('CourseModule');
    moduleSheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'courseId', key: 'courseId', width: 30 },
      { header: 'courseTitle', key: 'courseTitle', width: 40 },
      { header: 'index', key: 'index', width: 10 },
      { header: 'title', key: 'title', width: 40 },
      { header: 'description', key: 'description', width: 50 },
      { header: 'isExam', key: 'isExam', width: 10 },
      { header: 'autoUnlockForNewLearners', key: 'autoUnlockForNewLearners', width: 20 },
      { header: 'createdAt', key: 'createdAt', width: 25 },
      { header: 'updatedAt', key: 'updatedAt', width: 25 },
    ];
    moduleSheet.addRows(
      courseModules.map((m) => ({
        ...m,
        courseTitle: m.course?.title || null,
      })),
    );

    // 3. Лист CourseStep - шаги модулей курса
    const courseSteps = await this.prisma.courseStep.findMany({
      where: { moduleId: { in: moduleIds } },
      include: {
        module: {
          select: { title: true, index: true },
        },
      },
      orderBy: [{ module: { index: 'asc' } }, { index: 'asc' }],
    });

    const stepSheet = workbook.addWorksheet('CourseStep');
    stepSheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'moduleId', key: 'moduleId', width: 30 },
      { header: 'moduleTitle', key: 'moduleTitle', width: 40 },
      { header: 'moduleIndex', key: 'moduleIndex', width: 15 },
      { header: 'index', key: 'index', width: 10 },
      { header: 'type', key: 'type', width: 15 },
      { header: 'title', key: 'title', width: 40 },
      { header: 'content', key: 'content', width: 60 },
      { header: 'requiresAiReview', key: 'requiresAiReview', width: 20 },
      { header: 'expectedAnswer', key: 'expectedAnswer', width: 15 },
      { header: 'maxScore', key: 'maxScore', width: 10 },
      { header: 'aiRubric', key: 'aiRubric', width: 60 },
      { header: 'isRequired', key: 'isRequired', width: 15 },
      { header: 'createdAt', key: 'createdAt', width: 25 },
      { header: 'updatedAt', key: 'updatedAt', width: 25 },
    ];
    stepSheet.addRows(
      courseSteps.map((s) => ({
        ...s,
        moduleTitle: s.module.title,
        moduleIndex: s.module.index,
        module: undefined,
      })),
    );

    // 4. Лист Enrollment - прогресс по модулям курса
    const enrollments = await this.prisma.enrollment.findMany({
      where: { moduleId: { in: moduleIds } },
      include: {
        user: {
          select: { firstName: true, lastName: true, telegramId: true },
        },
        module: {
          select: { title: true, index: true },
        },
        unlockedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { module: { index: 'asc' } }],
    });

    const enrollmentSheet = workbook.addWorksheet('Enrollment');
    enrollmentSheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'userId', key: 'userId', width: 30 },
      { header: 'userName', key: 'userName', width: 30 },
      { header: 'userTelegramId', key: 'userTelegramId', width: 20 },
      { header: 'moduleId', key: 'moduleId', width: 30 },
      { header: 'moduleTitle', key: 'moduleTitle', width: 40 },
      { header: 'moduleIndex', key: 'moduleIndex', width: 15 },
      { header: 'status', key: 'status', width: 15 },
      { header: 'unlockedById', key: 'unlockedById', width: 30 },
      { header: 'unlockedByName', key: 'unlockedByName', width: 30 },
      { header: 'unlockedAt', key: 'unlockedAt', width: 25 },
      { header: 'completedAt', key: 'completedAt', width: 25 },
    ];
    enrollmentSheet.addRows(
      enrollments.map((e) => ({
        ...e,
        userName: this.formatUserName(e.user.firstName, e.user.lastName),
        userTelegramId: e.user.telegramId,
        moduleTitle: e.module.title,
        moduleIndex: e.module.index,
        unlockedByName: e.unlockedBy
          ? this.formatUserName(e.unlockedBy.firstName, e.unlockedBy.lastName)
          : null,
        user: undefined,
        module: undefined,
        unlockedBy: undefined,
      })),
    );

    // 5. Лист Submission - сдачи по курсу
    const submissions = await this.prisma.submission.findMany({
      where: { moduleId: { in: moduleIds } },
      include: {
        user: {
          select: { firstName: true, lastName: true, telegramId: true },
        },
        module: {
          select: { title: true, index: true },
        },
        step: {
          select: { title: true, index: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const submissionSheet = workbook.addWorksheet('Submission');
    submissionSheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'userId', key: 'userId', width: 30 },
      { header: 'userName', key: 'userName', width: 30 },
      { header: 'userTelegramId', key: 'userTelegramId', width: 20 },
      { header: 'moduleId', key: 'moduleId', width: 30 },
      { header: 'moduleTitle', key: 'moduleTitle', width: 40 },
      { header: 'moduleIndex', key: 'moduleIndex', width: 15 },
      { header: 'stepId', key: 'stepId', width: 30 },
      { header: 'stepTitle', key: 'stepTitle', width: 40 },
      { header: 'stepIndex', key: 'stepIndex', width: 15 },
      { header: 'stepType', key: 'stepType', width: 15 },
      { header: 'answerText', key: 'answerText', width: 60 },
      { header: 'answerFileId', key: 'answerFileId', width: 30 },
      { header: 'answerType', key: 'answerType', width: 15 },
      { header: 'aiScore', key: 'aiScore', width: 10 },
      { header: 'aiFeedback', key: 'aiFeedback', width: 60 },
      { header: 'curatorScore', key: 'curatorScore', width: 15 },
      { header: 'curatorFeedback', key: 'curatorFeedback', width: 60 },
      { header: 'status', key: 'status', width: 20 },
      { header: 'resubmissionRequested', key: 'resubmissionRequested', width: 20 },
      { header: 'resubmissionRequestedAt', key: 'resubmissionRequestedAt', width: 25 },
      { header: 'telegramPromptMessageId', key: 'telegramPromptMessageId', width: 25 },
      { header: 'createdAt', key: 'createdAt', width: 25 },
      { header: 'updatedAt', key: 'updatedAt', width: 25 },
    ];
    submissionSheet.addRows(
      submissions.map((s) => ({
        ...s,
        userName: this.formatUserName(s.user.firstName, s.user.lastName),
        userTelegramId: s.user.telegramId,
        moduleTitle: s.module.title,
        moduleIndex: s.module.index,
        stepTitle: s.step.title,
        stepIndex: s.step.index,
        stepType: s.step.type,
        user: undefined,
        module: undefined,
        step: undefined,
      })),
    );

    // 6. Лист SubmissionHistory - история сдач по курсу
    const submissionHistories = await this.prisma.submissionHistory.findMany({
      where: {
        submission: {
          moduleId: { in: moduleIds },
        },
      },
      include: {
        submission: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            step: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const historySheet = workbook.addWorksheet('SubmissionHistory');
    historySheet.columns = [
      { header: 'id', key: 'id', width: 30 },
      { header: 'submissionId', key: 'submissionId', width: 30 },
      { header: 'userName', key: 'userName', width: 30 },
      { header: 'stepTitle', key: 'stepTitle', width: 40 },
      { header: 'answerText', key: 'answerText', width: 60 },
      { header: 'answerFileId', key: 'answerFileId', width: 30 },
      { header: 'answerType', key: 'answerType', width: 15 },
      { header: 'aiScore', key: 'aiScore', width: 10 },
      { header: 'aiFeedback', key: 'aiFeedback', width: 60 },
      { header: 'curatorScore', key: 'curatorScore', width: 15 },
      { header: 'curatorFeedback', key: 'curatorFeedback', width: 60 },
      { header: 'status', key: 'status', width: 20 },
      { header: 'reason', key: 'reason', width: 20 },
      { header: 'createdAt', key: 'createdAt', width: 25 },
    ];
    historySheet.addRows(
      submissionHistories.map((h) => ({
        ...h,
        userName: this.formatUserName(
          h.submission.user.firstName,
          h.submission.user.lastName,
        ),
        stepTitle: h.submission.step.title,
        submission: undefined,
      })),
    );

    // Применяем стили к заголовкам
    [userSheet, moduleSheet, stepSheet, enrollmentSheet, submissionSheet, historySheet].forEach(
      (sheet) => {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      },
    );

    // Генерируем Excel файл в Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

