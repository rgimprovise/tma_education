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
  module: {
    id: string;
    title: string;
    enrollment?: {
      id: string;
      status: 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';
    };
  };
  
  submission?: {
    id: string;
    status: 'SENT' | 'AI_REVIEWED' | 'CURATOR_APPROVED' | 'CURATOR_RETURNED';
    answerText?: string;
    aiScore?: number;
    aiFeedback?: string;
    curatorScore?: number;
    curatorFeedback?: string;
    createdAt: Date;
  };
}

