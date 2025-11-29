import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

interface CreateUserDto {
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  role?: UserRole;
  profileCompleted?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async findById(id: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserDto) {
    return this.prisma.user.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Partial<CreateUserDto>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Получить список обучающихся с их прогрессом (для куратора)
   */
  async getLearnersWithProgress(): Promise<any[]> {
    const learners = await this.prisma.user.findMany({
      where: {
        role: 'LEARNER',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Получаем все enrollments для этих пользователей
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: {
          in: learners.map((l) => l.id),
        },
      },
      include: {
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
      },
    });

    // Получаем статистику по сдачам
    const submissions = await this.prisma.submission.findMany({
      where: {
        userId: {
          in: learners.map((l) => l.id),
        },
      },
      select: {
        userId: true,
        status: true,
      },
    });

    // Группируем enrollments и submissions по userId
    const enrollmentsByUser = new Map<string, typeof enrollments>();
    const submissionsByUser = new Map<string, typeof submissions>();

    enrollments.forEach((e) => {
      if (!enrollmentsByUser.has(e.userId)) {
        enrollmentsByUser.set(e.userId, []);
      }
      enrollmentsByUser.get(e.userId)!.push(e);
    });

    submissions.forEach((s) => {
      if (!submissionsByUser.has(s.userId)) {
        submissionsByUser.set(s.userId, []);
      }
      submissionsByUser.get(s.userId)!.push(s);
    });

    return learners.map((learner) => {
      const userEnrollments = enrollmentsByUser.get(learner.id) || [];
      const userSubmissions = submissionsByUser.get(learner.id) || [];
      const pendingSubmissions = userSubmissions.filter(
        (s) => s.status === 'SENT' || s.status === 'AI_REVIEWED',
      ).length;

      return {
        ...learner,
        enrollments: userEnrollments.map((e) => ({
          id: e.id,
          module: e.module,
          status: e.status,
          unlockedAt: e.unlockedAt || undefined,
          completedAt: e.completedAt || undefined,
        })),
        totalSubmissions: userSubmissions.length,
        pendingSubmissions,
      };
    });
  }

  /**
   * Получить детальный прогресс пользователя (для куратора)
   */
  async getLearnerDetail(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Получаем enrollments с информацией о том, кто открыл
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        module: {
          select: {
            id: true,
            index: true,
            title: true,
            description: true,
          },
        },
        unlockedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        module: {
          index: 'asc',
        },
      },
    });

    // Получаем последние сдачи
    const recentSubmissions = await this.prisma.submission.findMany({
      where: { userId },
      include: {
        step: {
          select: {
            id: true,
            title: true,
            index: true,
          },
        },
        module: {
          select: {
            id: true,
            index: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Статистика
    const allSubmissions = await this.prisma.submission.findMany({
      where: { userId },
      select: {
        status: true,
      },
    });

    const statistics = {
      totalSubmissions: allSubmissions.length,
      approvedSubmissions: allSubmissions.filter((s) => s.status === 'CURATOR_APPROVED').length,
      pendingSubmissions: allSubmissions.filter(
        (s) => s.status === 'SENT' || s.status === 'AI_REVIEWED',
      ).length,
      returnedSubmissions: allSubmissions.filter((s) => s.status === 'CURATOR_RETURNED').length,
    };

    return {
      ...user,
      enrollments: enrollments.map((e) => ({
        id: e.id,
        module: e.module,
        status: e.status,
        unlockedAt: e.unlockedAt || undefined,
        completedAt: e.completedAt || undefined,
        unlockedBy: e.unlockedBy || undefined,
      })),
      recentSubmissions,
      statistics,
    };
  }
}

