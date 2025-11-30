import { Controller, Get, Post, Param, Body, UseGuards, Res, Request } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoursesService, CreateCourseDto } from './courses.service';
import { CourseReportService } from './course-report.service';
import { buildCourseReportHtml } from './course-report-html.builder';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

/**
 * CourseCoursesController - управление курсами (верхний уровень)
 */
@Controller('admin/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseCoursesController {
  constructor(
    private coursesService: CoursesService,
    private courseReportService: CourseReportService,
    private telegramService: TelegramService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /admin/courses
   * Список всех курсов с краткой информацией
   */
  @Get()
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async findAllCourses() {
    return this.coursesService.findAllCourses();
  }

  /**
   * GET /admin/courses/:id
   * Детали курса с модулями
   */
  @Get(':id')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async findCourseById(@Param('id') id: string) {
    return this.coursesService.findCourseById(id);
  }

  /**
   * POST /admin/courses
   * Создать новый курс
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto);
  }

  /**
   * GET /admin/courses/:courseId/report/html
   * Получить детальный отчёт по курсу в формате HTML
   * 
   * Возвращает полноценный HTML-документ с отчётом по курсу,
   * который можно открыть в браузере или в Telegram как .html файл.
   * 
   * Пример запроса:
   * GET /admin/courses/{courseId}/report/html
   * 
   * Ответ: HTML-документ с отчётом
   */
  @Get(':courseId/report/html')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getCourseReport(@Param('courseId') courseId: string, @Res() res: Response) {
    const report = await this.courseReportService.buildCourseReport(courseId);
    const html = buildCourseReportHtml(report);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * POST /admin/courses/:courseId/report/send-telegram
   * Отправить отчёт по курсу в Telegram куратору
   * 
   * Отправляет HTML-отчёт как файл в чат с куратором через Telegram бот.
   */
  @Post(':courseId/report/send-telegram')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async sendCourseReportToTelegram(
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    // Получаем информацию о курсе
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Получаем текущего пользователя
    const userId = req.user.id;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, firstName: true, lastName: true },
    });

    if (!user || !user.telegramId) {
      throw new Error('User not found or has no Telegram ID');
    }

    // Генерируем отчёт
    const report = await this.courseReportService.buildCourseReport(courseId);
    const html = buildCourseReportHtml(report);

    // Формируем имя файла
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `отчет_${course.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${dateStr}.html`;

    // Формируем подпись
    const caption = `📊 Отчёт по курсу: ${course.title}\n\n` +
      `Дата генерации: ${new Date().toLocaleDateString('ru-RU', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}\n\n` +
      `📈 Статистика:\n` +
      `• Участников: ${report.stats.totalLearners}\n` +
      `• Начали обучение: ${report.stats.startedLearners}\n` +
      `• Завершили курс: ${report.stats.completedLearners}\n` +
      `• Средний % завершения: ${report.stats.avgCompletionPercent.toFixed(1)}%\n` +
      `• Всего сдач: ${report.stats.totalSubmissions}`;

    // Отправляем через Telegram бот
    await this.telegramService.sendDocument(
      user.telegramId,
      html,
      filename,
      caption,
    );

    return {
      success: true,
      message: 'Отчёт отправлен в Telegram',
    };
  }
}

