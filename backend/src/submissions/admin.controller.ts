import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { SubmissionsService } from './submissions.service';
import { ApproveSubmissionDto } from './dto/approve-submission.dto';
import { ReturnSubmissionDto } from './dto/return-submission.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';
import { UserRole, SubmissionStatus } from '@prisma/client';

/**
 * SubmissionsAdminController - управление сдачами для кураторов
 */
@Controller('admin/submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsAdminController {
  constructor(private submissionsService: SubmissionsService) {}

  /**
   * GET /admin/submissions
   * Список сдач с фильтрами (по модулю, статусу)
   */
  @Get()
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getSubmissions(
    @Query('moduleId') moduleId?: string,
    @Query('status') status?: SubmissionStatus,
  ): Promise<SubmissionResponseDto[]> {
    return this.submissionsService.findAllWithFilters(moduleId, status);
  }

  /**
   * GET /admin/submissions/:id
   * Получить детали конкретной сдачи (для проверки куратором)
   */
  @Get(':id')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async getSubmissionById(@Param('id') id: string): Promise<SubmissionResponseDto> {
    return this.submissionsService.findById(id);
  }

  /**
   * POST /admin/submissions/:id/approve
   * Одобрить сдачу
   * Выставляет curatorScore, curatorFeedback, статус CURATOR_APPROVED
   */
  @Post(':id/approve')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async approveSubmission(
    @Param('id') id: string,
    @Body() dto: ApproveSubmissionDto,
  ): Promise<SubmissionResponseDto> {
    return this.submissionsService.updateStatus(
      id,
      'CURATOR_APPROVED',
      dto.curatorScore,
      dto.curatorFeedback,
    );
  }

  /**
   * POST /admin/submissions/:id/return
   * Вернуть сдачу на доработку
   * Выставляет curatorFeedback, статус CURATOR_RETURNED
   */
  @Post(':id/return')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async returnSubmission(
    @Param('id') id: string,
    @Body() dto: ReturnSubmissionDto,
  ): Promise<SubmissionResponseDto> {
    return this.submissionsService.updateStatus(
      id,
      'CURATOR_RETURNED',
      undefined,
      dto.curatorFeedback,
    );
  }
}

