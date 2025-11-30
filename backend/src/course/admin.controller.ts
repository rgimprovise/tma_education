import { Controller, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CourseService } from './course.service';
import { UnlockModuleDto } from './dto/unlock-module.dto';
import { LockModuleDto } from './dto/lock-module.dto';
import { UserRole } from '@prisma/client';

/**
 * CourseAdminController - управление модулями для кураторов
 */
@Controller('admin/modules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseAdminController {
  constructor(private courseService: CourseService) {}

  /**
   * POST /admin/modules/:moduleId/unlock
   * Открыть модуль для пользователей
   * Принимает:
   *  - userIds: список конкретных пользователей
   *  - allCompletedPrevious: для тех, кто завершил предыдущий модуль
   *  - forAll: для всех зарегистрированных учеников
   */
  @Post(':moduleId/unlock')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async unlockModule(
    @Param('moduleId') moduleId: string,
    @Body() dto: UnlockModuleDto,
    @Request() req,
  ) {
    return this.courseService.unlockModuleForUsers(
      moduleId,
      dto.userIds || [],
      dto.allCompletedPrevious || false,
      dto.forAll || false,
      req.user.id,
    );
  }

  /**
   * POST /admin/modules/:moduleId/lock
   * Заблокировать модуль для пользователей
   * Принимает:
   *  - userIds: список конкретных пользователей
   *  - forAll: для всех зарегистрированных учеников
   */
  @Post(':moduleId/lock')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async lockModule(
    @Param('moduleId') moduleId: string,
    @Body() dto: LockModuleDto,
    @Request() req,
  ) {
    return this.courseService.lockModuleForUsers(
      moduleId,
      dto.userIds || [],
      dto.forAll || false,
      req.user.id,
    );
  }
}

