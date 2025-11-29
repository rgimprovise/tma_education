import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';

/**
 * SubmissionsController - работа со сдачами заданий
 */
@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  /**
   * POST /submissions
   * Создать сдачу (moduleId, stepId, answerText / answerFileId)
   */
  @Post()
  async create(
    @Request() req,
    @Body() dto: CreateSubmissionDto,
  ): Promise<SubmissionResponseDto> {
    return this.submissionsService.create({
      userId: req.user.id,
      stepId: dto.stepId,
      moduleId: dto.moduleId,
      answerText: dto.answerText,
      answerFileId: dto.answerFileId,
      answerType: dto.answerType || 'TEXT',
    });
  }

  /**
   * GET /submissions/my
   * Мои сдачи (для обучающихся)
   */
  @Get('my')
  async getMySubmissions(@Request() req): Promise<SubmissionResponseDto[]> {
    return this.submissionsService.findByUserId(req.user.id);
  }

  /**
   * GET /submissions
   * Список сдач (для кураторов - все, для обучающихся - только свои)
   */
  @Get()
  async findAll(@Request() req): Promise<SubmissionResponseDto[]> {
    // Кураторы видят все, обучающиеся - только свои
    const userId = req.user.role === 'CURATOR' || req.user.role === 'ADMIN' 
      ? undefined 
      : req.user.id;
    return this.submissionsService.findAll(userId);
  }

  /**
   * POST /submissions/:id/request-resubmission
   * Запросить повторную отправку ответа (только для владельца submission)
   */
  @Post(':id/request-resubmission')
  async requestResubmission(
    @Param('id') id: string,
    @Request() req,
  ): Promise<{ message: string; submission: SubmissionResponseDto }> {
    return this.submissionsService.requestResubmission(id, req.user.id);
  }

  /**
   * GET /submissions/:id
   * Детальная информация о сдаче
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<SubmissionResponseDto> {
    return this.submissionsService.findById(id);
  }
}

