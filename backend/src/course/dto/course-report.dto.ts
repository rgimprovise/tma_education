import { StepType } from '@prisma/client';

/**
 * Детальный отчёт по курсу для кураторов/админов
 */
export interface CourseReportData {
  // Базовая информация о курсе
  course: CourseReportInfo;
  
  // Общие KPI по курсу
  stats: CourseStats;
  
  // Детализация по модулям
  modules: ModuleReportData[];
  
  // Разрез по должностям (User.position)
  positions: PositionReportData[];
  
  // Сравнение оценок ИИ и куратора
  aiVsCurator: AiVsCuratorStats;
  
  // SLA по проверке (если позволяют timestamps)
  sla: SlaStats;
  
  // Проблемные модули и шаги
  problems: ProblemReport[];
  
  // Список всех учеников с прогрессом
  learnersProgress: LearnerProgressData[];
}

/**
 * Краткая информация о курсе
 */
export interface CourseReportInfo {
  id: string;
  title: string;
  description: string | null;
  modulesCount: number; // Количество модулей в курсе
  stepsCount: number; // Общее количество шагов
  requiredStepsCount: number; // Количество обязательных шагов (isRequired=true)
  // Период обучения: от первого unlockedAt до последнего completedAt
  // Если данных нет - null
  learningPeriod: {
    start: Date | null;
    end: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Общие KPI по курсу
 */
export interface CourseStats {
  // Всего участников (User с role=LEARNER, у которых есть хотя бы один Enrollment)
  totalLearners: number;
  
  // Начали обучение (Enrollment со статусом IN_PROGRESS или COMPLETED)
  startedLearners: number;
  
  // Завершили курс (Enrollment со статусом COMPLETED для всех модулей)
  completedLearners: number;
  
  // Средний процент завершения (по всем Enrollment)
  // Вычисляется: среднее значение (completedSteps / totalRequiredSteps) для каждого Enrollment
  avgCompletionPercent: number;
  
  // Всего сдач по курсу
  totalSubmissions: number;
  
  // Среднее время прохождения курса (в днях)
  // Вычисляется: среднее значение (completedAt - unlockedAt) для всех COMPLETED Enrollment
  // ⚠️ Может быть null, если нет данных по completedAt
  avgCompletionTime: number | null;
  
  // Медианное время прохождения курса (в днях)
  // ⚠️ Может быть null, если нет данных по completedAt
  medianCompletionTime: number | null;
}

/**
 * Детализация по модулю
 */
export interface ModuleReportData {
  // Базовая информация о модуле
  module: {
    id: string;
    index: number;
    title: string;
    description: string | null;
    isExam: boolean;
    stepsCount: number;
    requiredStepsCount: number;
  };
  
  // Статистика по Enrollment
  enrollmentStats: {
    total: number; // Всего Enrollment для этого модуля
    locked: number; // Статус LOCKED
    inProgress: number; // Статус IN_PROGRESS
    completed: number; // Статус COMPLETED
    completionRate: number; // completed / total * 100
  };
  
  // Статистика по Submission
  submissionStats: {
    total: number; // Всего сдач по модулю
    sent: number; // Статус SENT
    aiReviewed: number; // Статус AI_REVIEWED
    approved: number; // Статус CURATOR_APPROVED
    returned: number; // Статус CURATOR_RETURNED
    returnsPercent: number; // returned / total * 100
  };
  
  // Оценки
  scores: {
    avgAiScore: number | null; // Средняя оценка ИИ (по aiScore)
    avgCuratorScore: number | null; // Средняя оценка куратора (по curatorScore)
    maxScore: number; // Максимальный балл (из CourseStep.maxScore)
  };
  
  // Время прохождения
  // ⚠️ Может быть null, если нет данных по completedAt
  timeStats: {
    avgTimeToComplete: number | null; // Среднее время прохождения (в днях)
    medianTimeToComplete: number | null; // Медианное время прохождения (в днях)
  } | null;
  
  // Детализация по шагам модуля
  steps: StepReportData[];
}

/**
 * Детализация по шагу
 */
export interface StepReportData {
  step: {
    id: string;
    index: number;
    title: string;
    type: StepType; // INFO, TASK, QUIZ, EXAM
    isRequired: boolean;
    maxScore: number;
  };
  
  // Статистика по Submission для этого шага
  submissionStats: {
    total: number; // Всего сдач
    sent: number;
    aiReviewed: number;
    approved: number;
    returned: number;
    returnsPercent: number; // returned / total * 100
  };
  
  // Оценки
  scores: {
    avgAiScore: number | null;
    avgCuratorScore: number | null;
  };
  
  // Процент завершения шага
  // Вычисляется: (approved submissions / total learners с Enrollment на модуль) * 100
  completionRate: number;
}

/**
 * Разрез по должностям (User.position)
 */
export interface PositionReportData {
  position: string | null; // null для участников без должности
  
  // Количество участников с этой должностью
  learnersCount: number;
  
  // Статистика по Enrollment
  enrollmentStats: {
    total: number; // Всего Enrollment у участников с этой должностью
    completed: number; // Завершённых модулей
    avgCompletionPercent: number; // Средний процент завершения
  };
  
  // Статистика по Submission
  submissionStats: {
    total: number;
    approved: number;
    avgScore: number | null; // Средний балл (по curatorScore)
  };
}

/**
 * Сравнение оценок ИИ и куратора
 */
export interface AiVsCuratorStats {
  // Средняя оценка ИИ (по всем Submission с aiScore)
  avgAiScore: number | null;
  
  // Средняя оценка куратора (по всем Submission с curatorScore)
  avgCuratorScore: number | null;
  
  // Средняя разница между оценками (curatorScore - aiScore)
  // Положительное значение = куратор оценивает выше ИИ
  // Отрицательное значение = куратор оценивает ниже ИИ
  avgScoreDifference: number | null;
  
  // Количество сдач, где есть обе оценки (для корреляции)
  submissionsWithBothScores: number;
  
  // Корреляция между оценками ИИ и куратора (Pearson correlation)
  // ⚠️ Вычисляется только если submissionsWithBothScores >= 3
  correlation: number | null;
}

/**
 * SLA по проверке
 */
export interface SlaStats {
  // Среднее время проверки (в часах)
  // Вычисляется: среднее значение (updatedAt - createdAt) для Submission со статусом CURATOR_APPROVED
  // ⚠️ Это приблизительная метрика, т.к. updatedAt обновляется при любом изменении
  avgReviewTime: number | null;
  
  // Медианное время проверки (в часах)
  medianReviewTime: number | null;
  
  // Сдачи на проверке (статус SENT или AI_REVIEWED)
  pendingSubmissions: number;
  
  // Сдачи, ожидающие проверки более 24 часов
  pendingOver24h: number;
  
  // Сдачи, ожидающие проверки более 48 часов
  pendingOver48h: number;
}

/**
 * Проблемные модули и шаги
 */
export interface ProblemReport {
  type: 'module' | 'step';
  id: string;
  title: string;
  index: number;
  
  // Причины, почему это проблемное место
  issues: {
    // Низкий процент завершения (< 50%)
    lowCompletionRate?: {
      rate: number;
      threshold: number;
    };
    
    // Высокий процент возвратов (> 30%)
    highReturnsPercent?: {
      percent: number;
      threshold: number;
    };
    
    // Низкий средний балл (< 6/10)
    lowAvgScore?: {
      score: number;
      threshold: number;
    };
  }[];
}

/**
 * Прогресс ученика
 */
export interface LearnerProgressData {
  userId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  modulesCompleted: number;
  modulesInProgress: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  returnedSubmissions: number;
  avgScore: number | null;
  lowScores: Array<{
    moduleIndex: number;
    moduleTitle: string;
    stepIndex: number | string;
    stepTitle: string;
    score: number;
  }>;
  returnedSteps: Array<{
    moduleIndex: number;
    moduleTitle: string;
    stepIndex: number | string;
    stepTitle: string;
  }>;
}

