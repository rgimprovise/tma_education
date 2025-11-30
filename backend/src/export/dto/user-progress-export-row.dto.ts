/**
 * Строка экспорта агрегированного прогресса пользователя по курсу
 * 
 * Используется для экспорта сводной статистики по каждому участнику курса
 * для анализа общего прогресса, эффективности обучения, проблемных участников и т.д.
 */
export interface UserProgressExportRow {
  // Идентификаторы
  userId: string;
  
  // Информация о пользователе
  userFullName: string; // "Иван Иванов" или "Иван" или "Не указано"
  userPosition: string | null; // Должность пользователя
  userRole: string; // LEARNER, CURATOR, ADMIN (обычно LEARNER)
  
  // Информация о курсе
  courseId: string;
  courseTitle: string;
  
  // Прогресс по модулям
  /**
   * Общее количество обязательных модулей в курсе
   * Используется для расчёта completionPercent
   */
  modulesCount: number;
  
  /**
   * Количество завершённых модулей (статус COMPLETED)
   */
  completedModulesCount: number;
  
  /**
   * Процент завершения курса
   * Вычисляется: (completedModulesCount / modulesCount) * 100
   */
  completionPercent: number;
  
  // Статистика по сдачам
  /**
   * Общее количество сдач по курсу
   */
  totalSubmissions: number;
  
  /**
   * Средняя оценка от ИИ
   * Вычисляется: среднее значение aiScore по всем сдачам с aiScore
   * null если нет оценок от ИИ
   */
  avgAiScore: number | null;
  
  /**
   * Средняя оценка от куратора
   * Вычисляется: среднее значение curatorScore по всем сдачам с curatorScore
   * null если нет оценок от куратора
   */
  avgCuratorScore: number | null;
  
  /**
   * Количество возвратов на доработку
   * Вычисляется: количество сдач со статусом CURATOR_RETURNED
   */
  returnsCount: number;
  
  /**
   * Процент возвратов
   * Вычисляется: (returnsCount / totalSubmissions) * 100
   * 0 если totalSubmissions = 0
   */
  returnsPercent: number;
  
  // Временные метки активности
  /**
   * Дата первой сдачи по курсу
   * Вычисляется: минимальный createdAt среди всех сдач пользователя по курсу
   * null если нет сдач
   */
  firstActivityAt: Date | null;
  
  /**
   * Дата последней сдачи по курсу
   * Вычисляется: максимальный createdAt среди всех сдач пользователя по курсу
   * null если нет сдач
   */
  lastActivityAt: Date | null;
  
  /**
   * Период активности (в днях)
   * Вычисляется: разница между lastActivityAt и firstActivityAt (в днях)
   * null если нет сдач или только одна сдача
   */
  activityPeriodDays: number | null;
  
  // Дополнительные метрики (могут быть полезны для анализа)
  /**
   * Количество одобренных сдач (статус CURATOR_APPROVED)
   */
  approvedSubmissionsCount: number;
  
  /**
   * Количество сдач на проверке (статус SENT или AI_REVIEWED)
   */
  pendingSubmissionsCount: number;
  
  /**
   * Количество сдач с запрошенной повторной отправкой
   */
  resubmissionRequestedCount: number;
  
  // Потенциальные поля для будущего расширения (НЕ в БД сейчас):
  /**
   * Средняя длина ответов (в символах)
   * Может быть вычислена из answerTextOrTranscript всех сдач
   * Полезно для анализа краткости/развёрнутости ответов
   */
  // avgAnswerLength?: number;
  
  /**
   * Средняя длина ответов (в словах)
   * Может быть вычислена из answerTextOrTranscript всех сдач
   * Полезно для анализа объёма ответов
   */
  // avgAnswerWordCount?: number;
  
  /**
   * Количество уникальных слов-паразитов (если будет реализован анализ)
   * Может быть вычислено ИИ при анализе ответов
   */
  // fillerWordsCount?: number;
  
  /**
   * Средняя сложность формулировок (оценка от 1 до 10)
   * Может быть вычислена ИИ при анализе ответов
   */
  // avgComplexityScore?: number;
  
  /**
   * Категории наиболее частых ошибок (массив строк)
   * Может быть добавлено в будущем через анализ всех сдач пользователя
   */
  // commonErrorCategories?: string[];
  
  /**
   * Тренд прогресса (улучшение/ухудшение/стабильно)
   * Может быть вычислен на основе изменения оценок со временем
   */
  // progressTrend?: 'improving' | 'declining' | 'stable';
  
  /**
   * Дата регистрации пользователя
   * Может быть полезно для анализа времени до первой активности
   */
  userCreatedAt: Date;
}

