import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { validateTelegramWebAppData } from './utils/telegram-validator';
import { isCurator } from '../users/curators.config';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private moduleRef: ModuleRef,
  ) {}

  async validateTelegramWebApp(initData: string) {
    // Валидация подписи Telegram WebApp
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Bot token not configured');
    }

    const isValid = validateTelegramWebAppData(initData, botToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Telegram WebApp data');
    }

    // Извлечение telegramId из initData
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) {
      throw new UnauthorizedException('User data not found');
    }

    const userData = JSON.parse(userStr);
    const telegramId = userData.id.toString();

    // Определение роли: кураторы определяются по telegram_id
    const role: UserRole = isCurator(telegramId) ? 'CURATOR' : 'LEARNER';

    // Поиск или создание пользователя
    let user = await this.usersService.findByTelegramId(telegramId);
    const isNewUser = !user;
    
    if (!user) {
      user = await this.usersService.create({
        telegramId,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role,
      });

      // Если новый пользователь - LEARNER, автоматически открываем модули с autoUnlockForNewLearners = true
      if (isNewUser && user.role === 'LEARNER') {
        try {
          const { CourseService } = await import('../course/course.service');
          const courseService = this.moduleRef.get(CourseService, { strict: false });
          if (courseService) {
            // Вызываем асинхронно, не блокируя ответ
            courseService.autoUnlockModulesForNewLearner(user.id).catch((error) => {
              console.error('Failed to auto-unlock modules for new learner:', error);
            });
          }
        } catch (error) {
          console.error('Failed to get CourseService for auto-unlock:', error);
          // Не критично, продолжаем
        }
      }
    } else {
      // Обновляем роль существующего пользователя, если он куратор
      // (на случай, если куратор был добавлен после регистрации)
      if (isCurator(telegramId) && user.role !== 'CURATOR' && user.role !== 'ADMIN') {
        user = await this.usersService.update(user.id, { role: 'CURATOR' });
      }
    }

    // Генерация JWT
    const payload = { sub: user.id, telegramId: user.telegramId };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}

