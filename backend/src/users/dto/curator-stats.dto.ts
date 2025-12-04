/**
 * DTO для статистики куратора
 */
export interface CuratorStatsDto {
  // Общая статистика по ученикам
  totalLearners: number;
  activeLearners: number; // Ученики с активностью (есть сдачи)
  completedLearners: number; // Ученики, завершившие курс
  
  // Статистика по модулям
  totalModules: number;
  completedModulesCount: number; // Количество завершенных модулей (сумма по всем ученикам)
  averageCompletionRate: number; // Средний процент завершения курса
  
  // Статистика по сдачам
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  returnedSubmissions: number;
  resubmissionRequestedSubmissions: number;
  
  // Статистика по оценкам
  averageAiScore: number | null; // Средняя оценка ИИ
  averageCuratorScore: number | null; // Средняя оценка куратора
  
  // Статистика по возвратам
  returnRate: number; // Процент возвратов от общего количества сдач
  
  // Статистика по прогрессу
  learnersByProgress: {
    notStarted: number; // Не начали
    inProgress: number; // В процессе
    completed: number; // Завершили
  };
}

