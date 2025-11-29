import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AudioSubmissionsService } from './audio-submissions.service';

class StartAudioSubmissionDto {
  stepId: string;
  moduleId: string;
}

/**
 * AudioSubmissionsController - управление аудио-сдачами через Telegram
 */
@Controller('audio-submissions')
@UseGuards(JwtAuthGuard)
export class AudioSubmissionsController {
  constructor(
    private audioSubmissionsService: AudioSubmissionsService,
  ) {}

  /**
   * POST /audio-submissions/start
   * Инициировать аудио-сдачу: создать submission и отправить инструкцию в Telegram
   */
  @Post('start')
  async startAudioSubmission(
    @Request() req,
    @Body() dto: StartAudioSubmissionDto,
  ) {
    return this.audioSubmissionsService.startAudioSubmission(
      req.user.id,
      dto.stepId,
      dto.moduleId,
    );
  }
}

