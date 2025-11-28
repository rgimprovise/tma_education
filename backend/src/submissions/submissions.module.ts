import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsAdminController } from './admin.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  controllers: [SubmissionsController, SubmissionsAdminController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
  imports: [AiModule, AuthModule, TelegramModule],
})
export class SubmissionsModule {}

