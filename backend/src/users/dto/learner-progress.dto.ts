import { ModuleWithProgressDto } from '../../course/dto/module-response.dto';
import { SubmissionResponseDto } from '../../submissions/dto/submission-response.dto';

/**
 * DTO для ответа со списком обучающихся с их прогрессом
 */
export class LearnerProgressDto {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  role: string;
  createdAt: Date;
  enrollments: Array<{
    id: string;
    module: {
      id: string;
      index: number;
      title: string;
    };
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
    unlockedAt?: Date;
    completedAt?: Date;
  }>;
  totalSubmissions: number;
  pendingSubmissions: number; // Сдачи на проверке
}

/**
 * DTO для детального прогресса пользователя
 */
export class LearnerDetailDto {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  role: string;
  createdAt: Date;
  enrollments: Array<{
    id: string;
    module: {
      id: string;
      index: number;
      title: string;
      description?: string;
    };
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
    unlockedAt?: Date;
    completedAt?: Date;
    unlockedBy?: {
      id: string;
      firstName?: string;
      lastName?: string;
    };
  }>;
  recentSubmissions: SubmissionResponseDto[];
  statistics: {
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    returnedSubmissions: number;
  };
}

