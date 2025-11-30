import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoursesService, CreateCourseDto } from './courses.service';
import { CourseReportService } from './course-report.service';
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
   * Получить детальный отчёт по курсу
   * 
   * Пока возвращает JSON (временно для дебага).
   * В будущем будет возвращать HTML.
   * 
   * Пример запроса:
   * GET /admin/courses/{courseId}/report/html
   * 
   * Пример ответа (JSON):
   * {
   *   "course": {
   *     "id": "...",
   *     "title": "Полный курс по освоению принципа пирамиды Минто",
   *     "modulesCount": 4,
   *     "stepsCount": 19,
   *     "requiredStepsCount": 15,
   *     ...
   *   },
   *   "stats": {
   *     "totalLearners": 2,
   *     "startedLearners": 2,
   *     "completedLearners": 0,
   *     "avgCompletionPercent": 25.5,
   *     "totalSubmissions": 6,
   *     "avgCompletionTime": 5.2,
   *     ...
   *   },
   *   "modules": [...],
   *   "positions": [...],
   *   "aiVsCurator": {...},
   *   "sla": {...},
   *   "problems": [...]
   * }
   */
  @Get(':courseId/report/html')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getCourseReport(@Param('courseId') courseId: string) {
    // Пока возвращаем JSON для дебага
    // В будущем здесь будет генерация HTML
    return this.courseReportService.buildCourseReport(courseId);
  }
}

