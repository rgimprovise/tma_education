# Команды для просмотра базы данных на VPS

## 🔌 Подключение к базе данных

### 1. Получить DATABASE_URL из .env

```bash
cd /var/www/tma_education/backend
cat .env | grep DATABASE_URL
```

Пример вывода:
```
DATABASE_URL="postgresql://minto_user:135246@localhost:5432/minto_db"
```

### 2. Подключение через psql

```bash
# Если база данных на том же сервере
psql -U minto_user -d minto_db

# Или с указанием хоста и порта
psql -h localhost -p 5432 -U minto_user -d minto_db

# Если нужен пароль (введите при запросе)
psql postgresql://minto_user:135246@localhost:5432/minto_db
```

### 3. Альтернатива: через Prisma Studio (веб-интерфейс)

```bash
cd /var/www/tma_education/backend
npx prisma studio
# Откроется на http://localhost:5555
# Для доступа с другого компьютера используйте SSH туннель:
# ssh -L 5555:localhost:5555 user@your-vps-ip
```

---

## 📊 Основные команды для просмотра данных

### Список всех таблиц

```sql
-- В psql
\dt

-- Или через SQL
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Структура таблицы (колонки и типы)

```sql
-- Для конкретной таблицы
\d "User"

-- Или через SQL
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'User'
ORDER BY ordinal_position;
```

### Количество записей в каждой таблице

```sql
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

---

## 👥 Просмотр пользователей (User)

### Все пользователи

```sql
SELECT 
    id,
    "telegramId",
    "firstName",
    "lastName",
    position,
    role,
    "profileCompleted",
    "createdAt"
FROM "User"
ORDER BY "createdAt" DESC;
```

### Пользователи с их ролью

```sql
SELECT 
    "firstName" || ' ' || "lastName" as name,
    role,
    position,
    "profileCompleted",
    "createdAt"
FROM "User"
ORDER BY role, "createdAt" DESC;
```

### Статистика по ролям

```sql
SELECT 
    role,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE "profileCompleted" = true) as completed_profiles
FROM "User"
GROUP BY role;
```

### Кураторы

```sql
SELECT 
    id,
    "telegramId",
    "firstName",
    "lastName",
    position
FROM "User"
WHERE role = 'CURATOR';
```

---

## 📚 Просмотр курсов и модулей

### Все курсы

```sql
SELECT 
    id,
    title,
    description,
    "createdAt"
FROM "Course"
ORDER BY "createdAt" DESC;
```

### Все модули с курсами

```sql
SELECT 
    cm.id,
    cm.index,
    cm.title,
    cm."isExam",
    cm."autoUnlockForNewLearners",
    c.title as course_title,
    cm."createdAt"
FROM "CourseModule" cm
LEFT JOIN "Course" c ON cm."courseId" = c.id
ORDER BY cm.index;
```

### Шаги модулей

```sql
SELECT 
    cs.id,
    cs.index as step_index,
    cs.type,
    cs.title,
    cs."requiresAiReview",
    cs."expectedAnswer",
    cs."maxScore",
    cm.title as module_title,
    cm.index as module_index
FROM "CourseStep" cs
JOIN "CourseModule" cm ON cs."moduleId" = cm.id
ORDER BY cm.index, cs.index;
```

### Шаги с AI-проверкой

```sql
SELECT 
    cs.title as step_title,
    cm.title as module_title,
    cs."aiRubric",
    cs."maxScore"
FROM "CourseStep" cs
JOIN "CourseModule" cm ON cs."moduleId" = cm.id
WHERE cs."requiresAiReview" = true
ORDER BY cm.index, cs.index;
```

---

## 📝 Просмотр сдач (Submissions)

### Все сдачи с информацией о пользователе и задании

```sql
SELECT 
    s.id,
    u."firstName" || ' ' || u."lastName" as student_name,
    cm.title as module_title,
    cs.title as step_title,
    s."answerType",
    s.status,
    s."aiScore",
    s."curatorScore",
    s."createdAt"
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
JOIN "CourseModule" cm ON s."moduleId" = cm.id
JOIN "CourseStep" cs ON s."stepId" = cs.id
ORDER BY s."createdAt" DESC
LIMIT 50;
```

### Сдачи по статусу

```sql
SELECT 
    status,
    COUNT(*) as count
FROM "Submission"
GROUP BY status
ORDER BY count DESC;
```

### Сдачи на проверке у куратора

```sql
SELECT 
    s.id,
    u."firstName" || ' ' || u."lastName" as student_name,
    cm.title as module_title,
    cs.title as step_title,
    s."aiScore",
    s."aiFeedback",
    s."createdAt"
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
JOIN "CourseModule" cm ON s."moduleId" = cm.id
JOIN "CourseStep" cs ON s."stepId" = cs.id
WHERE s.status IN ('SENT', 'AI_REVIEWED')
ORDER BY s."createdAt" DESC;
```

### Сдачи с аудио/видео ответами

```sql
SELECT 
    s.id,
    u."firstName" || ' ' || u."lastName" as student_name,
    cs.title as step_title,
    s."answerType",
    s."answerFileId",
    s.status,
    s."createdAt"
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
JOIN "CourseStep" cs ON s."stepId" = cs.id
WHERE s."answerType" IN ('AUDIO', 'VIDEO')
ORDER BY s."createdAt" DESC;
```

### Сдачи без файлов (проблемные)

```sql
SELECT 
    s.id,
    u."firstName" || ' ' || u."lastName" as student_name,
    cs.title as step_title,
    s."answerType",
    s."answerFileId",
    s.status,
    s."createdAt"
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
JOIN "CourseStep" cs ON s."stepId" = cs.id
WHERE s."answerType" IN ('AUDIO', 'VIDEO') 
  AND s."answerFileId" IS NULL
ORDER BY s."createdAt" DESC;
```

---

## 📈 Просмотр прогресса (Enrollments)

### Прогресс всех учеников по модулям

```sql
SELECT 
    u."firstName" || ' ' || u."lastName" as student_name,
    cm.title as module_title,
    cm.index as module_index,
    e.status,
    e."unlockedAt",
    e."completedAt"
FROM "Enrollment" e
JOIN "User" u ON e."userId" = u.id
JOIN "CourseModule" cm ON e."moduleId" = cm.id
ORDER BY u."lastName", cm.index;
```

### Статистика по модулям

```sql
SELECT 
    cm.title as module_title,
    COUNT(*) as total_enrollments,
    COUNT(*) FILTER (WHERE e.status = 'LOCKED') as locked,
    COUNT(*) FILTER (WHERE e.status = 'IN_PROGRESS') as in_progress,
    COUNT(*) FILTER (WHERE e.status = 'COMPLETED') as completed
FROM "Enrollment" e
JOIN "CourseModule" cm ON e."moduleId" = cm.id
GROUP BY cm.id, cm.title, cm.index
ORDER BY cm.index;
```

### Модули, открытые кураторами

```sql
SELECT 
    u."firstName" || ' ' || u."lastName" as student_name,
    cm.title as module_title,
    curator."firstName" || ' ' || curator."lastName" as unlocked_by,
    e."unlockedAt"
FROM "Enrollment" e
JOIN "User" u ON e."userId" = u.id
JOIN "CourseModule" cm ON e."moduleId" = cm.id
LEFT JOIN "User" curator ON e."unlockedById" = curator.id
WHERE e."unlockedById" IS NOT NULL
ORDER BY e."unlockedAt" DESC;
```

---

## 📋 История сдач (SubmissionHistory)

### История возвратов на доработку

```sql
SELECT 
    sh.id,
    u."firstName" || ' ' || u."lastName" as student_name,
    cs.title as step_title,
    sh.reason,
    sh."curatorFeedback",
    sh."createdAt"
FROM "SubmissionHistory" sh
JOIN "Submission" s ON sh."submissionId" = s.id
JOIN "User" u ON s."userId" = u.id
JOIN "CourseStep" cs ON s."stepId" = cs.id
WHERE sh.reason = 'RETURNED'
ORDER BY sh."createdAt" DESC;
```

---

## 🔍 Полезные запросы для анализа

### Топ учеников по среднему баллу

```sql
SELECT 
    u."firstName" || ' ' || u."lastName" as student_name,
    COUNT(s.id) as submissions_count,
    ROUND(AVG(COALESCE(s."curatorScore", s."aiScore")), 2) as avg_score,
    MAX(COALESCE(s."curatorScore", s."aiScore")) as max_score
FROM "User" u
JOIN "Submission" s ON u.id = s."userId"
WHERE s.status = 'CURATOR_APPROVED'
GROUP BY u.id, u."firstName", u."lastName"
HAVING COUNT(s.id) > 0
ORDER BY avg_score DESC
LIMIT 20;
```

### Статистика по заданиям

```sql
SELECT 
    cs.title as step_title,
    cm.title as module_title,
    COUNT(s.id) as submissions_count,
    COUNT(s.id) FILTER (WHERE s.status = 'CURATOR_APPROVED') as approved,
    COUNT(s.id) FILTER (WHERE s.status = 'CURATOR_RETURNED') as returned,
    ROUND(AVG(COALESCE(s."curatorScore", s."aiScore")), 2) as avg_score
FROM "CourseStep" cs
JOIN "CourseModule" cm ON cs."moduleId" = cm.id
LEFT JOIN "Submission" s ON cs.id = s."stepId"
GROUP BY cs.id, cs.title, cm.title, cm.index
ORDER BY cm.index, cs.index;
```

### Сдачи за последние 7 дней

```sql
SELECT 
    DATE(s."createdAt") as date,
    COUNT(*) as submissions_count,
    COUNT(*) FILTER (WHERE s.status = 'CURATOR_APPROVED') as approved
FROM "Submission" s
WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE(s."createdAt")
ORDER BY date DESC;
```

### Ученики с проблемами (низкие оценки или возвраты)

```sql
SELECT 
    u."firstName" || ' ' || u."lastName" as student_name,
    COUNT(s.id) FILTER (WHERE s.status = 'CURATOR_RETURNED') as returned_count,
    COUNT(s.id) FILTER (WHERE COALESCE(s."curatorScore", s."aiScore", 0) < 5) as low_scores,
    ROUND(AVG(COALESCE(s."curatorScore", s."aiScore")), 2) as avg_score
FROM "User" u
JOIN "Submission" s ON u.id = s."userId"
WHERE u.role = 'LEARNER'
GROUP BY u.id, u."firstName", u."lastName"
HAVING COUNT(s.id) FILTER (WHERE s.status = 'CURATOR_RETURNED') > 0
    OR COUNT(s.id) FILTER (WHERE COALESCE(s."curatorScore", s."aiScore", 0) < 5) > 0
ORDER BY returned_count DESC, avg_score ASC;
```

---

## 💾 Экспорт данных

### Экспорт в CSV через psql

```bash
# Экспорт пользователей
psql -U minto_user -d minto_db -c "COPY (SELECT * FROM \"User\") TO STDOUT WITH CSV HEADER" > users.csv

# Экспорт сдач
psql -U minto_user -d minto_db -c "COPY (SELECT s.*, u.\"firstName\", u.\"lastName\" FROM \"Submission\" s JOIN \"User\" u ON s.\"userId\" = u.id) TO STDOUT WITH CSV HEADER" > submissions.csv
```

### Экспорт через SQL в файл

```sql
-- В psql
\copy (SELECT * FROM "User") TO '/tmp/users.csv' WITH CSV HEADER;
```

---

## 🛠️ Полезные команды psql

```sql
-- Выйти из psql
\q

-- Показать все базы данных
\l

-- Подключиться к другой базе
\c database_name

-- Показать все таблицы
\dt

-- Показать структуру таблицы
\d table_name

-- Показать индексы
\di

-- Показать размер таблицы
SELECT pg_size_pretty(pg_total_relation_size('"User"'));

-- Показать размер всех таблиц
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Показать последние запросы (если включен pg_stat_statements)
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

---

## ⚠️ Важные замечания

1. **Имена таблиц в кавычках**: Prisma создает таблицы с заглавными буквами, поэтому используйте `"User"` вместо `user`

2. **Бэкап перед изменениями**: Перед любыми изменениями данных сделайте бэкап:
   ```bash
   pg_dump -U minto_user -d minto_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Только чтение**: Эти команды предназначены для просмотра данных. Для изменений используйте Prisma миграции или API

4. **Производительность**: Для больших таблиц используйте `LIMIT` в запросах

---

## 📞 Быстрый доступ

### Самые частые команды:

```bash
# Подключение
cd /var/www/tma_education/backend
psql $(grep DATABASE_URL .env | cut -d '=' -f2 | tr -d '"')

# Или через Prisma Studio (веб-интерфейс)
npx prisma studio
```

