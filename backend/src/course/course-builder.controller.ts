import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CourseAdminService } from './course-admin.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateStepDto } from './dto/create-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { UserRole } from '@prisma/client';

/**
 * CourseBuilderController - конструктор курса (только для ADMIN)
 */
@Controller('admin/course')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseBuilderController {
  constructor(private courseAdminService: CourseAdminService) {}

  /**
   * GET /admin/course/modules
   * Список всех модулей с количеством шагов
   */
  @Get('modules')
  @Roles(UserRole.ADMIN)
  async findAllModules() {
    return this.courseAdminService.findAllModules();
  }

  /**
   * GET /admin/course/modules/:id
   * Получить модуль по ID
   */
  @Get('modules/:id')
  @Roles(UserRole.ADMIN)
  async findModuleById(@Param('id') id: string) {
    return this.courseAdminService.findModuleById(id);
  }

  /**
   * POST /admin/course/modules
   * Создать новый модуль
   */
  @Post('modules')
  @Roles(UserRole.ADMIN)
  async createModule(@Body() dto: CreateModuleDto) {
    return this.courseAdminService.createModule(dto);
  }

  /**
   * PATCH /admin/course/modules/:id
   * Обновить модуль
   */
  @Patch('modules/:id')
  @Roles(UserRole.ADMIN)
  async updateModule(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.courseAdminService.updateModule(id, dto);
  }

  /**
   * DELETE /admin/course/modules/:id
   * Удалить модуль
   */
  @Delete('modules/:id')
  @Roles(UserRole.ADMIN)
  async deleteModule(@Param('id') id: string) {
    return this.courseAdminService.deleteModule(id);
  }

  /**
   * GET /admin/course/modules/:moduleId/steps
   * Список шагов модуля
   */
  @Get('modules/:moduleId/steps')
  @Roles(UserRole.ADMIN)
  async findModuleSteps(@Param('moduleId') moduleId: string) {
    return this.courseAdminService.findModuleSteps(moduleId);
  }

  /**
   * POST /admin/course/steps
   * Создать новый шаг
   */
  @Post('steps')
  @Roles(UserRole.ADMIN)
  async createStep(@Body() dto: CreateStepDto) {
    return this.courseAdminService.createStep(dto);
  }

  /**
   * GET /admin/course/steps/:id
   * Получить шаг по ID
   */
  @Get('steps/:id')
  @Roles(UserRole.ADMIN)
  async findStepById(@Param('id') id: string) {
    // Добавим метод в CourseAdminService для получения шага
    return this.courseAdminService.findStepById(id);
  }

  /**
   * PATCH /admin/course/steps/:id
   * Обновить шаг
   */
  @Patch('steps/:id')
  @Roles(UserRole.ADMIN)
  async updateStep(@Param('id') id: string, @Body() dto: UpdateStepDto) {
    return this.courseAdminService.updateStep(id, dto);
  }

  /**
   * DELETE /admin/course/steps/:id
   * Удалить шаг
   */
  @Delete('steps/:id')
  @Roles(UserRole.ADMIN)
  async deleteStep(@Param('id') id: string) {
    return this.courseAdminService.deleteStep(id);
  }
}

