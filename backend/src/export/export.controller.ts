import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Request,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExportService } from './export.service';
import { ExportFormat } from './dto/export-params.dto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * AdminExportController - контроллер для экспорта данных
 * 
 * Предоставляет эндпоинты для выгрузки "сырых" данных в различных форматах
 * для последующего анализа в ИИ.
 */
@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminExportController {
  constructor(
    private exportService: ExportService,
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  /**
   * GET /admin/export/submissions
   * Экспорт сырых данных по сдачам
   * 
   * Query параметры:
   * - courseId (required) - ID курса
   * - moduleId (optional) - ID модуля для фильтрации
   * - dateFrom (optional) - Начальная дата (ISO 8601)
   * - dateTo (optional) - Конечная дата (ISO 8601)
   * - format (optional) - Формат экспорта: csv, tsv, json (по умолчанию csv)
   * 
   * Пример запроса:
   * GET /admin/export/submissions?courseId=xxx&format=csv&dateFrom=2025-01-01
   * 
   * Пример CSV вывода (первые строки):
   * submissionId,userId,userFullName,userPosition,userRole,courseId,courseTitle,moduleId,moduleTitle,moduleIndex,stepId,stepTitle,stepIndex,stepType,isRequired,answerType,answerTextOrTranscript,aiScore,curatorScore,status,aiFeedback,curatorFeedback,createdAt,updatedAt,resubmissionRequested,resubmissionRequestedAt,telegramPromptMessageId,maxScore
   * "sub_123","user_456","Иван Иванов","Менеджер","LEARNER","course_789","Полный курс...","mod_101","Модуль 1",1,"step_202","Приветствие",0,"INFO",false,"TEXT","",null,null,"SENT",null,null,"2025-11-01T10:00:00.000Z","2025-11-01T10:00:00.000Z",false,null,null,10
   * "sub_124","user_456","Иван Иванов","Менеджер","LEARNER","course_789","Полный курс...","mod_101","Модуль 1",1,"step_203","Что такое пирамида Минто",1,"TASK",true,"TEXT","Мой ответ на задание...",7.5,8.0,"CURATOR_APPROVED","Хороший ответ","Отлично!","2025-11-02T14:30:00.000Z","2025-11-02T15:00:00.000Z",false,null,null,10
   */
  @Get('submissions')
  @Roles(UserRole.ADMIN, UserRole.CURATOR)
  async exportSubmissions(
    @Res() res: Response,
    @Query('courseId') courseId: string,
    @Query('moduleId') moduleId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('format') format: string = 'csv',
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    // Валидация формата
    const exportFormat = this.parseFormat(format);

    // Парсим даты
    const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo) : undefined;

    if (dateFrom && isNaN(dateFromParsed!.getTime())) {
      throw new BadRequestException('Invalid dateFrom format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    if (dateTo && isNaN(dateToParsed!.getTime())) {
      throw new BadRequestException('Invalid dateTo format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    // Строим экспорт
    const rows = await this.exportService.buildSubmissionExport(courseId, {
      moduleId,
      dateFrom: dateFromParsed,
      dateTo: dateToParsed,
    });

    // Форматируем данные
    const formattedData = this.exportService.formatData(rows, exportFormat);

    // Устанавливаем заголовки ответа
    const filename = this.generateFilename('submissions', courseId, exportFormat);
    this.setResponseHeaders(res, exportFormat, filename);

    // Отправляем данные
    res.send(formattedData);
  }

  /**
   * GET /admin/export/user-progress
   * Экспорт агрегированного прогресса пользователей
   * 
   * Query параметры:
   * - courseId (required) - ID курса
   * - dateFrom (optional) - Начальная дата (ISO 8601)
   * - dateTo (optional) - Конечная дата (ISO 8601)
   * - format (optional) - Формат экспорта: csv, tsv, json (по умолчанию csv)
   * 
   * Пример запроса:
   * GET /admin/export/user-progress?courseId=xxx&format=csv
   * 
   * Пример CSV вывода (первые строки):
   * userId,userFullName,userPosition,userRole,courseId,courseTitle,modulesCount,completedModulesCount,completionPercent,totalSubmissions,avgAiScore,avgCuratorScore,returnsCount,returnsPercent,firstActivityAt,lastActivityAt,activityPeriodDays,approvedSubmissionsCount,pendingSubmissionsCount,resubmissionRequestedCount,userCreatedAt
   * "user_456","Иван Иванов","Менеджер","LEARNER","course_789","Полный курс...",4,2,50.0,10,7.5,8.0,1,10.0,"2025-11-01T10:00:00.000Z","2025-11-15T14:30:00.000Z",14,7,2,0,"2025-10-15T08:00:00.000Z"
   */
  @Get('user-progress')
  @Roles(UserRole.ADMIN, UserRole.CURATOR)
  async exportUserProgress(
    @Res() res: Response,
    @Query('courseId') courseId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('format') format: string = 'csv',
  ) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    // Валидация формата
    const exportFormat = this.parseFormat(format);

    // Парсим даты
    const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo) : undefined;

    if (dateFrom && isNaN(dateFromParsed!.getTime())) {
      throw new BadRequestException('Invalid dateFrom format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    if (dateTo && isNaN(dateToParsed!.getTime())) {
      throw new BadRequestException('Invalid dateTo format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    // Строим экспорт
    const rows = await this.exportService.buildUserProgressExport(courseId, {
      dateFrom: dateFromParsed,
      dateTo: dateToParsed,
    });

    // Форматируем данные
    const formattedData = this.exportService.formatData(rows, exportFormat);

    // Устанавливаем заголовки ответа
    const filename = this.generateFilename('user-progress', courseId, exportFormat);
    this.setResponseHeaders(res, exportFormat, filename);

    // Отправляем данные
    res.send(formattedData);
  }

  /**
   * Парсить формат экспорта
   */
  private parseFormat(format: string): ExportFormat {
    const normalized = format.toLowerCase();
    if (normalized === 'csv' || normalized === 'tsv' || normalized === 'json') {
      return normalized as ExportFormat;
    }
    throw new BadRequestException(`Invalid format: ${format}. Supported formats: csv, tsv, json`);
  }

  /**
   * Установить заголовки ответа
   */
  private setResponseHeaders(res: Response, format: ExportFormat, filename: string) {
    switch (format) {
      case ExportFormat.CSV:
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        break;
      case ExportFormat.TSV:
        res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
        break;
      case ExportFormat.JSON:
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        break;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }

  /**
   * Сгенерировать имя файла
   */
  private generateFilename(type: string, courseId: string, format: ExportFormat): string {
    const dateStr = new Date().toISOString().split('T')[0];
    const extension = format === ExportFormat.JSON ? 'json' : format;
    return `${type}_export_course_${courseId}_${dateStr}.${extension}`;
  }

  /**
   * POST /admin/export/send-telegram
   * Экспортировать данные по сдачам и отправить через Telegram
   * 
   * Body параметры:
   * - courseId (required) - ID курса
   * - moduleId (optional) - ID модуля для фильтрации
   * - dateFrom (optional) - Начальная дата (ISO 8601)
   * - dateTo (optional) - Конечная дата (ISO 8601)
   * - format (optional) - Формат экспорта: csv, tsv, json (по умолчанию csv)
   * - type (optional) - Тип экспорта: 'submissions' или 'user-progress' (по умолчанию 'submissions')
   */
  @Post('send-telegram')
  @Roles(UserRole.ADMIN, UserRole.CURATOR)
  async exportSubmissionsAndSendTelegram(
    @Request() req: any,
    @Body() body: {
      courseId: string;
      moduleId?: string;
      dateFrom?: string;
      dateTo?: string;
      format?: string;
      type?: 'submissions' | 'user-progress';
    },
  ) {
    const { courseId, moduleId, dateFrom, dateTo, format = 'csv', type = 'submissions' } = body;

    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    // Получаем текущего пользователя
    const userId = req.user.id;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, firstName: true, lastName: true },
    });

    if (!user || !user.telegramId) {
      throw new NotFoundException('User not found or has no Telegram ID');
    }

    // Получаем информацию о курсе
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Валидация формата
    const exportFormat = this.parseFormat(format);

    // Парсим даты
    const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
    const dateToParsed = dateTo ? new Date(dateTo) : undefined;

    if (dateFrom && isNaN(dateFromParsed!.getTime())) {
      throw new BadRequestException('Invalid dateFrom format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    if (dateTo && isNaN(dateToParsed!.getTime())) {
      throw new BadRequestException('Invalid dateTo format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }

    // Строим экспорт в зависимости от типа
    let rows: any[];
    let filename: string;
    let caption: string;

    if (type === 'user-progress') {
      rows = await this.exportService.buildUserProgressExport(courseId, {
        dateFrom: dateFromParsed,
        dateTo: dateToParsed,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const extension = exportFormat === ExportFormat.JSON ? 'json' : exportFormat;
      filename = `экспорт_прогресса_${course.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${dateStr}.${extension}`;
      caption = `📥 Экспорт прогресса участников\n\n` +
        `Курс: ${course.title}\n` +
        `Дата генерации: ${new Date().toLocaleDateString('ru-RU', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}\n\n` +
        `📊 Статистика:\n` +
        `• Всего участников: ${rows.length}\n` +
        `• Формат: ${exportFormat.toUpperCase()}`;
    } else {
      rows = await this.exportService.buildSubmissionExport(courseId, {
        moduleId,
        dateFrom: dateFromParsed,
        dateTo: dateToParsed,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const extension = exportFormat === ExportFormat.JSON ? 'json' : exportFormat;
      filename = `экспорт_сдач_${course.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${dateStr}.${extension}`;
      caption = `📥 Экспорт данных по сдачам\n\n` +
        `Курс: ${course.title}\n` +
        `Дата генерации: ${new Date().toLocaleDateString('ru-RU', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}\n\n` +
        `📊 Статистика:\n` +
        `• Всего записей: ${rows.length}\n` +
        `• Формат: ${exportFormat.toUpperCase()}`;
    }

    // Форматируем данные
    const formattedData = this.exportService.formatData(rows, exportFormat);

    // Отправляем через Telegram бот
    await this.telegramService.sendDocument(
      user.telegramId,
      formattedData,
      filename,
      caption,
    );

    return {
      success: true,
      message: 'Экспорт отправлен в Telegram',
      rowsCount: rows.length,
    };
  }
}

