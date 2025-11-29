# Развёртывание: Шаг 3 - Конструктор с иерархией Course

## Обзор изменений

Обновлён "Конструктор курса" для работы с иерархией **Course → Module → Step**:
- Вкладка "Конструктор" теперь начинается с выбора курса
- Модули создаются внутри конкретного курса (с привязкой `courseId`)
- Обновлён backend для поддержки `courseId` при создании модулей

---

## Изменения в Backend

### 1. DTO: CreateModuleDto

**Файл:** `backend/src/course/dto/create-module.dto.ts`

**Изменения:**
```typescript
export class CreateModuleDto {
  @IsString()
  @IsOptional()
  courseId?: string; // Новое поле - ID курса

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  index: number;

  @IsBoolean()
  @IsOptional()
  isExam?: boolean;
}
```

---

### 2. Service: CourseAdminService.createModule()

**Файл:** `backend/src/course/course-admin.service.ts`

**Изменения:**
```typescript
async createModule(dto: CreateModuleDto) {
  // Проверяем, не занят ли индекс
  const existing = await this.prisma.courseModule.findUnique({
    where: { index: dto.index },
  });

  if (existing) {
    throw new ConflictException(`Module with index ${dto.index} already exists`);
  }

  // Если указан courseId, проверяем что курс существует
  if (dto.courseId) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with id ${dto.courseId} not found`);
    }
  }

  return this.prisma.courseModule.create({
    data: {
      courseId: dto.courseId, // Привязка к курсу (может быть undefined)
      title: dto.title,
      description: dto.description,
      index: dto.index,
      isExam: dto.isExam || false,
    },
  });
}
```

**Поведение:**
- `courseId` опционален (для обратной совместимости)
- Если `courseId` указан → проверяется существование курса
- Модуль создаётся с привязкой к курсу

---

## Изменения в TMA

### 1. Новая страница: CourseBuilderCoursesPage

**Маршрут:** `/curator/course-builder`

**Файлы:**
- `tma/src/pages/CourseBuilder/CourseBuilderCoursesPage.tsx`
- `tma/src/pages/CourseBuilder/CourseBuilderCoursesPage.css`

**Функционал:**
- Заголовок: "🔧 Конструктор курса"
- Подзаголовок: "Выберите курс, чтобы управлять модулями и заданиями"
- Использует `GET /admin/courses` для загрузки курсов
- Карточки курсов с:
  - Названием и описанием
  - Статистикой (модули, участники)
  - Бейджем "🔧 Режим редактирования"
- Клик по курсу → `/curator/course-builder/:courseId`

**UI особенности:**
- Gradient top border на карточках (primary → warning)
- Hover эффекты с подсветкой
- Empty state: "Создайте первый курс на вкладке «Курсы»"

---

### 2. Новая страница: CourseBuilderModulesPage

**Маршрут:** `/curator/course-builder/:courseId`

**Файлы:**
- `tma/src/pages/CourseBuilder/CourseBuilderModulesPage.tsx`
- `tma/src/pages/CourseBuilder/CourseBuilderModulesPage.css`

**Функционал:**
- Загружает курс: `GET /admin/courses/:courseId`
- Загружает модули: `GET /admin/course/modules` (фильтр по courseId)
- Заголовок с названием курса + бейдж "Конструктор"
- Кнопка **"Добавить модуль"**:
  - Навигация: `/curator/course/modules/new?courseId={courseId}`
  - При создании модуль привязывается к курсу
- Список модулей:
  - Индекс, название, описание
  - Количество шагов
  - Бейдж "🎓 Экзамен" для exam-модулей
  - Кнопка удаления
- Клик по модулю → `/curator/course/modules/:moduleId` (редактор)

**UI особенности:**
- Left gradient border на карточках модулей
- Header с gradient background
- Builder mode badge с градиентом

---

### 3. Обновлена страница: CourseModuleEditorPage

**Изменения:**
```typescript
const [searchParams] = useSearchParams();
const courseId = searchParams.get('courseId') || undefined;

const [formData, setFormData] = useState<ModuleData>({
  courseId, // Читаем из query params
  title: '',
  description: '',
  index: 1,
  isExam: false,
});

// При сохранении
if (isNew) {
  await api.post('/admin/course/modules', formData); // courseId передаётся
}

// После сохранения редирект
if (courseId) {
  navigate(`/curator/course-builder/${courseId}`); // Возврат к модулям курса
} else {
  navigate('/curator/course-builder'); // Возврат к списку курсов
}
```

**Поведение:**
- Если открыт с `?courseId=...` → модуль создаётся с привязкой к курсу
- После сохранения редирект на правильную страницу

---

### 4. Обновлён роутинг: App.tsx

**Новые маршруты:**
```tsx
<Route
  path="/curator/course-builder"
  element={<CourseBuilderCoursesPage />}
/>

<Route
  path="/curator/course-builder/:courseId"
  element={<CourseBuilderModulesPage />}
/>
```

**Старые маршруты сохранены для обратной совместимости:**
```tsx
<Route path="/curator/course" element={<CourseBuilderPage />} />
<Route path="/curator/course/modules/new" element={<CourseModuleEditorPage />} />
<Route path="/curator/course/modules/:moduleId" element={<CourseModuleEditorPage />} />
// ...
```

---

### 5. Обновлена навигация: CuratorTabBar

**Изменения:**
```typescript
{
  id: 'builder',
  label: '🔧 Конструктор',
  path: '/curator/course-builder', // Изменён путь
  matcher: /^\/curator\/course-builder|^\/curator\/course/, // Обновлён matcher
}
```

**Поведение:**
- Клик на "Конструктор" → `/curator/course-builder`
- Tab активен на всех страницах `/curator/course-builder/*` и `/curator/course/*`

---

## Развёртывание на VPS

### Шаг 1: Подключение к VPS

```bash
ssh root@79.132.140.13
cd /var/www/tma_education
```

### Шаг 2: Получить обновления

```bash
git pull
```

**Ожидаемый вывод:**
```
Updating b7a6c34..439b738
Fast-forward
 backend/src/course/course-admin.service.ts        | ...
 backend/src/course/dto/create-module.dto.ts       | ...
 tma/src/App.tsx                                   | ...
 tma/src/components/CuratorTabBar.tsx              | ...
 tma/src/pages/CourseBuilder/CourseBuilderCoursesPage.css | ...
 tma/src/pages/CourseBuilder/CourseBuilderCoursesPage.tsx | ...
 tma/src/pages/CourseBuilder/CourseBuilderModulesPage.css | ...
 tma/src/pages/CourseBuilder/CourseBuilderModulesPage.tsx | ...
 tma/src/pages/CourseModuleEditorPage.tsx          | ...
 9 files changed, 827 insertions(+), 4 deletions(-)
```

### Шаг 3: Пересобрать backend

```bash
cd backend
npm run build
```

### Шаг 4: Перезапустить backend

```bash
pm2 restart minto-backend
```

### Шаг 5: Пересобрать TMA

```bash
cd ../tma
npm run build
```

### Шаг 6: Проверить статус

```bash
pm2 status
pm2 logs minto-backend --lines 30
```

### Шаг 7: Проверить работу

**В браузере:**
1. Откройте TMA как куратор/администратор
2. Перейдите на вкладку **"🔧 Конструктор"**
3. Вы должны увидеть список курсов
4. Кликните на курс "Пирамида Минто"
5. Откроется страница с модулями этого курса
6. Кнопка "Добавить модуль" должна создавать модуль с привязкой к курсу

---

## Проверка функциональности

### 1. Создание модуля с courseId

```bash
curl -X POST \
  "https://tma.n8nrgimprovise.space/api/admin/course/modules" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "COURSE_ID",
    "title": "Новый модуль",
    "description": "Описание",
    "index": 5,
    "isExam": false
  }'
```

**Ожидаемый ответ:**
```json
{
  "id": "cm4xxx...",
  "courseId": "COURSE_ID",
  "title": "Новый модуль",
  "description": "Описание",
  "index": 5,
  "isExam": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### 2. Проверка привязки модулей к курсу

```bash
# В PostgreSQL
sudo -u postgres psql -d minto_db

# Запрос
SELECT id, title, "courseId", index
FROM "CourseModule"
ORDER BY index;

# Ожидаемый результат: модули 1-4 должны иметь courseId
```

---

## Навигация в конструкторе

### Для куратора/администратора:

```
Вкладка "🔧 Конструктор"
  ↓
/curator/course-builder (список курсов)
  ↓ клик на "Пирамида Минто"
/curator/course-builder/:courseId (модули курса)
  ↓ кнопка "Добавить модуль"
/curator/course/modules/new?courseId=:courseId (создание с привязкой)
  ↓ сохранение
Назад к /curator/course-builder/:courseId
  ↓ клик на модуль
/curator/course/modules/:moduleId (редактор модуля)
  ↓ кнопка "Управлять шагами"
/curator/course/modules/:moduleId/steps (шаги модуля)
  ↓ клик на шаг
/curator/course/steps/:stepId (редактор шага)
```

---

## Обратная совместимость

**Старые маршруты сохранены:**
- `/curator/course` → показывает все модули (старый конструктор)
- `/curator/course/modules/new` → создание модуля без courseId
- `/curator/course/modules/:moduleId` → редактор модуля

**Новый подход (рекомендуемый):**
- `/curator/course-builder` → выбор курса
- `/curator/course-builder/:courseId` → модули курса
- `/curator/course/modules/new?courseId=XXX` → создание с привязкой

---

## Troubleshooting

### Ошибка: "Course with id XXX not found"

**Причина:** Неверный `courseId` при создании модуля

**Решение:**
1. Проверьте ID курса:
   ```bash
   sudo -u postgres psql -d minto_db -c "SELECT id, title FROM \"Course\";"
   ```
2. Используйте корректный ID

---

### Модули не отображаются в конструкторе

**Причина:** Модули не привязаны к курсу (`courseId = null`)

**Решение:**
1. Проверьте привязку:
   ```bash
   sudo -u postgres psql -d minto_db -c \
     "SELECT id, title, \"courseId\" FROM \"CourseModule\";"
   ```
2. Привяжите модули вручную:
   ```sql
   UPDATE "CourseModule"
   SET "courseId" = 'COURSE_ID'
   WHERE index IN (1, 2, 3, 4) AND "courseId" IS NULL;
   ```

---

### TMA не обновляется после git pull

**Причина:** Старый билд

**Решение:**
```bash
cd /var/www/tma_education/tma
rm -rf dist
npm run build
```

---

## Откат изменений (если что-то пошло не так)

```bash
cd /var/www/tma_education
git log --oneline -5  # Найти хеш предыдущего коммита
git checkout <previous-commit-hash>

# Пересобрать
cd backend
npm run build
pm2 restart minto-backend

cd ../tma
npm run build
```

---

**Версия:** 3.0  
**Дата:** 2025-11-29  
**Изменения:** Конструктор обновлён для иерархии Course → Module → Step

