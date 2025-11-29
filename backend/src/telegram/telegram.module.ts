import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    // forwardRef для избежания циклической зависимости
    // (TelegramModule -> SubmissionsModule -> TelegramModule)
    // SubmissionsModule будет импортирован динамически в TelegramService
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

