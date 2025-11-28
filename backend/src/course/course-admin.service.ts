import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateStepDto } from './dto/create-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';

@Injectable()
export class CourseAdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Получить список всех модулей с количеством шагов
   */
  async findAllModules() {
    return this.prisma.courseModule.findMany({
      include: {
        _count: {
          select: {
            steps: true,
          },
        },
      },
      orderBy: { index: 'asc' },
    });
  }

  /**
   * Получить модуль по ID
   */
  async findModuleById(id: string) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return module;
  }

  /**
   * Создать новый модуль
   */
  async createModule(dto: CreateModuleDto) {
    // Проверяем, не занят ли индекс
    const existing = await this.prisma.courseModule.findUnique({
      where: { index: dto.index },
    });

    if (existing) {
      throw new ConflictException(`Module with index ${dto.index} already exists`);
    }

    return this.prisma.courseModule.create({
      data: {
        title: dto.title,
        description: dto.description,
        index: dto.index,
        isExam: dto.isExam || false,
      },
    });
  }

  /**
   * Обновить модуль
   */
  async updateModule(id: string, dto: UpdateModuleDto) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Если меняется индекс, проверяем конфликты
    if (dto.index !== undefined && dto.index !== module.index) {
      const existing = await this.prisma.courseModule.findUnique({
        where: { index: dto.index },
      });

      if (existing) {
        throw new ConflictException(`Module with index ${dto.index} already exists`);
      }
    }

    return this.prisma.courseModule.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        index: dto.index,
        isExam: dto.isExam,
      },
    });
  }

  /**
   * Удалить модуль (soft delete через проверку enrollments)
   */
  async deleteModule(id: string) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        enrollments: {
          where: {
            status: {
              in: ['IN_PROGRESS', 'COMPLETED'],
            },
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Если есть активные enrollments, запрещаем удаление
    if (module.enrollments.length > 0) {
      throw new BadRequestException(
        'Cannot delete module with active enrollments. Please wait for all users to complete or remove enrollments first.',
      );
    }

    // Удаляем модуль (CASCADE удалит шаги)
    await this.prisma.courseModule.delete({
      where: { id },
    });

    return { message: 'Module deleted successfully' };
  }

  /**
   * Получить список шагов модуля
   */
  async findModuleSteps(moduleId: string) {
    const module = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    return this.prisma.courseStep.findMany({
      where: { moduleId },
      orderBy: { index: 'asc' },
      select: {
        id: true,
        index: true,
        title: true,
        type: true,
        isRequired: true,
        content: true,
        expectedAnswer: true,
        requiresAiReview: true,
        maxScore: true,
      },
    });
  }

  /**
   * Создать новый шаг
   */
  async createStep(dto: CreateStepDto) {
    // Проверяем, что модуль существует
    const module = await this.prisma.courseModule.findUnique({
      where: { id: dto.moduleId },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Проверяем уникальность индекса в модуле
    const existing = await this.prisma.courseStep.findUnique({
      where: {
        moduleId_index: {
          moduleId: dto.moduleId,
          index: dto.index,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Step with index ${dto.index} already exists in this module`,
      );
    }

    return this.prisma.courseStep.create({
      data: {
        moduleId: dto.moduleId,
        title: dto.title,
        type: dto.type,
        index: dto.index,
        content: dto.content,
        expectedAnswer: dto.expectedAnswer || 'TEXT',
        requiresAiReview: dto.requiresAiReview || false,
        maxScore: dto.maxScore || 10,
        isRequired: dto.isRequired !== undefined ? dto.isRequired : true,
        formSchema: dto.formSchema || null,
        aiRubric: dto.aiRubric || null,
      },
    });
  }

  /**
   * Обновить шаг
   */
  async updateStep(id: string, dto: UpdateStepDto) {
    const step = await this.prisma.courseStep.findUnique({
      where: { id },
      include: {
        submissions: {
          take: 1, // Проверяем только наличие сдач
        },
      },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    const hasSubmissions = step.submissions.length > 0;

    // Если есть сдачи, запрещаем изменение критичных полей
    if (hasSubmissions) {
      const criticalFields: (keyof UpdateStepDto)[] = [
        'type',
        'expectedAnswer',
        'isRequired',
        'maxScore',
      ];

      const changedCriticalFields = criticalFields.filter(
        (field) => dto[field] !== undefined && dto[field] !== (step as any)[field],
      );

      if (changedCriticalFields.length > 0) {
        throw new BadRequestException(
          `Cannot modify critical fields (${changedCriticalFields.join(', ')}) for step with existing submissions`,
        );
      }
    }

    // Если меняется индекс, проверяем конфликты
    if (dto.index !== undefined && dto.index !== step.index) {
      const existing = await this.prisma.courseStep.findUnique({
        where: {
          moduleId_index: {
            moduleId: step.moduleId,
            index: dto.index,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Step with index ${dto.index} already exists in this module`,
        );
      }
    }

    return this.prisma.courseStep.update({
      where: { id },
      data: {
        title: dto.title,
        type: dto.type,
        index: dto.index,
        content: dto.content,
        expectedAnswer: dto.expectedAnswer,
        requiresAiReview: dto.requiresAiReview,
        maxScore: dto.maxScore,
        isRequired: dto.isRequired,
        formSchema: dto.formSchema !== undefined ? dto.formSchema : undefined,
        aiRubric: dto.aiRubric,
      },
    });
  }

  /**
   * Получить шаг по ID
   */
  async findStepById(id: string) {
    const step = await this.prisma.courseStep.findUnique({
      where: { id },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    return step;
  }

  /**
   * Удалить шаг
   */
  async deleteStep(id: string) {
    const step = await this.prisma.courseStep.findUnique({
      where: { id },
      include: {
        submissions: {
          take: 1,
        },
      },
    });

    if (!step) {
      throw new NotFoundException('Step not found');
    }

    // Если есть сдачи, запрещаем удаление
    if (step.submissions.length > 0) {
      throw new BadRequestException(
        'Cannot delete step with existing submissions. Please remove submissions first.',
      );
    }

    await this.prisma.courseStep.delete({
      where: { id },
    });

    return { message: 'Step deleted successfully' };
  }
}

