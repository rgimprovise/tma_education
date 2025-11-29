/**
 * DTO для ответа с информацией о сдаче
 */
export class SubmissionResponseDto {
  id: string;
  userId: string;
  moduleId: string;
  stepId: string;
  answerText?: string;
  answerFileId?: string;
  answerType: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  aiScore?: number;
  aiFeedback?: string;
  curatorScore?: number;
  curatorFeedback?: string;
  status: 'SENT' | 'AI_REVIEWED' | 'CURATOR_APPROVED' | 'CURATOR_RETURNED';
  resubmissionRequested: boolean;
  resubmissionRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  step?: {
    id: string;
    title: string;
    index: number;
  };
  module?: {
    id: string;
    index: number;
    title: string;
  };
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

