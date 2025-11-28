import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * DatabaseModule предоставляет PrismaClient через Dependency Injection.
 * Модуль помечен как @Global(), поэтому доступен во всех модулях приложения.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

