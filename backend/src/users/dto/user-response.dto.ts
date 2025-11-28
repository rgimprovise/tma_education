/**
 * DTO для ответа с информацией о пользователе
 */
export class UserResponseDto {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  role: 'LEARNER' | 'CURATOR' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

