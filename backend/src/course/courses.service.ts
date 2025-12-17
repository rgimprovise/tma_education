import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

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

  /**
   * Обновить курс
   */
  async updateCourse(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
      },
    });
  }

  /**
   * Удалить курс (запрещаем, если к нему привязаны модули)
   */
  async deleteCourse(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { modules: { select: { id: true } } },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.modules.length > 0) {
      throw new BadRequestException(
        'Cannot delete course with modules attached. Detach or delete modules first.',
      );
    }

    await this.prisma.course.delete({ where: { id } });
    return { message: 'Course deleted successfully' };
  }

  /**
   * Привязать существующий модуль к курсу
   */
  async attachModule(courseId: string, moduleId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const module = await this.prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.courseModule.update({
      where: { id: moduleId },
      data: { courseId },
    });
  }

  /**
   * Отвязать модуль от курса
   */
  async detachModule(courseId: string, moduleId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const module = await this.prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    if (module.courseId !== courseId) {
      throw new BadRequestException('Module is not attached to this course');
    }

    return this.prisma.courseModule.update({
      where: { id: moduleId },
      data: { courseId: null },
    });
  }
}

