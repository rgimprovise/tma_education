import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * UsersController - работа с пользователями
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * GET /users/me
   * Информация о текущем пользователе (role, basic info)
   */
  @Get('me')
  async getMe(@Request() req): Promise<UserResponseDto> {
    return this.usersService.findById(req.user.id);
  }

  /**
   * GET /users
   * Список всех пользователей (для кураторов/админов)
   */
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }
}

