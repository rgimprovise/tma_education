# Структура базы данных

## 📋 Список таблиц

1. **User** - Пользователи системы
2. **Course** - Учебные курсы
3. **CourseModule** - Модули курса
4. **CourseStep** - Шаги/задания внутри модулей
5. **Enrollment** - Прогресс пользователя по модулям
6. **Submission** - Сдачи заданий обучающимися
7. **SubmissionHistory** - История ответов при возврате/повторной отправке

---

## 👤 User (Пользователи)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `telegramId` | String (unique) | Telegram ID пользователя |
| `firstName` | String? | Имя |
| `lastName` | String? | Фамилия |
| `position` | String? | Должность |
| `role` | UserRole | Роль: LEARNER, CURATOR, ADMIN |
| `profileCompleted` | Boolean | Завершена ли регистрация через бота |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

**Индексы:**
- `telegramId` (unique)
- `role`

---

## 📚 Course (Курсы)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `title` | String | Название курса |
| `description` | String? | Описание курса |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

---

## 📖 CourseModule (Модули курса)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `courseId` | String? | ID курса (FK → Course) |
| `index` | Int (unique) | Порядковый номер модуля (1,2,3,4) |
| `title` | String | Название модуля |
| `description` | String? | Описание модуля |
| `isExam` | Boolean | Является ли модуль экзаменом |
| `autoUnlockForNewLearners` | Boolean | Автоматически открывать для новых учеников |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

**Индексы:**
- `courseId`
- `index` (unique)

---

## 📝 CourseStep (Шаги/задания)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `moduleId` | String | ID модуля (FK → CourseModule) |
| `index` | Int | Порядковый номер в модуле (0, 1, 2, ...) |
| `type` | StepType | Тип: INFO, TASK, QUIZ, EXAM |
| `title` | String | Название шага |
| `content` | String | Текст задания / теории |
| `requiresAiReview` | Boolean | Требуется ли проверка ИИ |
| `expectedAnswer` | AnswerType | Тип ответа: TEXT, AUDIO, VIDEO, FILE |
| `maxScore` | Int | Максимальный балл (по умолчанию 10) |
| `formSchema` | Json? | JSON-схема динамической формы ответа |
| `aiRubric` | String? | Текст критериев для ИИ-проверки |
| `isRequired` | Boolean | Обязателен ли шаг для завершения модуля |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

**Индексы:**
- `moduleId`
- `(moduleId, index)` (unique)

---

## 📊 Enrollment (Прогресс по модулям)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `userId` | String | ID пользователя (FK → User) |
| `moduleId` | String | ID модуля (FK → CourseModule) |
| `status` | ModuleStatus | Статус: LOCKED, IN_PROGRESS, COMPLETED |
| `unlockedById` | String? | ID куратора, открывшего модуль (FK → User) |
| `unlockedAt` | DateTime? | Когда модуль был открыт |
| `completedAt` | DateTime? | Когда модуль был завершен |

**Индексы:**
- `userId`
- `moduleId`
- `status`
- `(userId, moduleId)` (unique)
- `(userId, status)`

---

## 📤 Submission (Сдачи заданий)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `userId` | String | ID пользователя (FK → User) |
| `moduleId` | String | ID модуля (FK → CourseModule) |
| `stepId` | String | ID шага (FK → CourseStep) |
| `answerText` | String? | Текстовый ответ |
| `answerFileId` | String? | file_id из Telegram (для аудио/видео/файлов) |
| `answerType` | AnswerType | Тип ответа: TEXT, AUDIO, VIDEO, FILE |
| `aiScore` | Float? | Оценка от ИИ (0-maxScore) |
| `aiFeedback` | String? | Комментарий от ИИ |
| `curatorScore` | Float? | Финальная оценка куратора |
| `curatorFeedback` | String? | Комментарий куратора |
| `status` | SubmissionStatus | Статус: SENT, AI_REVIEWED, CURATOR_APPROVED, CURATOR_RETURNED |
| `resubmissionRequested` | Boolean | Ученик запросил повторную отправку |
| `resubmissionRequestedAt` | DateTime? | Когда запрошена повторная отправка |
| `telegramPromptMessageId` | Int? | ID сообщения бота с инструкцией для аудио-сдачи |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

**Индексы:**
- `userId`
- `moduleId`
- `stepId`
- `status`
- `(userId, stepId)` (unique)
- `(moduleId, status)`
- `(userId, status)`

---

## 📜 SubmissionHistory (История сдач)

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | String (CUID) | Уникальный идентификатор |
| `submissionId` | String | ID сдачи (FK → Submission) |
| `answerText` | String? | Сохраненный текстовый ответ |
| `answerFileId` | String? | Сохраненный file_id из Telegram |
| `answerType` | AnswerType | Тип ответа: TEXT, AUDIO, VIDEO, FILE |
| `aiScore` | Float? | Оценка от ИИ на момент сохранения |
| `aiFeedback` | String? | Комментарий от ИИ на момент сохранения |
| `curatorScore` | Float? | Оценка куратора на момент сохранения |
| `curatorFeedback` | String? | Комментарий куратора на момент сохранения |
| `status` | SubmissionStatus | Статус на момент сохранения |
| `reason` | String | Причина: 'RETURNED' или 'RESUBMISSION' |
| `createdAt` | DateTime | Дата создания записи |

**Индексы:**
- `submissionId`
- `createdAt`

---

## 🔢 Enum типы

### UserRole
- `LEARNER` - Обучающийся
- `CURATOR` - Куратор
- `ADMIN` - Администратор

### StepType
- `INFO` - Информационный шаг (шпаргалка)
- `TASK` - Задание
- `QUIZ` - Квиз
- `EXAM` - Экзамен

### AnswerType
- `TEXT` - Текстовый ответ
- `AUDIO` - Голосовой ответ
- `VIDEO` - Видео-ответ
- `FILE` - Файл

### ModuleStatus
- `LOCKED` - Заблокирован
- `IN_PROGRESS` - В процессе
- `COMPLETED` - Завершен

### SubmissionStatus
- `SENT` - Отправлено (ожидает проверки)
- `AI_REVIEWED` - Проверено ИИ
- `CURATOR_APPROVED` - Одобрено куратором
- `CURATOR_RETURNED` - Возвращено на доработку

---

## 🔗 Связи между таблицами

```
Course
  └── CourseModule (courseId)
        └── CourseStep (moduleId)
              └── Submission (stepId, moduleId)
                    └── SubmissionHistory (submissionId)

User
  ├── Enrollment (userId)
  ├── Submission (userId)
  └── Enrollment.unlockedBy (unlockedById) - куратор, открывший модуль
```

---

## 📝 Быстрые команды для просмотра на VPS

### Подключение к базе
```bash
cd /var/www/tma_education/backend
psql $(grep DATABASE_URL .env | cut -d '=' -f2 | tr -d '"')
```

### Просмотр всех таблиц
```sql
\dt
```

### Просмотр структуры таблицы
```sql
\d "User"
\d "Course"
\d "CourseModule"
\d "CourseStep"
\d "Enrollment"
\d "Submission"
\d "SubmissionHistory"
```

### Количество записей в каждой таблице
```sql
SELECT 
    'User' as table_name, COUNT(*) as count FROM "User"
UNION ALL
SELECT 'Course', COUNT(*) FROM "Course"
UNION ALL
SELECT 'CourseModule', COUNT(*) FROM "CourseModule"
UNION ALL
SELECT 'CourseStep', COUNT(*) FROM "CourseStep"
UNION ALL
SELECT 'Enrollment', COUNT(*) FROM "Enrollment"
UNION ALL
SELECT 'Submission', COUNT(*) FROM "Submission"
UNION ALL
SELECT 'SubmissionHistory', COUNT(*) FROM "SubmissionHistory";
```

