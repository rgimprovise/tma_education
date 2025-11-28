# Prisma Database Setup

## Настройка базы данных

### 1. Создайте файл `.env` в корне `/backend`

Скопируйте `.env.example` и заполните переменные:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/minto_db"
```

### 2. Создайте базу данных PostgreSQL

```bash
# Если используете локальный PostgreSQL
createdb minto_db

# Или через psql
psql -U postgres
CREATE DATABASE minto_db;
```

### 3. Запустите миграции

```bash
# Генерация Prisma Client и создание миграции
npm run prisma:migrate

# Или по отдельности:
npx prisma migrate dev --name init
```

### 4. (Опционально) Заполните начальные данные

После создания миграции можно заполнить структуру курса через seed или вручную через Prisma Studio:

```bash
npm run prisma:studio
```

## Полезные команды

```bash
# Генерация Prisma Client
npm run prisma:generate

# Создание новой миграции
npm run prisma:migrate

# Открыть Prisma Studio (GUI для БД)
npm run prisma:studio

# Сброс БД (осторожно! удаляет все данные)
npx prisma migrate reset

# Применить миграции в production
npx prisma migrate deploy
```

## Структура моделей

- **User** - Пользователи системы (LEARNER, CURATOR, ADMIN)
- **CourseModule** - Модули курса (1-3 + экзамен)
- **CourseStep** - Шаги/задания внутри модулей
- **Enrollment** - Прогресс пользователя по модулям
- **Submission** - Сдачи заданий с оценками ИИ и куратора

Подробнее см. `schema.prisma`

