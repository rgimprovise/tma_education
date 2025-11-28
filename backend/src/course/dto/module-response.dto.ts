import { StepResponseDto } from './step-response.dto';

/**
 * DTO для ответа с информацией о модуле
 */
export class ModuleResponseDto {
  id: string;
  index: number;
  title: string;
  description?: string;
  isExam: boolean;
  steps?: StepResponseDto[];
}

/**
 * DTO для ответа со списком модулей с прогрессом пользователя
 * enrollment всегда присутствует, но id может быть пустым для LOCKED модулей без enrollment
 */
export class ModuleWithProgressDto extends ModuleResponseDto {
  enrollment: {
    id: string;
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
    unlockedAt?: Date;
    completedAt?: Date;
  };
}

