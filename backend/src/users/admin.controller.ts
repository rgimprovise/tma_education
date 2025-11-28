import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';
import { LearnerProgressDto, LearnerDetailDto } from './dto/learner-progress.dto';
import { UserRole } from '@prisma/client';

/**
 * AdminController - эндпоинты для кураторов и администраторов
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private usersService: UsersService) {}

  /**
   * GET /admin/learners
   * Список обучающихся с их прогрессом по модулям
   */
  @Get('learners')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getLearners(): Promise<LearnerProgressDto[]> {
    return this.usersService.getLearnersWithProgress();
  }

  /**
   * GET /admin/learners/:id
   * Детальный прогресс пользователя + последние сдачи
   */
  @Get('learners/:id')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getLearnerDetail(@Param('id') id: string): Promise<LearnerDetailDto> {
    return this.usersService.getLearnerDetail(id);
  }
}

