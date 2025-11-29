# Развёртывание: TMA иерархия Курсы → Модули

## Обзор изменений

Обновлён интерфейс TMA для кураторов/администраторов:
- Вкладка **"Курсы"** теперь показывает список курсов (Course), а не модули
- При клике на курс открывается дашборд курса с его модулями
- Добавлена форма создания новых курсов

---

## Изменения в TMA

### 1. CuratorCoursesDashboardPage (список курсов)

**Маршрут:** `/curator/courses`

**Изменения:**
- Использует `GET /admin/courses` вместо `GET /admin/course/modules`
- Отображает **курсы** с информацией:
  - Название и описание курса
  - Количество модулей
  - Количество участников
- Добавлена кнопка **"Создать курс"**
- Модальная форма для создания курса (title + description)
- После создания редирект на дашборд нового курса

---

### 2. CourseDashboardPage (модули курса)

**Маршрут:** `/curator/courses/:courseId` (параметр изменён с `:moduleId` на `:courseId`)

**Изменения:**
- Использует `GET /admin/courses/:courseId` 
- Отображает информацию о курсе:
  - Название и описание
  - Статистика: количество модулей, шагов, участников
- Список модулей курса в виде карточек:
  - Название, описание, индекс модуля
  - Количество шагов и участников
  - Бейдж "Экзамен" для экзаменационных модулей
- Кнопка **"Добавить модуль"** для создания модулей в курсе
- Клик по модулю → переход к редактору модуля

---

### 3. Роутинг

**Обновлены маршруты:**
```tsx
/curator/courses              → CuratorCoursesDashboardPage (список курсов)
/curator/courses/:courseId    → CourseDashboardPage (модули курса)
```

**Удалён маршрут:**
```tsx
/curator/courses/:moduleId/learners  → (больше не нужен, используем /curator)
```

---

### 4. UI/UX улучшения

**Новые компоненты:**
- Модальное окно создания курса с полями:
  - Название курса (required)
  - Описание курса (optional)
  - Кнопки "Отмена" / "Создать"

**Стили:**
- Унифицированные карточки курсов и модулей
- Hover-эффекты с подсветкой border
- Responsive grid layout
- Empty states для курсов и модулей

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
remote: Enumerating objects: ...
Updating 57c8791..3e54372
Fast-forward
 tma/src/App.tsx                                    | ...
 tma/src/pages/curator/CourseDashboardPage.css      | ...
 tma/src/pages/curator/CourseDashboardPage.tsx      | ...
 tma/src/pages/curator/CuratorCoursesDashboardPage.css | ...
 tma/src/pages/curator/CuratorCoursesDashboardPage.tsx | ...
 5 files changed, 473 insertions(+), 351 deletions(-)
```

### Шаг 3: Пересобрать TMA

```bash
cd tma
npm run build
```

**Ожидаемый вывод:**
```
> minto-tma@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 120+ modules transformed.
dist/index.html                   0.XX kB │ gzip:  ...
dist/assets/index-XXXXX.css       XX.XX kB │ gzip:  ...
dist/assets/index-XXXXX.js        XXX.XX kB │ gzip:  ...
✓ built in X.XXs
```

### Шаг 4: Перезапустить Caddy (если нужно)

```bash
sudo systemctl reload caddy
# или
sudo systemctl restart caddy
```

### Шаг 5: Проверить работу

```bash
# Проверить доступность TMA
curl -I https://tma.n8nrgimprovise.space

# Должен вернуть HTTP/2 200
```

**В браузере:**
1. Откройте TMA как куратор/администратор
2. Вы должны увидеть вкладку **"Курсы"**
3. На странице должен быть курс **"Пирамида Минто"**
4. При клике на курс откроется его дашборд с модулями (1, 2, 3, Экзамен)

---

## Проверка функциональности

### 1. Список курсов (GET /admin/courses)

```bash
curl -X GET \
  "https://tma.n8nrgimprovise.space/api/admin/courses" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Ожидаемый ответ:**
```json
[
  {
    "id": "cm4xxx...",
    "title": "Пирамида Минто",
    "description": "Полный курс...",
    "modulesCount": 4,
    "learnersCount": 5,
    "createdAt": "2025-11-29T...",
    "updatedAt": "2025-11-29T..."
  }
]
```

---

### 2. Детали курса (GET /admin/courses/:courseId)

```bash
curl -X GET \
  "https://tma.n8nrgimprovise.space/api/admin/courses/COURSE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Ожидаемый ответ:**
```json
{
  "id": "cm4xxx...",
  "title": "Пирамида Минто",
  "description": "Полный курс...",
  "createdAt": "...",
  "updatedAt": "...",
  "modules": [
    {
      "id": "cm4xxx...",
      "index": 1,
      "title": "Модуль 1: Введение...",
      "description": "...",
      "isExam": false,
      "stepsCount": 6,
      "enrollmentsCount": 5
    },
    ...
  ]
}
```

---

### 3. Создание курса (POST /admin/courses)

```bash
curl -X POST \
  "https://tma.n8nrgimprovise.space/api/admin/courses" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Новый курс",
    "description": "Описание курса"
  }'
```

**Ожидаемый ответ:**
```json
{
  "id": "cm4xxx...",
  "title": "Новый курс",
  "description": "Описание курса",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Навигация в TMA

### Для куратора/администратора:

**Вкладка "Курсы" (по умолчанию):**
```
/curator/courses
  ↓ клик на курс "Пирамида Минто"
/curator/courses/:courseId
  ↓ список модулей: 1, 2, 3, Экзамен
  ↓ клик на "Модуль 1"
/curator/course/modules/:moduleId  (редактор модуля - старая страница)
```

**Вкладка "Ученики":**
```
/curator
  ↓ список учеников
```

**Вкладка "Конструктор":**
```
/curator/course  (модули)
/curator/course/modules/:moduleId  (редактор модуля)
/curator/course/modules/:moduleId/steps  (шаги модуля)
...
```

---

## Создание нового курса (через TMA)

1. Войдите в TMA как куратор/администратор
2. Перейдите на вкладку **"Курсы"**
3. Нажмите кнопку **"➕ Создать курс"**
4. Заполните форму:
   - Название курса (обязательно)
   - Описание курса (опционально)
5. Нажмите **"Создать"**
6. Вы будете перенаправлены на дашборд нового курса
7. Там можно добавить модули

---

## Troubleshooting

### Ошибка: "Course not found"

**Причина:** Неверный `courseId` или курс удалён из БД

**Решение:**
1. Проверьте, что курс существует:
   ```bash
   sudo -u postgres psql -d minto_db -c "SELECT id, title FROM \"Course\";"
   ```
2. Используйте корректный `courseId`

---

### Ошибка: "No courses" на странице

**Причина:** В БД нет ни одного курса

**Решение:**
1. Пересоздайте данные через seed:
   ```bash
   cd /var/www/tma_education/backend
   npx prisma db seed
   ```
2. Или создайте курс через API:
   ```bash
   curl -X POST https://tma.n8nrgimprovise.space/api/admin/courses \
     -H "Authorization: Bearer JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title": "Пирамида Минто", "description": "..."}'
   ```

---

### TMA не обновляется после git pull

**Причина:** Старый билд в `/tma/dist`

**Решение:**
```bash
cd /var/www/tma_education/tma
rm -rf dist
npm run build
```

---

### Модули не отображаются в курсе

**Причина:** Модули не привязаны к курсу (`courseId = null`)

**Решение:**
1. Проверьте связь:
   ```bash
   sudo -u postgres psql -d minto_db -c \
     "SELECT id, title, \"courseId\" FROM \"CourseModule\";"
   ```
2. Привяжите модули к курсу:
   ```sql
   UPDATE "CourseModule"
   SET "courseId" = 'COURSE_ID'
   WHERE index IN (1, 2, 3, 4);
   ```

---

## Откат изменений (если что-то пошло не так)

```bash
cd /var/www/tma_education
git log --oneline -5  # Найти хеш предыдущего коммита
git checkout <previous-commit-hash>

cd tma
npm run build

# Перезагрузить Caddy
sudo systemctl reload caddy
```

---

**Версия:** 2.0  
**Дата:** 2025-11-29  
**Изменения:** TMA перестроено для иерархии Курсы → Модули

