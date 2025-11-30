import { Controller, Get, Post, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoursesService, CreateCourseDto } from './courses.service';
import { CourseReportService } from './course-report.service';
import { buildCourseReportHtml } from './course-report-html.builder';
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
}

