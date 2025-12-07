import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { AdminExportController } from './export.controller';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, TelegramModule],
  controllers: [AdminExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}

