import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsAdminController } from './admin.controller';
import { AudioSubmissionsController } from './audio-submissions.controller';
import { AudioSubmissionsService } from './audio-submissions.service';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  controllers: [
    SubmissionsController,
    SubmissionsAdminController,
    AudioSubmissionsController,
  ],
  providers: [SubmissionsService, AudioSubmissionsService],
  exports: [SubmissionsService, AudioSubmissionsService],
  imports: [AiModule, AuthModule, TelegramModule],
})
export class SubmissionsModule {}

