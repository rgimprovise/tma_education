import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CourseReportData,
  CourseReportInfo,
  CourseStats,
  ModuleReportData,
  StepReportData,
  PositionReportData,
  AiVsCuratorStats,
  SlaStats,
  ProblemReport,
} from './dto/course-report.dto';
import { ModuleStatus, SubmissionStatus, UserRole, StepType } from '@prisma/client';

@Injectable()
export class CourseReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Построить детальный отчёт по курсу
   */
  async buildCourseReport(courseId: string): Promise<CourseReportData> {
    // Загружаем курс со всеми связанными данными одним запросом
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            steps: {
              orderBy: { index: 'asc' },
            },
            enrollments: {
              include: {
                user: {
                  select: {
                    id: true,
                    position: true,
                    role: true,
                  },
                },
              },
            },
            submissions: {
              include: {
                user: {
                  select: {
                    id: true,
                    position: true,
                    role: true,
                  },
                },
                step: {
                  select: {
                    id: true,
                    index: true,
                    title: true,
                    type: true,
                    isRequired: true,
                    maxScore: true,
                  },
                },
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

    // Собираем все уникальные userId для получения полной информации о пользователях
    const allUserIds = new Set<string>();
    course.modules.forEach((module) => {
      module.enrollments.forEach((e) => allUserIds.add(e.userId));
      module.submissions.forEach((s) => allUserIds.add(s.userId));
    });

    // Загружаем всех пользователей одним запросом
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(allUserIds) },
        role: UserRole.LEARNER, // Только ученики для статистики
      },
      select: {
        id: true,
        position: true,
      },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Фильтруем модули: исключаем те, у которых нет enrollments
    const modulesWithEnrollments = course.modules.filter((module: any) => {
      const enrollments = module.enrollments.filter((e: any) => usersMap.has(e.userId));
      return enrollments.length > 0;
    });

    // Строим отчёт
    const courseInfo = this.buildCourseInfo(course, modulesWithEnrollments);
    const stats = this.buildCourseStats(modulesWithEnrollments, usersMap);
    const modules = this.buildModulesReport(modulesWithEnrollments, usersMap);
    const positions = this.buildPositionsReport(modulesWithEnrollments, usersMap);
    const aiVsCurator = this.buildAiVsCuratorStats(modulesWithEnrollments);
    const sla = this.buildSlaStats(modulesWithEnrollments);
    const problems = this.buildProblemsReport(modules);
    
    // Строим список всех учеников с прогрессом
    const learnersProgress = this.buildLearnersProgress(modulesWithEnrollments, usersMap);

    return {
      course: courseInfo,
      stats,
      modules,
      positions,
      aiVsCurator,
      sla,
      problems,
      learnersProgress,
    };
  }

  /**
   * Построить информацию о курсе
   */
  private buildCourseInfo(course: any, modules: any[]): CourseReportInfo {
    // Исключаем шаги типа INFO
    const allSteps = modules.flatMap((m: any) => m.steps).filter((s: any) => s.type !== StepType.INFO);
    const requiredSteps = allSteps.filter((s: any) => s.isRequired);
    
    // Находим период обучения: от первого unlockedAt до последнего completedAt
    const allEnrollments = course.modules.flatMap((m: any) => m.enrollments);
    const unlockedDates = allEnrollments
      .map((e: any) => e.unlockedAt)
      .filter((d: any) => d !== null)
      .map((d: any) => new Date(d));
    const completedDates = allEnrollments
      .map((e: any) => e.completedAt)
      .filter((d: any) => d !== null)
      .map((d: any) => new Date(d));

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      modulesCount: course.modules.length,
      stepsCount: allSteps.length,
      requiredStepsCount: requiredSteps.length,
      learningPeriod: {
        start: unlockedDates.length > 0 ? new Date(Math.min(...unlockedDates.map((d: Date) => d.getTime()))) : null,
        end: completedDates.length > 0 ? new Date(Math.max(...completedDates.map((d: Date) => d.getTime()))) : null,
      },
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  /**
   * Построить список всех учеников с прогрессом
   */
  private buildLearnersProgress(modules: any[], usersMap: Map<string, any>): any[] {
    const learnersMap = new Map<string, any>();

    // Собираем данные по каждому ученику
    modules.forEach((module: any) => {
      module.enrollments.forEach((enrollment: any) => {
        const userId = enrollment.userId;
        if (!usersMap.has(userId)) return;

        if (!learnersMap.has(userId)) {
          const user = usersMap.get(userId);
          learnersMap.set(userId, {
            userId,
            firstName: enrollment.user?.firstName || '',
            lastName: enrollment.user?.lastName || '',
            position: user?.position || null,
            modulesCompleted: 0,
            modulesInProgress: 0,
            totalSubmissions: 0,
            approvedSubmissions: 0,
            returnedSubmissions: 0,
            avgScore: null,
            lowScores: [] as any[],
            returnedSteps: [] as any[],
          });
        }

        const learner = learnersMap.get(userId);
        if (enrollment.status === ModuleStatus.COMPLETED) {
          learner.modulesCompleted++;
        } else if (enrollment.status === ModuleStatus.IN_PROGRESS) {
          learner.modulesInProgress++;
        }
      });

      // Собираем submissions (исключаем шаги типа INFO)
      const nonInfoStepIds = new Set(
        module.steps.filter((s: any) => s.type !== StepType.INFO).map((s: any) => s.id)
      );

      module.submissions.forEach((submission: any) => {
        if (!usersMap.has(submission.userId)) return;
        if (!nonInfoStepIds.has(submission.stepId)) return; // Исключаем INFO шаги

        const userId = submission.userId;
        if (!learnersMap.has(userId)) {
          const user = usersMap.get(userId);
          learnersMap.set(userId, {
            userId,
            firstName: submission.user?.firstName || '',
            lastName: submission.user?.lastName || '',
            position: user?.position || null,
            modulesCompleted: 0,
            modulesInProgress: 0,
            totalSubmissions: 0,
            approvedSubmissions: 0,
            returnedSubmissions: 0,
            avgScore: null,
            lowScores: [] as any[],
            returnedSteps: [] as any[],
          });
        }

        const learner = learnersMap.get(userId);
        learner.totalSubmissions++;

        if (submission.status === SubmissionStatus.CURATOR_APPROVED) {
          learner.approvedSubmissions++;
        } else if (submission.status === SubmissionStatus.CURATOR_RETURNED) {
          learner.returnedSubmissions++;
          learner.returnedSteps.push({
            moduleIndex: module.index,
            moduleTitle: module.title,
            stepIndex: submission.step?.index || '?',
            stepTitle: submission.step?.title || '?',
          });
        }

        // Проверяем низкие оценки (менее 6/10)
        const score = submission.curatorScore || submission.aiScore;
        if (score !== null && score !== undefined && score < 6) {
          learner.lowScores.push({
            moduleIndex: module.index,
            moduleTitle: module.title,
            stepIndex: submission.step?.index || '?',
            stepTitle: submission.step?.title || '?',
            score: score,
          });
        }
      });
    });

    // Вычисляем средний балл для каждого ученика
    const learners = Array.from(learnersMap.values()).map((learner) => {
      const allScores: number[] = [];
      modules.forEach((module: any) => {
        const nonInfoStepIds = new Set(
          module.steps.filter((s: any) => s.type !== StepType.INFO).map((s: any) => s.id)
        );
        module.submissions
          .filter((s: any) => s.userId === learner.userId && nonInfoStepIds.has(s.stepId))
          .forEach((s: any) => {
            const score = s.curatorScore || s.aiScore;
            if (score !== null && score !== undefined) {
              allScores.push(score);
            }
          });
      });

      learner.avgScore = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : null;

      return learner;
    });

    // Сортируем по имени
    learners.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return learners;
  }

  /**
   * Построить общие KPI по курсу
   */
  private buildCourseStats(modules: any[], usersMap: Map<string, any>): CourseStats {
    const allEnrollments = modules.flatMap((m: any) => m.enrollments);
    // Исключаем submissions для шагов типа INFO
    const allSubmissions = modules.flatMap((module: any) => {
      const nonInfoStepIds = new Set(
        module.steps.filter((s: any) => s.type !== StepType.INFO).map((s: any) => s.id)
      );
      return module.submissions.filter((s: any) => nonInfoStepIds.has(s.stepId));
    });
    
    // Уникальные участники (только LEARNER)
    const uniqueLearnerIds = new Set<string>();
    allEnrollments.forEach((e: any) => {
      const user = usersMap.get(e.userId);
      if (user) {
        uniqueLearnerIds.add(e.userId);
      }
    });

    const totalLearners = uniqueLearnerIds.size;
    
    // Начали обучение (IN_PROGRESS или COMPLETED)
    const startedEnrollments = allEnrollments.filter(
      (e: any) => e.status === ModuleStatus.IN_PROGRESS || e.status === ModuleStatus.COMPLETED,
    );
    const startedLearnerIds = new Set<string>(startedEnrollments.map((e: any) => e.userId));
    const startedLearners = Array.from(startedLearnerIds).filter((id: string) => usersMap.has(id)).length;

    // Завершили курс (COMPLETED для всех модулей)
    const completedByModule = new Map<string, Set<string>>();
    modules.forEach((module: any) => {
      const completed = module.enrollments
        .filter((e: any) => e.status === ModuleStatus.COMPLETED)
        .map((e: any) => e.userId);
      completedByModule.set(module.id, new Set(completed));
    });

    const completedLearners = Array.from(uniqueLearnerIds).filter((userId) => {
      return modules.every((module: any) => {
        const completed = completedByModule.get(module.id);
        return completed && completed.has(userId);
      });
    }).length;

    // Средний процент завершения
    const completionPercentages: number[] = [];
    Array.from(uniqueLearnerIds).forEach((userId) => {
      const userEnrollments = allEnrollments.filter((e: any) => e.userId === userId);
      const completedCount = userEnrollments.filter((e: any) => e.status === ModuleStatus.COMPLETED).length;
      const totalCount = userEnrollments.length;
      if (totalCount > 0) {
        completionPercentages.push((completedCount / totalCount) * 100);
      }
    });
    const avgCompletionPercent =
      completionPercentages.length > 0
        ? completionPercentages.reduce((a, b) => a + b, 0) / completionPercentages.length
        : 0;

    // Время прохождения
    const completionTimes: number[] = [];
    allEnrollments
      .filter((e: any) => e.status === ModuleStatus.COMPLETED && e.unlockedAt && e.completedAt)
      .forEach((e: any) => {
        const unlocked = new Date(e.unlockedAt);
        const completed = new Date(e.completedAt);
        const days = (completed.getTime() - unlocked.getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0) {
          completionTimes.push(days);
        }
      });

    const avgCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null;

    const medianCompletionTime = this.calculateMedian(completionTimes);

    return {
      totalLearners,
      startedLearners,
      completedLearners,
      avgCompletionPercent,
      totalSubmissions: allSubmissions.length,
      avgCompletionTime,
      medianCompletionTime,
    };
  }

  /**
   * Построить отчёт по модулям
   */
  private buildModulesReport(modules: any[], usersMap: Map<string, any>): ModuleReportData[] {
    return modules.map((module) => {
      // Статистика по Enrollment
      const enrollments = module.enrollments.filter((e: any) => usersMap.has(e.userId));
      const enrollmentStats = {
        total: enrollments.length,
        locked: enrollments.filter((e: any) => e.status === ModuleStatus.LOCKED).length,
        inProgress: enrollments.filter((e: any) => e.status === ModuleStatus.IN_PROGRESS).length,
        completed: enrollments.filter((e: any) => e.status === ModuleStatus.COMPLETED).length,
        completionRate: 0,
      };
      enrollmentStats.completionRate =
        enrollmentStats.total > 0 ? (enrollmentStats.completed / enrollmentStats.total) * 100 : 0;

      // Статистика по Submission
      const submissions = module.submissions.filter((s: any) => usersMap.has(s.userId));
      const submissionStats = {
        total: submissions.length,
        sent: submissions.filter((s: any) => s.status === SubmissionStatus.SENT).length,
        aiReviewed: submissions.filter((s: any) => s.status === SubmissionStatus.AI_REVIEWED).length,
        approved: submissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_APPROVED).length,
        returned: submissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_RETURNED).length,
        returnsPercent: 0,
      };
      submissionStats.returnsPercent =
        submissionStats.total > 0 ? (submissionStats.returned / submissionStats.total) * 100 : 0;

      // Оценки
      const aiScores = submissions
        .map((s: any) => s.aiScore)
        .filter((score: any) => score !== null && score !== undefined);
      const curatorScores = submissions
        .map((s: any) => s.curatorScore)
        .filter((score: any) => score !== null && score !== undefined);
      const maxScore = Math.max(...module.steps.map((s: any) => s.maxScore), 10);

      const scores = {
        avgAiScore: aiScores.length > 0 ? aiScores.reduce((a: number, b: number) => a + b, 0) / aiScores.length : null,
        avgCuratorScore:
          curatorScores.length > 0
            ? curatorScores.reduce((a: number, b: number) => a + b, 0) / curatorScores.length
            : null,
        maxScore,
      };

      // Время прохождения
      const completionTimes: number[] = [];
      enrollments
        .filter((e: any) => e.status === ModuleStatus.COMPLETED && e.unlockedAt && e.completedAt)
        .forEach((e: any) => {
          const unlocked = new Date(e.unlockedAt);
          const completed = new Date(e.completedAt);
          const days = (completed.getTime() - unlocked.getTime()) / (1000 * 60 * 60 * 24);
          if (days > 0) {
            completionTimes.push(days);
          }
        });

      const timeStats =
        completionTimes.length > 0
          ? {
              avgTimeToComplete: completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length,
              medianTimeToComplete: this.calculateMedian(completionTimes),
            }
          : null;

      // Исключаем шаги типа INFO при подсчете
      const nonInfoSteps = module.steps.filter((s: any) => s.type !== StepType.INFO);
      
      // Детализация по шагам (исключаем INFO)
      const steps = this.buildStepsReport(module.steps, module.submissions, enrollments.length);
      
      return {
        module: {
          id: module.id,
          index: module.index,
          title: module.title,
          description: module.description,
          isExam: module.isExam,
          stepsCount: nonInfoSteps.length,
          requiredStepsCount: nonInfoSteps.filter((s: any) => s.isRequired).length,
        },
        enrollmentStats,
        submissionStats,
        scores,
        timeStats,
        steps,
      };
    });
  }

  /**
   * Построить отчёт по шагам
   */
  private buildStepsReport(steps: any[], allSubmissions: any[], totalLearners: number): StepReportData[] {
    // Исключаем шаги типа INFO
    return steps.filter((step: any) => step.type !== StepType.INFO).map((step) => {
      const stepSubmissions = allSubmissions.filter((s: any) => s.stepId === step.id);
      
      const submissionStats = {
        total: stepSubmissions.length,
        sent: stepSubmissions.filter((s: any) => s.status === SubmissionStatus.SENT).length,
        aiReviewed: stepSubmissions.filter((s: any) => s.status === SubmissionStatus.AI_REVIEWED).length,
        approved: stepSubmissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_APPROVED).length,
        returned: stepSubmissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_RETURNED).length,
        returnsPercent: 0,
      };
      submissionStats.returnsPercent =
        submissionStats.total > 0 ? (submissionStats.returned / submissionStats.total) * 100 : 0;

      const aiScores = stepSubmissions
        .map((s: any) => s.aiScore)
        .filter((score: any) => score !== null && score !== undefined);
      const curatorScores = stepSubmissions
        .map((s: any) => s.curatorScore)
        .filter((score: any) => score !== null && score !== undefined);

      const scores = {
        avgAiScore: aiScores.length > 0 ? aiScores.reduce((a: number, b: number) => a + b, 0) / aiScores.length : null,
        avgCuratorScore:
          curatorScores.length > 0
            ? curatorScores.reduce((a: number, b: number) => a + b, 0) / curatorScores.length
            : null,
      };

      const completionRate = totalLearners > 0 ? (submissionStats.approved / totalLearners) * 100 : 0;

      return {
        step: {
          id: step.id,
          index: step.index,
          title: step.title,
          type: step.type,
          isRequired: step.isRequired,
          maxScore: step.maxScore,
        },
        submissionStats,
        scores,
        completionRate,
      };
    });
  }

  /**
   * Построить отчёт по должностям
   */
  private buildPositionsReport(modules: any[], usersMap: Map<string, any>): PositionReportData[] {
    const positionsMap = new Map<string | null, any>();

    // Собираем данные по должностям
    modules.forEach((module) => {
      // Исключаем submissions для шагов типа INFO
      const nonInfoStepIds = new Set(
        module.steps.filter((s: any) => s.type !== StepType.INFO).map((s: any) => s.id)
      );

      module.enrollments.forEach((enrollment: any) => {
        const user = usersMap.get(enrollment.userId);
        if (!user) return;

        const position = user.position || null;
        if (!positionsMap.has(position)) {
          positionsMap.set(position, {
            position,
            learnerIds: new Set<string>(),
            enrollments: [],
            submissions: [],
          });
        }

        const posData = positionsMap.get(position);
        posData.learnerIds.add(enrollment.userId);
        posData.enrollments.push(enrollment);
      });

      module.submissions
        .filter((s: any) => nonInfoStepIds.has(s.stepId))
        .forEach((submission: any) => {
          const user = usersMap.get(submission.userId);
          if (!user) return;

          const position = user.position || null;
          if (!positionsMap.has(position)) {
            positionsMap.set(position, {
              position,
              learnerIds: new Set<string>(),
              enrollments: [],
              submissions: [],
            });
          }

          const posData = positionsMap.get(position);
          posData.submissions.push(submission);
        });
    });

    // Формируем отчёт
    return Array.from(positionsMap.values()).map((posData) => {
      const enrollments = posData.enrollments;
      const submissions = posData.submissions;

      const enrollmentStats = {
        total: enrollments.length,
        completed: enrollments.filter((e: any) => e.status === ModuleStatus.COMPLETED).length,
        avgCompletionPercent: 0,
      };

      // Вычисляем средний процент завершения
      const learnerIds = Array.from(posData.learnerIds);
      const completionPercentages: number[] = [];
      learnerIds.forEach((userId) => {
        const userEnrollments = enrollments.filter((e: any) => e.userId === userId);
        const completedCount = userEnrollments.filter((e: any) => e.status === ModuleStatus.COMPLETED).length;
        const totalCount = userEnrollments.length;
        if (totalCount > 0) {
          completionPercentages.push((completedCount / totalCount) * 100);
        }
      });
      enrollmentStats.avgCompletionPercent =
        completionPercentages.length > 0
          ? completionPercentages.reduce((a, b) => a + b, 0) / completionPercentages.length
          : 0;

      const approvedSubmissions = submissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_APPROVED);
      const curatorScores = approvedSubmissions
        .map((s: any) => s.curatorScore)
        .filter((score: any) => score !== null && score !== undefined);

      const submissionStats = {
        total: submissions.length,
        approved: approvedSubmissions.length,
        avgScore: curatorScores.length > 0 ? curatorScores.reduce((a: number, b: number) => a + b, 0) / curatorScores.length : null,
      };

      return {
        position: posData.position,
        learnersCount: posData.learnerIds.size,
        enrollmentStats,
        submissionStats,
      };
    });
  }

  /**
   * Построить статистику AI vs Curator
   */
  private buildAiVsCuratorStats(modules: any[]): AiVsCuratorStats {
    // Исключаем submissions для шагов типа INFO
    const allSubmissions = modules.flatMap((module: any) => {
      const nonInfoStepIds = new Set(
        module.steps.filter((s: any) => s.type !== StepType.INFO).map((s: any) => s.id)
      );
      return module.submissions.filter((s: any) => nonInfoStepIds.has(s.stepId));
    });
    
    const aiScores = allSubmissions
      .map((s: any) => s.aiScore)
      .filter((score: any) => score !== null && score !== undefined);
    const curatorScores = allSubmissions
      .map((s: any) => s.curatorScore)
      .filter((score: any) => score !== null && score !== undefined);
    
    const submissionsWithBothScores = allSubmissions.filter(
      (s: any) => s.aiScore !== null && s.curatorScore !== null,
    );

    const avgAiScore = aiScores.length > 0 ? aiScores.reduce((a: number, b: number) => a + b, 0) / aiScores.length : null;
    const avgCuratorScore =
      curatorScores.length > 0 ? curatorScores.reduce((a: number, b: number) => a + b, 0) / curatorScores.length : null;

    // Средняя разница
    const differences = submissionsWithBothScores.map((s: any) => s.curatorScore - s.aiScore);
    const avgScoreDifference =
      differences.length > 0 ? differences.reduce((a: number, b: number) => a + b, 0) / differences.length : null;

    // Корреляция (Pearson)
    let correlation: number | null = null;
    if (submissionsWithBothScores.length >= 3) {
      const aiValues = submissionsWithBothScores.map((s: any) => s.aiScore);
      const curatorValues = submissionsWithBothScores.map((s: any) => s.curatorScore);
      correlation = this.calculatePearsonCorrelation(aiValues, curatorValues);
    }

    return {
      avgAiScore,
      avgCuratorScore,
      avgScoreDifference,
      submissionsWithBothScores: submissionsWithBothScores.length,
      correlation,
    };
  }

  /**
   * Построить статистику SLA
   */
  private buildSlaStats(modules: any[]): SlaStats {
    const allSubmissions = modules.flatMap((m: any) => m.submissions);
    
    const approvedSubmissions = allSubmissions.filter((s: any) => s.status === SubmissionStatus.CURATOR_APPROVED);
    const pendingSubmissions = allSubmissions.filter(
      (s: any) => s.status === SubmissionStatus.SENT || s.status === SubmissionStatus.AI_REVIEWED,
    );

    // Время проверки (updatedAt - createdAt) для одобренных сдач
    const reviewTimes: number[] = [];
    approvedSubmissions.forEach((s: any) => {
      const created = new Date(s.createdAt);
      const updated = new Date(s.updatedAt);
      const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (hours > 0) {
        reviewTimes.push(hours);
      }
    });

    const avgReviewTime = reviewTimes.length > 0 ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length : null;
    const medianReviewTime = this.calculateMedian(reviewTimes);

    // Сдачи, ожидающие проверки более 24/48 часов
    const now = new Date();
    const pendingOver24h = pendingSubmissions.filter((s: any) => {
      const created = new Date(s.createdAt);
      const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hours > 24;
    }).length;

    const pendingOver48h = pendingSubmissions.filter((s: any) => {
      const created = new Date(s.createdAt);
      const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hours > 48;
    }).length;

    return {
      avgReviewTime,
      medianReviewTime,
      pendingSubmissions: pendingSubmissions.length,
      pendingOver24h,
      pendingOver48h,
    };
  }

  /**
   * Построить отчёт о проблемных модулях и шагах
   */
  private buildProblemsReport(modules: ModuleReportData[]): ProblemReport[] {
    const problems: ProblemReport[] = [];

    modules.forEach((module) => {
      const issues: ProblemReport['issues'] = [];

      // Низкий процент завершения (< 50%)
      if (module.enrollmentStats.completionRate < 50) {
        issues.push({
          lowCompletionRate: {
            rate: module.enrollmentStats.completionRate,
            threshold: 50,
          },
        });
      }

      // Высокий процент возвратов (> 30%)
      if (module.submissionStats.returnsPercent > 30) {
        issues.push({
          highReturnsPercent: {
            percent: module.submissionStats.returnsPercent,
            threshold: 30,
          },
        });
      }

      // Низкий средний балл (< 6/10)
      if (module.scores.avgCuratorScore !== null && module.scores.avgCuratorScore < 6) {
        issues.push({
          lowAvgScore: {
            score: module.scores.avgCuratorScore,
            threshold: 6,
          },
        });
      }

      if (issues.length > 0) {
        problems.push({
          type: 'module',
          id: module.module.id,
          title: module.module.title,
          index: module.module.index,
          issues,
        });
      }

      // Проблемные шаги
      module.steps.forEach((step) => {
        const stepIssues: ProblemReport['issues'] = [];

        if (step.completionRate < 50) {
          stepIssues.push({
            lowCompletionRate: {
              rate: step.completionRate,
              threshold: 50,
            },
          });
        }

        if (step.submissionStats.returnsPercent > 30) {
          stepIssues.push({
            highReturnsPercent: {
              percent: step.submissionStats.returnsPercent,
              threshold: 30,
            },
          });
        }

        if (step.scores.avgCuratorScore !== null && step.scores.avgCuratorScore < 6) {
          stepIssues.push({
            lowAvgScore: {
              score: step.scores.avgCuratorScore,
              threshold: 6,
            },
          });
        }

        if (stepIssues.length > 0) {
          problems.push({
            type: 'step',
            id: step.step.id,
            title: step.step.title,
            index: step.step.index,
            issues: stepIssues,
          });
        }
      });
    });

    return problems;
  }

  /**
   * Вычислить медиану
   */
  private calculateMedian(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Вычислить корреляцию Пирсона
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number | null {
    if (x.length !== y.length || x.length === 0) return null;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return null;
    return numerator / denominator;
  }
}

