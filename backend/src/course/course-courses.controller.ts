import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CoursesService, CreateCourseDto } from './courses.service';
import { UserRole } from '@prisma/client';

/**
 * CourseCoursesController - управление курсами (верхний уровень)
 */
@Controller('admin/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseCoursesController {
  constructor(private coursesService: CoursesService) {}

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
}

