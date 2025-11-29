# Исправление: Ошибка "Cannot GET /admin/courses"

## Проблема

При открытии TMA как куратор на вкладке "Курсы" и "Конструктор" появляется ошибка:

```
Cannot GET /admin/courses
```

## Причина

После добавления новых файлов:
- `backend/src/course/course-courses.controller.ts` (endpoint `GET /admin/courses`)
- `backend/src/course/courses.service.ts` (бизнес-логика для курсов)

Backend **не был пересобран** на VPS, поэтому эти endpoints отсутствуют в скомпилированном коде.

## Решение

### Автоматический способ:

```bash
ssh root@79.132.140.13
cd /var/www/tma_education
bash FIX_COURSES_ENDPOINT.sh
```

### Ручной способ:

```bash
ssh root@79.132.140.13
cd /var/www/tma_education

# 1. Получить последние изменения
git pull

# 2. Пересобрать backend
cd backend
npm run build

# 3. Перезапустить backend
pm2 restart minto-backend

# 4. Проверить логи
pm2 logs minto-backend --lines 20
```

## Проверка работы

### 1. Проверить что endpoint доступен:

```bash
curl -I https://tma.n8nrgimprovise.space/api/admin/courses
```

**Ожидаемый результат:**
```
HTTP/2 401  # (Unauthorized - нормально, т.к. нет токена)
```

**Если было:**
```
HTTP/2 404  # (Not Found - endpoint не существует)
```

### 2. Проверить в TMA:

1. Откройте бот в Telegram
2. Нажмите "Открыть учебное приложение"
3. Авторизуйтесь как куратор
4. Перейдите на вкладку **"Курсы"**
5. Вы должны увидеть:
   - Список курсов (например, "Пирамида Минто")
   - Кнопку "Создать курс"

6. Перейдите на вкладку **"Конструктор"**
7. Вы должны увидеть:
   - Заголовок "Конструктор курса"
   - Список курсов
   - Кнопку "Создать курс"

## Технические детали

### Добавленные файлы:

**1. CourseCoursesController**
```typescript
// backend/src/course/course-courses.controller.ts
@Controller('admin/courses')
export class CourseCoursesController {
  @Get()
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async findAllCourses() { ... }

  @Get(':id')
  @Roles(UserRole.CURATOR, UserRole.ADMIN)
  async findCourseById(@Param('id') id: string) { ... }

  @Post()
  @Roles(UserRole.ADMIN)
  async createCourse(@Body() dto: CreateCourseDto) { ... }
}
```

**2. CoursesService**
```typescript
// backend/src/course/courses.service.ts
@Injectable()
export class CoursesService {
  async findAllCourses() {
    // Возвращает список курсов с количеством модулей и участников
  }

  async findCourseById(id: string) {
    // Возвращает детали курса с модулями
  }

  async createCourse(dto: CreateCourseDto) {
    // Создаёт новый курс
  }
}
```

**3. Регистрация в CourseModule**
```typescript
// backend/src/course/course.module.ts
@Module({
  controllers: [
    CourseController,
    CourseAdminController,
    CourseBuilderController,
    CourseCoursesController, // ← Новый контроллер
  ],
  providers: [CourseService, CoursesService, CourseAdminService], // ← Новый сервис
  exports: [CourseService, CoursesService, CourseAdminService],
})
export class CourseModule {}
```

### Endpoints:

| Method | Path | Role | Описание |
|--------|------|------|----------|
| GET | `/admin/courses` | CURATOR, ADMIN | Список всех курсов |
| GET | `/admin/courses/:id` | CURATOR, ADMIN | Детали курса с модулями |
| POST | `/admin/courses` | ADMIN | Создать курс |

## Почему это случилось?

При развёртывании Шагов 1-4 (добавление `Course` entity, обновление TMA) мы:
1. ✅ Создали миграцию БД (`Course` модель)
2. ✅ Применили миграцию (`prisma migrate deploy`)
3. ✅ Обновили seed script
4. ✅ Создали новые файлы контроллера и сервиса
5. ❌ **НЕ пересобрали backend** (`npm run build`)
6. ✅ Пересобрали TMA (`npm run build`)

В результате TMA запрашивает `/admin/courses`, но backend не знает об этом endpoint, потому что TypeScript файлы не были скомпилированы в JavaScript.

## Профилактика

В будущем, при добавлении новых контроллеров/сервисов в backend, **всегда** выполняйте:

```bash
cd backend
npm run build
pm2 restart minto-backend
```

Или используйте автоматический скрипт развёртывания, который включает этот шаг.

---

**Версия:** 1.0  
**Дата:** 2025-11-29  
**Проблема:** Отсутствует `/admin/courses` endpoint  
**Решение:** Пересборка backend

