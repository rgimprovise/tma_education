import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { CuratorStatsDto } from './dto/curator-stats.dto';

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
        resubmissionRequested: true,
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
      const returnedSubmissions = userSubmissions.filter(
        (s) => s.status === 'CURATOR_RETURNED',
      ).length;
      const resubmissionRequestedSubmissions = userSubmissions.filter(
        (s) => s.resubmissionRequested === true,
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
        returnedSubmissions,
        resubmissionRequestedSubmissions,
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

  /**
   * Удалить пользователя (для куратора)
   * Удаляет пользователя и все связанные данные (enrollments, submissions)
   * @param userId - ID пользователя для удаления
   */
  async deleteUser(userId: string): Promise<void> {
    // Проверяем, что пользователь существует
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Запрещаем удаление кураторов и админов
    if (user.role === 'CURATOR' || user.role === 'ADMIN') {
      throw new BadRequestException('Cannot delete curator or admin users');
    }

    // Удаляем пользователя (каскадное удаление enrollments и submissions через Prisma)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Получить статистику для куратора
   */
  async getCuratorStats(): Promise<CuratorStatsDto> {
    // Получаем всех учеников
    const learners = await this.prisma.user.findMany({
      where: { role: 'LEARNER' },
    });

    // Получаем все enrollments
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        user: { role: 'LEARNER' },
      },
    });

    // Получаем все submissions
    const submissions = await this.prisma.submission.findMany({
      where: {
        user: { role: 'LEARNER' },
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    // Получаем все модули
    const modules = await this.prisma.courseModule.findMany();

    // Подсчитываем статистику
    const totalLearners = learners.length;
    const activeLearners = new Set(submissions.map((s) => s.userId)).size;
    
    // Ученики, завершившие курс (все модули COMPLETED)
    const learnersWithAllCompleted = learners.filter((learner) => {
      const learnerEnrollments = enrollments.filter((e) => e.userId === learner.id);
      return learnerEnrollments.length > 0 && 
             learnerEnrollments.every((e) => e.status === 'COMPLETED');
    });
    const completedLearners = learnersWithAllCompleted.length;

    const totalModules = modules.length;
    const completedModulesCount = enrollments.filter((e) => e.status === 'COMPLETED').length;
    const averageCompletionRate = totalModules > 0 && totalLearners > 0
      ? (completedModulesCount / (totalModules * totalLearners)) * 100 
      : 0;

    const totalSubmissions = submissions.length;
    const pendingSubmissions = submissions.filter(
      (s) => s.status === 'SENT' || s.status === 'AI_REVIEWED',
    ).length;
    const approvedSubmissions = submissions.filter(
      (s) => s.status === 'CURATOR_APPROVED',
    ).length;
    const returnedSubmissions = submissions.filter(
      (s) => s.status === 'CURATOR_RETURNED',
    ).length;
    const resubmissionRequestedSubmissions = submissions.filter(
      (s) => s.resubmissionRequested === true,
    ).length;

    // Средние оценки
    const aiScores = submissions.filter((s) => s.aiScore !== null).map((s) => s.aiScore!);
    const curatorScores = submissions.filter((s) => s.curatorScore !== null).map((s) => s.curatorScore!);
    const averageAiScore = aiScores.length > 0 
      ? aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length 
      : null;
    const averageCuratorScore = curatorScores.length > 0 
      ? curatorScores.reduce((sum, score) => sum + score, 0) / curatorScores.length 
      : null;

    // Процент возвратов
    const returnRate = totalSubmissions > 0 
      ? (returnedSubmissions / totalSubmissions) * 100 
      : 0;

    // Статистика по прогрессу
    const learnersByProgress = {
      notStarted: learners.filter((learner) => {
        const learnerEnrollments = enrollments.filter((e) => e.userId === learner.id);
        return learnerEnrollments.length === 0 || 
               learnerEnrollments.every((e) => e.status === 'LOCKED');
      }).length,
      inProgress: learners.filter((learner) => {
        const learnerEnrollments = enrollments.filter((e) => e.userId === learner.id);
        return learnerEnrollments.some((e) => e.status === 'IN_PROGRESS') &&
               !learnerEnrollments.every((e) => e.status === 'COMPLETED');
      }).length,
      completed: completedLearners,
    };

    return {
      totalLearners,
      activeLearners,
      completedLearners,
      totalModules,
      completedModulesCount,
      averageCompletionRate,
      totalSubmissions,
      pendingSubmissions,
      approvedSubmissions,
      returnedSubmissions,
      resubmissionRequestedSubmissions,
      averageAiScore,
      averageCuratorScore,
      returnRate,
      learnersByProgress,
    };
  }
}

