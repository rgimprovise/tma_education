import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourseService } from './course.service';
import { ModuleWithProgressDto } from './dto/module-response.dto';
import { StepWithProgressDto } from './dto/step-response.dto';

/**
 * CourseController - работа с модулями и шагами курса
 */
@Controller('course')
@UseGuards(JwtAuthGuard)
export class CourseController {
  constructor(private courseService: CourseService) {}

  /**
   * GET /course/modules
   * Список модулей с их статусом для текущего пользователя
   */
  @Get('modules')
  async getModulesWithProgress(@Request() req): Promise<ModuleWithProgressDto[]> {
    return this.courseService.getModulesWithProgress(req.user.id);
  }

  /**
   * GET /course/modules/:id
   * Детальная информация о модуле по его ID
   */
  @Get('modules/:id')
  async getModuleById(
    @Param('id') id: string,
    @Request() req,
  ): Promise<ModuleWithProgressDto> {
    return this.courseService.findModuleById(id, req.user.id);
  }

  /**
   * GET /course/modules/:id/steps
   * Список шагов модуля с прогрессом пользователя
   */
  @Get('modules/:id/steps')
  async getModuleSteps(
    @Param('id') moduleId: string,
    @Request() req,
  ): Promise<StepWithProgressDto[]> {
    return this.courseService.getModuleStepsWithProgress(moduleId, req.user.id);
  }

  /**
   * GET /course/current
   * Текущий модуль для кнопки "Продолжить обучение"
   */
  @Get('current')
  async getCurrentModule(@Request() req): Promise<ModuleWithProgressDto | null> {
    return this.courseService.getCurrentModule(req.user.id);
  }

  /**
   * GET /course/steps/:id
   * Детальная информация по шагу (для страницы задания)
   */
  @Get('steps/:id')
  async getStepById(
    @Param('id') stepId: string,
    @Request() req,
  ): Promise<StepWithProgressDto> {
    return this.courseService.getStepWithProgress(stepId, req.user.id);
  }
}

