# Развёртывание: Добавление сущности Course

## Обзор изменений

Добавлена новая сущность `Course` (Курс) для создания иерархии: **Course → CourseModule → CourseStep**.

---

## Изменения в базе данных

### Новая модель: Course

```prisma
model Course {
  id          String         @id @default(cuid())
  title       String
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  modules     CourseModule[]
}
```

### Обновлена модель: CourseModule

**Добавлены поля:**
- `courseId String?` — ID курса (опционально)
- `course Course?` — связь с курсом

**Поведение при удалении:**
- `onDelete: SetNull` — если курс удаляется, модули остаются (courseId становится null)

---

## Новые API эндпоинты

### 1. GET /admin/courses

**Доступ:** CURATOR, ADMIN

**Описание:** Список всех курсов с краткой информацией

**Ответ:**
```json
[
  {
    "id": "cm4xxx...",
    "title": "Пирамида Минто",
    "description": "Полный курс по освоению принципа...",
    "modulesCount": 4,
    "learnersCount": 5,
    "createdAt": "2025-11-29T...",
    "updatedAt": "2025-11-29T..."
  }
]
```

**Логика подсчёта:**
- `modulesCount` — количество модулей в курсе
- `learnersCount` — количество уникальных участников по всем модулям курса

---

### 2. GET /admin/courses/:id

**Доступ:** CURATOR, ADMIN

**Описание:** Детали курса с модулями

**Ответ:**
```json
{
  "id": "cm4xxx...",
  "title": "Пирамида Минто",
  "description": "Полный курс по освоению принципа...",
  "createdAt": "2025-11-29T...",
  "updatedAt": "2025-11-29T...",
  "modules": [
    {
      "id": "cm4xxx...",
      "index": 1,
      "title": "Модуль 1: Введение в пирамиду Минто",
      "description": "Познакомьтесь с основами...",
      "isExam": false,
      "stepsCount": 6,
      "enrollmentsCount": 5
    },
    {
      "id": "cm4xxx...",
      "index": 2,
      "title": "Модуль 2: Структурирование мыслей...",
      "description": "Научитесь структурировать...",
      "isExam": false,
      "stepsCount": 6,
      "enrollmentsCount": 3
    }
  ]
}
```

---

### 3. POST /admin/courses

**Доступ:** ADMIN only

**Описание:** Создать новый курс

**Тело запроса:**
```json
{
  "title": "Название курса",
  "description": "Описание курса (опционально)"
}
```

**Ответ:**
```json
{
  "id": "cm4xxx...",
  "title": "Название курса",
  "description": "Описание курса",
  "createdAt": "2025-11-29T...",
  "updatedAt": "2025-11-29T..."
}
```

---

## Изменения в Seed

### Создание курса

```typescript
const mintoCourse = await prisma.course.create({
  data: {
    title: 'Пирамида Минто',
    description: 'Полный курс по освоению принципа пирамиды Минто...',
  },
});
```

### Привязка модулей к курсу

```typescript
const module1 = await prisma.courseModule.create({
  data: {
    courseId: mintoCourse.id,  // Привязка к курсу
    index: 1,
    title: 'Модуль 1: Введение в пирамиду Минто',
    // ...
  },
});
```

**Все модули (1, 2, 3, Экзамен) теперь привязаны к курсу "Пирамида Минто".**

---

## Развёртывание на VPS

### Шаг 1: Подключение

```bash
ssh root@79.132.140.13
cd /var/www/tma_education
```

### Шаг 2: Получить обновления

```bash
git pull
```

### Шаг 3: Применить миграцию БД

```bash
cd backend
npx prisma migrate deploy
```

**Ожидаемый вывод:**
```
Applying migration `20251129200000_add_course_model`
The following migration(s) have been applied:
✔ 20251129200000_add_course_model
```

### Шаг 4: Пересоздать данные через seed

**⚠️ ВАЖНО:** Seed скрипт удалит все существующие данные!

```bash
# Только если хотите пересоздать данные
npx prisma db seed
```

**Альтернатива (без удаления данных):**

Если у вас уже есть данные и вы не хотите их терять, выполните вручную:

```bash
sudo -u postgres psql -d minto_db
```

```sql
-- Создать курс
INSERT INTO "Course" (id, title, description, "createdAt", "updatedAt")
VALUES (
  'course_minto_001',
  'Пирамида Минто',
  'Полный курс по освоению принципа пирамиды Минто для эффективной коммуникации',
  NOW(),
  NOW()
);

-- Привязать существующие модули к курсу
UPDATE "CourseModule"
SET "courseId" = 'course_minto_001'
WHERE index IN (1, 2, 3, 4);

\q
```

### Шаг 5: Пересобрать backend

```bash
npm run build
pm2 restart minto-backend
```

### Шаг 6: Проверить статус

```bash
pm2 status
pm2 logs minto-backend --lines 30
```

### Шаг 7: Проверить работу API

```bash
# Проверить, что backend стартовал
curl -I https://tma.n8nrgimprovise.space/api/course/modules

# Должен вернуть HTTP 200
```

---

## Проверка работы новых эндпоинтов

### На VPS (после развёртывания):

```bash
# Получить список курсов (нужен JWT токен куратора)
curl -X GET \
  "https://tma.n8nrgimprovise.space/api/admin/courses" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Должен вернуть:
# [{ "id": "...", "title": "Пирамида Минто", "modulesCount": 4, "learnersCount": X }]
```

### Через TMA:

1. Откройте TMA как куратор
2. Вкладка "Курсы" → должны увидеть курс "Пирамида Минто"
3. (В будущем здесь будут все курсы)

---

## Структура новой иерархии

### До:

```
CourseModule (index: 1, 2, 3, 4)
└── CourseStep[]
```

### После:

```
Course (Пирамида Минто)
└── CourseModule[] (index: 1, 2, 3, 4)
    └── CourseStep[]
```

---

## Новые файлы

**Backend:**
- `backend/src/course/courses.service.ts` — сервис для управления Course
- `backend/src/course/course-courses.controller.ts` — контроллер для API Course
- `backend/prisma/migrations/20251129200000_add_course_model/migration.sql` — миграция БД

**Обновлённые файлы:**
- `backend/prisma/schema.prisma` — добавлена модель Course
- `backend/prisma/seed.ts` — создание курса и привязка модулей
- `backend/src/course/course.module.ts` — регистрация нового сервиса и контроллера

---

## Откат изменений (если что-то пошло не так)

### Откат БД

```bash
cd /var/www/tma_education/backend

# Откат последней миграции
npx prisma migrate resolve --rolled-back 20251129200000_add_course_model

# Удалить данные Course вручную
sudo -u postgres psql -d minto_db -c "DROP TABLE IF EXISTS \"Course\" CASCADE;"
```

### Откат кода

```bash
cd /var/www/tma_education
git log --oneline -5  # Найти хеш предыдущего коммита
git checkout <previous-commit-hash>
cd backend
npm run build
pm2 restart minto-backend
```

---

## Troubleshooting

### Ошибка: "relation Course does not exist"

**Причина:** Миграция не применена

**Решение:**
```bash
cd /var/www/tma_education/backend
npx prisma migrate deploy
```

---

### Ошибка при seed: "Foreign key constraint failed"

**Причина:** Пытается создать модуль с несуществующим courseId

**Решение:**
1. Убедитесь, что курс создаётся до модулей в seed.ts
2. Проверьте, что переменная `mintoCourse.id` используется правильно

---

### Backend не стартует после изменений

**Причина:** Ошибка TypeScript или проблема с DI

**Решение:**
```bash
# Проверить логи
pm2 logs minto-backend --lines 100

# Пересобрать
cd /var/www/tma_education/backend
npm run build

# Если ошибки сборки — проверьте импорты в course.module.ts
```

---

**Версия:** 1.0  
**Дата:** 2025-11-29  
**Изменения:** Добавление сущности Course и иерархии Course → Module → Step

