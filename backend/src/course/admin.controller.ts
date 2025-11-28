import { Controller, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CourseService } from './course.service';
import { UnlockModuleDto } from './dto/unlock-module.dto';
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
   * Принимает список userIds или флаг allCompletedPrevious
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
      req.user.id,
    );
  }
}

