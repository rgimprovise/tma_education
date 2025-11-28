/**
 * DTO для ответа с информацией о шаге
 */
export class StepResponseDto {
  id: string;
  moduleId: string;
  index: number;
  type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
  title: string;
  content: string;
  requiresAiReview: boolean;
  expectedAnswer: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  maxScore: number;
  formSchema?: any; // JSON-схема динамической формы
  aiRubric?: string; // Критерии для ИИ-проверки
  isRequired: boolean; // Обязателен ли шаг для завершения модуля
}

/**
 * DTO для ответа с информацией о шаге и прогрессом пользователя
 */
export class StepWithProgressDto extends StepResponseDto {
  submission?: {
    id: string;
    status: 'SENT' | 'AI_REVIEWED' | 'CURATOR_APPROVED' | 'CURATOR_RETURNED';
    aiScore?: number;
    curatorScore?: number;
    createdAt: Date;
  };
}

