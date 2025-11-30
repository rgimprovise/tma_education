import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

/**
 * Тип экспорта данных
 */
export enum ExportType {
  /**
   * Сырые данные по сдачам (Submission)
   * Каждая строка = одна сдача с полными данными ответа
   */
  SUBMISSIONS = 'submissions',

  /**
   * Агрегированный прогресс пользователей по курсу
   * Каждая строка = один пользователь с агрегированными метриками
   */
  USER_PROGRESS = 'user-progress',
}

/**
 * Формат экспорта
 */
export enum ExportFormat {
  /**
   * CSV (Comma-Separated Values)
   * Разделитель: запятая
   * Кодировка: UTF-8 с BOM для корректного отображения в Excel
   */
  CSV = 'csv',

  /**
   * TSV (Tab-Separated Values)
   * Разделитель: табуляция
   * Кодировка: UTF-8
   * Удобен для обработки в текстовых редакторах и некоторых ИИ-инструментах
   */
  TSV = 'tsv',

  /**
   * JSON (JavaScript Object Notation)
   * Массив объектов
   * Кодировка: UTF-8
   * Удобен для программной обработки и некоторых ИИ-инструментов
   */
  JSON = 'json',
}

/**
 * Параметры запроса на экспорт данных
 */
export class ExportParamsDto {
  /**
   * ID курса (обязательный)
   */
  @IsString()
  courseId: string;

  /**
   * ID модуля (опционально)
   * Если указан, экспортируются данные только по этому модулю
   */
  @IsString()
  @IsOptional()
  moduleId?: string;

  /**
   * Начальная дата фильтрации (опционально)
   * Формат: ISO 8601 (YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss)
   * Фильтрует по createdAt для submissions или по firstActivityAt для user-progress
   */
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  /**
   * Конечная дата фильтрации (опционально)
   * Формат: ISO 8601 (YYYY-MM-DD или YYYY-MM-DDTHH:mm:ss)
   * Фильтрует по createdAt для submissions или по lastActivityAt для user-progress
   */
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  /**
   * Тип экспорта
   * - submissions: сырые данные по сдачам
   * - user-progress: агрегированный прогресс пользователей
   */
  @IsEnum(ExportType)
  type: ExportType;

  /**
   * Формат экспорта
   * - csv: CSV с запятыми
   * - tsv: TSV с табуляцией
   * - json: JSON массив
   */
  @IsEnum(ExportFormat)
  format: ExportFormat;
}

