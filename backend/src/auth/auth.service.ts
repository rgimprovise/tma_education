import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { validateTelegramWebAppData } from './utils/telegram-validator';
import { isCurator } from '../users/curators.config';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateTelegramWebApp(initData: string) {
    // Валидация подписи Telegram WebApp
    const isValid = validateTelegramWebAppData(initData);
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
    if (!user) {
      user = await this.usersService.create({
        telegramId,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role,
      });
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

