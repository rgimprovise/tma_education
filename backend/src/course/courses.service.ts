import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCourseDto {
  title: string;
  description?: string;
}

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Получить список всех курсов с краткой информацией
   */
  async findAllCourses() {
    const courses = await this.prisma.course.findMany({
      include: {
        modules: {
          include: {
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Формируем ответ с подсчётом количества модулей и участников
    return courses.map((course) => {
      // Количество уникальных участников по всем модулям курса
      const uniqueLearnerIds = new Set(
        course.modules.flatMap((module) =>
          module.enrollments.map((e) => e.userId),
        ),
      );

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        modulesCount: course.modules.length,
        learnersCount: uniqueLearnerIds.size,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      };
    });
  }

  /**
   * Получить детали курса с модулями
   */
  async findCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            _count: {
              select: {
                steps: true,
                enrollments: true,
              },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Форматируем ответ
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      modules: course.modules.map((module) => ({
        id: module.id,
        index: module.index,
        title: module.title,
        description: module.description,
        isExam: module.isExam,
        stepsCount: module._count.steps,
        enrollmentsCount: module._count.enrollments,
      })),
    };
  }

  /**
   * Создать новый курс
   */
  async createCourse(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
      },
    });
  }
}

