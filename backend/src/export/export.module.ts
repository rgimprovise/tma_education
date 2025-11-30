import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { AdminExportController } from './export.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}

