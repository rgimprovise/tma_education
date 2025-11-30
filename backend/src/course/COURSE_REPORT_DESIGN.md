# Проектирование детального отчёта по курсу

## 📋 Найденные файлы и модули

### Архитектурные документы:
- `ARCHITECTURE.md` - общая архитектура системы
- `SPEC_Minto_TMA.md` - спецификация TMA
- `COURSE_DASHBOARD_EXPANDED.md` - описание расширенного дашборда курса
- `ENROLLMENT_POLICY.md` - политика создания Enrollment
- `TELEGRAM_NOTIFICATIONS.md` - уведомления (для будущей интеграции)

### Backend модули:

#### Course Module (`backend/src/course/`):
- **Сервисы:**
  - `CourseService` (`course.service.ts`) - работа с модулями и шагами для LEARNER
  - `CourseAdminService` (`course-admin.service.ts`) - админские операции, **включая `getModuleStats()`**
  - `CoursesService` (`courses.service.ts`) - управление курсами (верхний уровень)
- **Контроллеры:**
  - `CourseController` (`course.controller.ts`) - `/course/*` для LEARNER
  - `CourseAdminController` (`admin.controller.ts`) - `/admin/modules/*` для кураторов
  - `CourseBuilderController` (`course-builder.controller.ts`) - `/admin/course/*` для конструктора
  - `CourseCoursesController` (`course-courses.controller.ts`) - `/admin/courses/*` для управления курсами
- **Существующие эндпоинты статистики:**
  - `GET /admin/course/modules/:id/stats` - статистика по модулю (реализовано в `CourseAdminService.getModuleStats()`)

#### Users Module (`backend/src/users/`):
- **Сервисы:**
  - `UsersService` (`users.service.ts`) - **включает `getLearnersWithProgress()` и `getLearnerDetail()`**
- **Контроллеры:**
  - `AdminController` (`admin.controller.ts`) - `/admin/learners/*` для кураторов
- **Существующие эндпоинты:**
  - `GET /admin/learners` - список участников с прогрессом
  - `GET /admin/learners/:id` - детальный прогресс участника

#### Submissions Module (`backend/src/submissions/`):
- **Сервисы:**
  - `SubmissionsService` (`submissions.service.ts`) - работа со сдачами
- **Контроллеры:**
  - `SubmissionsAdminController` (`admin.controller.ts`) - `/admin/submissions/*` для кураторов

---

## 🗄️ Анализ схемы данных Prisma

### Поля времени в моделях:

#### ✅ User:
- `createdAt: DateTime` - дата регистрации
- `updatedAt: DateTime` - дата последнего обновления

#### ✅ Course:
- `createdAt: DateTime` - дата создания курса
- `updatedAt: DateTime` - дата последнего обновления

#### ✅ CourseModule:
- `createdAt: DateTime` - дата создания модуля
- `updatedAt: DateTime` - дата последнего обновления

#### ✅ CourseStep:
- `createdAt: DateTime` - дата создания шага
- `updatedAt: DateTime` - дата последнего обновления

#### ⚠️ Enrollment:
- `unlockedAt: DateTime?` - когда модуль был открыт
- `completedAt: DateTime?` - когда модуль был завершён
- **❌ ОТСУТСТВУЕТ:** `createdAt`, `updatedAt`

#### ✅ Submission:
- `createdAt: DateTime` - когда сдача была отправлена
- `updatedAt: DateTime` - дата последнего обновления
- **❌ ОТСУТСТВУЕТ:** `reviewedAt` (когда куратор проверил)

### Другие важные поля:

#### Enrollment:
- `status: ModuleStatus` - LOCKED, IN_PROGRESS, COMPLETED
- `unlockedById: String?` - ID куратора, открывшего модуль

#### Submission:
- `status: SubmissionStatus` - SENT, AI_REVIEWED, CURATOR_APPROVED, CURATOR_RETURNED
- `aiScore: Float?` - оценка от ИИ (0-maxScore)
- `curatorScore: Float?` - финальная оценка куратора
- `resubmissionRequested: Boolean` - запрошена ли повторная отправка
- `resubmissionRequestedAt: DateTime?` - когда запрошена повторная отправка

#### CourseStep:
- `isRequired: Boolean` - обязателен ли шаг для завершения модуля
- `maxScore: Int` - максимальный балл

---

## 📊 Планируемые метрики для отчёта

### Общие KPI по курсу:
1. **totalLearners** - всего участников (User с role=LEARNER, у которых есть хотя бы один Enrollment)
2. **startedLearners** - начали обучение (Enrollment со статусом IN_PROGRESS или COMPLETED)
3. **completedLearners** - завершили курс (Enrollment со статусом COMPLETED для всех модулей)
4. **avgCompletionPercent** - средний процент завершения (по всем Enrollment)
5. **totalSubmissions** - всего сдач по курсу
6. **avgCompletionTime** - среднее время прохождения (если есть данные: `completedAt - unlockedAt`)
7. **medianCompletionTime** - медианное время прохождения

### По модулям (ModuleReportData):
1. **completionRate** - процент завершивших модуль (COMPLETED / total с Enrollment)
2. **avgScore** - средний балл по модулю (по curatorScore или aiScore)
3. **returnsPercent** - процент возвращённых сдач (CURATOR_RETURNED / total submissions)
4. **avgTimeToComplete** - среднее время прохождения модуля
5. **stepsStats** - статистика по каждому шагу модуля

### По позициям (PositionReportData):
1. Группировка по `User.position`
2. Для каждой позиции: количество участников, средний процент завершения, средний балл

### AI vs Curator (aiVsCurator):
1. **avgAiScore** - средняя оценка ИИ
2. **avgCuratorScore** - средняя оценка куратора
3. **scoreDifference** - разница между оценками (curatorScore - aiScore)
4. **correlation** - корреляция между оценками ИИ и куратора

### SLA (sla):
1. **avgReviewTime** - среднее время проверки (если есть `reviewedAt`, но его НЕТ - можно использовать `updatedAt` для CURATOR_APPROVED)
2. **medianReviewTime** - медианное время проверки
3. **pendingSubmissions** - сдачи на проверке (SENT, AI_REVIEWED)

### Проблемные модули/шаги (problems):
1. Модули/шаги с низким `completionRate`
2. Модули/шаги с высоким `returnsPercent`
3. Модули/шаги с низким `avgCuratorScore`

---

## 📝 TypeScript интерфейсы для отчёта

```typescript
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
```

---

## ⚠️ Важные замечания по метрикам

### Поля времени, которых НЕТ в схеме:

1. **Enrollment.createdAt** - нет поля для отслеживания, когда Enrollment был создан
   - **Влияние:** нельзя точно определить, когда участник начал обучение
   - **Обход:** использовать `unlockedAt` (но это не всегда равно моменту создания Enrollment)

2. **Submission.reviewedAt** - нет поля для отслеживания, когда куратор проверил сдачу
   - **Влияние:** нельзя точно определить время проверки (SLA)
   - **Обход:** использовать `updatedAt` для Submission со статусом CURATOR_APPROVED (но это неточно, т.к. updatedAt обновляется при любом изменении)

### Рекомендации для будущих миграций:

1. **Добавить `Enrollment.createdAt`** - для точного отслеживания начала обучения
2. **Добавить `Submission.reviewedAt`** - для точного отслеживания времени проверки (SLA)
3. **Добавить `Submission.reviewedById`** - для отслеживания, какой куратор проверил сдачу

### Временные метрики:

- **Время прохождения модуля:** можно вычислить как `completedAt - unlockedAt` (если оба поля заполнены)
- **Время проверки:** можно приблизительно вычислить как `updatedAt - createdAt` для Submission со статусом CURATOR_APPROVED (но это неточно)

---

## 📍 Где разместить новый сервис/контроллер

### Рекомендуемая структура:

```
backend/src/course/
├── course-report.service.ts      # Новый сервис для генерации отчёта
├── course-report.controller.ts   # Новый контроллер для эндпоинта отчёта
└── dto/
    └── course-report.dto.ts      # DTO для CourseReportData и вложенных интерфейсов
```

### Эндпоинт:

```
GET /admin/courses/:courseId/report
```

**Доступ:** CURATOR, ADMIN

**Параметры запроса (опционально):**
- `includePositions: boolean` - включать ли разрез по должностям
- `includeProblems: boolean` - включать ли проблемные модули/шаги
- `includeSla: boolean` - включать ли SLA метрики

---

## 🔄 Следующие шаги

1. ✅ **Готово:** Анализ архитектуры и схемы данных
2. ✅ **Готово:** Проектирование интерфейсов
3. ⏳ **Следующий шаг:** Реализация `CourseReportService` с методами для вычисления метрик
4. ⏳ **Следующий шаг:** Реализация `CourseReportController` с эндпоинтом `/admin/courses/:courseId/report`
5. ⏳ **Следующий шаг:** Тестирование на реальных данных
6. ⏳ **Следующий шаг:** Создание UI в TMA для отображения отчёта

---

**Дата создания:** 2025-11-30  
**Версия:** 1.0  
**Статус:** Проектирование завершено, готово к реализации

