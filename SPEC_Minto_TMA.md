# ТЗ: Система обучения «Пирамида Минто» на backend + Telegram Mini App

## 1. Цель проекта

Реализовать систему обучения сотрудников компании «Недорогая Мебель» по принципу пирамиды Минто:

- Вся учебная логика (модули, задания, прогресс) — в **backend + БД**.
- Интерфейс для обучающегося и куратора — через **Telegram Mini App (WebApp)**.
- Telegram-бот:
  - выдаёт вход в Mini App;
  - шлёт уведомления (о новых модулях, проверке заданий, комментариях куратора).

Курс и методическая часть описаны в файле `full_minto_bot_spec.md` (лежит в корне проекта). На него нужно опираться как на источник истины по модулям/заданиям.

---

## 2. Роли и сценарии

### 2.1. Роли

1. **Обучающийся (learner)**  
   - Проходит модуль за модулем (строго последовательно).
   - Выполняет задания (текст, аудио, видео).
   - Сдаёт работы на проверку.
   - Получает авто-предварительную оценку от ИИ.
   - Получает финальную оценку и комментарий куратора.
   - Не может самостоятельно открыть следующий модуль — только после решения куратора.

2. **Куратор (curator)**  
   - Видит список участников и их прогресс.
   - Открывает / закрывает доступ к модулям.
   - Просматривает сдачи, согласуется с ИИ-оценкой или корректирует.
   - Пишет участникам, делает рассылки.
   - Просматривает отчёты (кто где застрял, кто не сдаёт).

3. **Администратор (admin)** (можно совместить с куратором)  
   - Управляет структурой курса (модули, шаги/задания).

---

## 3. Стек и архитектура

### 3.1. Стек

- **Backend**: Node.js + TypeScript + **NestJS**
- **БД**: PostgreSQL (можно Supabase/Neon, но логика – обычный Postgres)
- **ORM**: Prisma
- **Telegram-бот**: `node-telegram-bot-api` или `grammY` (на выбор, но один вариант во всём проекте)
- **TMA (Frontend)**: React + Vite (или Next.js SPA), с использованием Telegram WebApp SDK (`@twa-dev/sdk`)
- **AI**: OpenAI API (модель для проверки текстов и финального экзамена)

Принцип: **монорепо** с двумя (или тремя) папками:
- `/backend` — NestJS + Prisma + Telegram Bot + API для TMA
- `/tma` — React-приложение (Telegram Mini App)
- `full_minto_bot_spec.md` — спецификация курса в корне

---

## 4. Модель данных (БД)

Используем Prisma для описания схемы.

### 4.1. User

```prisma
model User {
  id           String   @id @default(cuid())
  telegramId   String   @unique
  firstName    String?
  lastName     String?
  position     String?
  role         UserRole @default(LEARNER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  enrollments  Enrollment[]
  submissions  Submission[]
}

enum UserRole {
  LEARNER
  CURATOR
  ADMIN
}

4.2. CourseModule
model CourseModule {
  id          String        @id @default(cuid())
  index       Int           // 1,2,3,4 (4 = экзамен)
  title       String
  description String?
  isExam      Boolean       @default(false)

  steps       CourseStep[]
  enrollments Enrollment[]
}

4.3. CourseStep
model CourseStep {
  id               String          @id @default(cuid())
  module           CourseModule    @relation(fields: [moduleId], references: [id])
  moduleId         String
  index            Int             // порядок в модуле
  type             StepType
  title            String
  content          String          // текст задания / теории
  requiresAiReview Boolean         @default(false)
  expectedAnswer   AnswerType      @default(TEXT)
  maxScore         Int             @default(10)

  submissions      Submission[]
}

enum StepType {
  INFO
  TASK
  QUIZ
  EXAM
}

enum AnswerType {
  TEXT
  AUDIO
  VIDEO
  FILE
}

4.4. Enrollment (прогресс по модулю)
model Enrollment {
  id        String         @id @default(cuid())
  user      User           @relation(fields: [userId], references: [id])
  userId    String
  module    CourseModule   @relation(fields: [moduleId], references: [id])
  moduleId  String

  status    ModuleStatus   @default(LOCKED)
  unlockedBy User?         @relation("UnlockedBy", fields: [unlockedById], references: [id])
  unlockedById String?
  unlockedAt DateTime?
  completedAt DateTime?
}

enum ModuleStatus {
  LOCKED
  IN_PROGRESS
  COMPLETED
}

4.5. Submission (сдача задания)
model Submission {
  id             String          @id @default(cuid())
  user           User            @relation(fields: [userId], references: [id])
  userId         String
  module         CourseModule    @relation(fields: [moduleId], references: [id])
  moduleId       String
  step           CourseStep      @relation(fields: [stepId], references: [id])
  stepId         String

  answerText     String?
  answerFileId   String?         // file_id из Telegram
  answerType     AnswerType      @default(TEXT)

  aiScore        Float?
  aiFeedback     String?
  curatorScore   Float?
  curatorFeedback String?

  status         SubmissionStatus @default(SENT)

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}

enum SubmissionStatus {
  SENT
  AI_REVIEWED
  CURATOR_APPROVED
  CURATOR_RETURNED
}


(Опционально можно добавить таблицу Message или Event, но не обязательно на первом этапе.)

5. Основные флоу
5.1. Регистрация / авторизация

Через Telegram-бот:

/start:

ищем пользователя по telegramId;

если нет — создаём с ролью LEARNER;

отправляем кнопку «Открыть учебное приложение» (WebApp link).

Через TMA:

TMA получает initData от Telegram (WebApp).

Отправляет initData на бекенд /auth/telegram-webapp.

Backend:

валидирует подпись;

ищет/создаёт пользователя по telegramId;

выдаёт JWT/сессию.

Далее TMA ходит в backend с этим токеном.

5.2. Флоу обучающегося

Главный экран (TMA):

Инфа о пользователе.

Прогресс по модулям (из таблицы Enrollment).

Кнопка «Продолжить обучение»:

backend находит первый модуль со статусом IN_PROGRESS или первый UNLOCKED.

Страница модуля:

список шагов с индикаторами (не начато / отправлено / на проверке / зачтено).

Страница шага:

заголовок + контент (из CourseStep.content);

форма ответа:

текстовое поле,

либо инструкция отправить аудио/видео боту и поле для привязки (на первом этапе можно начать только с текста);

кнопка «Отправить на проверку» → создаётся Submission со статусом SENT.

После отправки:

backend в фоне:

при requiresAiReview = true вызывает OpenAI с промптом (на основе full_minto_bot_spec.md);

заполняет aiScore, aiFeedback, статус меняет на AI_REVIEWED.

Telegram-бот отправляет куратору уведомление:

«Новая сдача от Иван Иванов, Модуль 1, Шаг 2. Оценка ИИ: 7/10».

5.3. Флоу куратора

В TMA (role = CURATOR):

Список участников.

Фильтр по модулю / статусу.

Страница участника:

прогресс по модулям;

список сдач;

кнопка «Открыть модуль N»:

backend создаёт/обновляет Enrollment для модуля → status = IN_PROGRESS + unlockedById.

В боте:

Куратор получает уведомления о сдачах.

При нажатии на inline-кнопку:

«Принять» → статус CURATOR_APPROVED, curatorScore и опциональный комментарий.

«Вернуть» → бот просит ввести комментарий → сохраняет curatorFeedback, статус CURATOR_RETURNED.

Backend шлёт участнику уведомления (через бот).

5.4. Завершение модулей и экзамена

Модуль считается завершённым, если:

все обязательные шаги имеют Submission со статусом CURATOR_APPROVED.

После завершения:

обновляется Enrollment.status = COMPLETED.

участнику — уведомление.

Следующий модуль не открывается автоматически — только по действию куратора.

6. AI-логика

Используем OpenAI API.

Для каждого Submission с requiresAiReview = true:

формируем промпт, учитывая:

текст задания,

ответ участника,

критерии из full_minto_bot_spec.md.

модель возвращает:

краткий числовой балл,

развёрнутый текст фидбэка.

Сохраняем в БД и показываем:

участнику в TMA;

куратору в уведомлении.

7. Telegram Mini App (TMA)

Основные экраны:

Learner:

Dashboard (прогресс + кнопка «Продолжить обучение»).

Страница модуля.

Страница шага (задание).

Список сдач.

Форма «Задать вопрос куратору».

Curator:

Список участников.

Страница участника (прогресс, сдачи).

Управление доступом к модулям.

Форма «Сообщение участнику».

Возможно, простая панель статистики.

8. Нефункциональные требования

Язык интерфейса — только русский.

Лёгкий деплой (в идеале возможность обернуть backend + db в docker-compose).

Код структурирован и понятен (NestJS модули: Auth, Users, Course, Submissions, Telegram).

Возможность расширять:

добавлять новые модули и шаги,

менять критерии оценки,

менять формат заданий.