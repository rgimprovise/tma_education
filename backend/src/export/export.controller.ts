import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExportService } from './export.service';
import { ExportFormat } from './dto/export-params.dto';
import { UserRole } from '@prisma/client';

/**
 * AdminExportController - контроллер для экспорта данных
 * 
 * Предоставляет эндпоинты для выгрузки "сырых" данных в различных форматах
 * для последующего анализа в ИИ.
 */
@Controller('admin/export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminExportController {
  constructor(private exportService: ExportService) {}

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
}

