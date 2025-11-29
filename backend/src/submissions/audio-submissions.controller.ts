import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AudioSubmissionsService } from './audio-submissions.service';

export class StartAudioSubmissionDto {
  @IsString()
  @IsNotEmpty()
  stepId: string;

  @IsString()
  @IsNotEmpty()
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

  /**
   * GET /audio-submissions/play/:fileId
   * Воспроизвести аудио-файл из Telegram (только для кураторов)
   */
  @Get('play/:fileId')
  @UseGuards(RolesGuard)
  @Roles('CURATOR', 'ADMIN')
  async playAudio(
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const audioData = await this.audioSubmissionsService.getAudioFile(fileId);
    
    res.set({
      'Content-Type': audioData.mimeType,
      'Content-Disposition': `inline; filename="${audioData.filename}"`,
      'Content-Length': audioData.buffer.length,
    });
    
    return new StreamableFile(audioData.buffer);
  }
}

