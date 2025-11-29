# Развёртывание: Управление доступом к модулям (Unlock Feature)

## Обзор изменений

Добавлена возможность для кураторов открывать модули для учеников через TMA:
- Куратор может открыть модуль для всех зарегистрированных учеников одной кнопкой
- Backend обновлён для поддержки флага `forAll`
- TMA: кнопка "🔓 Открыть для всех" на каждом модуле

---

## Изменения в Backend

### 1. DTO: UnlockModuleDto

**Файл:** `backend/src/course/dto/unlock-module.dto.ts`

**Добавлено поле:**
```typescript
@IsBoolean()
@IsOptional()
@ValidateIf((o) => !o.userIds || o.userIds.length === 0)
forAll?: boolean; // Открыть для всех зарегистрированных учеников
```

**Доступные опции:**
- `userIds: string[]` — открыть для конкретных пользователей
- `allCompletedPrevious: boolean` — для тех, кто завершил предыдущий модуль
- `forAll: boolean` — для всех зарегистрированных учеников (**NEW**)

---

### 2. Controller: CourseAdminController

**Файл:** `backend/src/course/admin.controller.ts`

**Обновлён метод:**
```typescript
@Post(':moduleId/unlock')
@Roles(UserRole.CURATOR, UserRole.ADMIN)
async unlockModule(
  @Param('moduleId') moduleId: string,
  @Body() dto: UnlockModuleDto,
  @Request() req,
) {
  return this.courseService.unlockModuleForUsers(
    moduleId,
    dto.userIds || [],
    dto.allCompletedPrevious || false,
    dto.forAll || false, // Новый параметр
    req.user.id,
  );
}
```

---

### 3. Service: CourseService.unlockModuleForUsers()

**Файл:** `backend/src/course/course.service.ts`

**Обновлена сигнатура:**
```typescript
async unlockModuleForUsers(
  moduleId: string,
  userIds: string[],
  allCompletedPrevious: boolean,
  forAll: boolean, // Новый параметр
  curatorId: string,
): Promise<{ unlocked: number; message: string }>
```

**Логика выбора пользователей (приоритет):**
```typescript
if (forAll) {
  // 1. Приоритет: forAll = true
  const allLearners = await this.prisma.user.findMany({
    where: { role: 'LEARNER' },
    select: { id: true },
  });
  targetUserIds = allLearners.map((u) => u.id);
} else if (allCompletedPrevious) {
  // 2. Приоритет: завершившие предыдущий модуль
  // ... (логика поиска)
} else {
  // 3. Приоритет: конкретные userIds
  targetUserIds = userIds;
}
```

**Для каждого пользователя создаётся/обновляется Enrollment:**
```typescript
{
  userId,
  moduleId,
  status: 'IN_PROGRESS',
  unlockedById: curatorId,
  unlockedAt: new Date(),
}
```

---

## Изменения в TMA

### CourseDashboardPage

**Файл:** `tma/src/pages/curator/CourseDashboardPage.tsx`

**Новое состояние:**
```typescript
const [unlockingModuleId, setUnlockingModuleId] = useState<string | null>(null);
```

**Новый метод:**
```typescript
const handleUnlockModule = async (moduleId: string, e: React.MouseEvent) => {
  e.stopPropagation(); // Не открывать карточку модуля

  if (!confirm('Открыть этот модуль для всех зарегистрированных учеников?')) {
    return;
  }

  try {
    setUnlockingModuleId(moduleId);
    const response = await api.post(`/admin/modules/${moduleId}/unlock`, {
      forAll: true,
    });

    alert(response.data.message || `Модуль открыт для ${response.data.unlocked} учеников`);
    
    // Обновляем данные курса
    await loadCourseData();
  } catch (err: any) {
    console.error('Failed to unlock module:', err);
    alert(err.response?.data?.message || 'Ошибка при открытии модуля');
  } finally {
    setUnlockingModuleId(null);
  }
};
```

**Обновлённая структура карточки модуля:**
```tsx
<div className="module-card">
  {/* Кликабельная область */}
  <div className="module-card-content" onClick={() => handleModuleClick(module.id)}>
    {/* Header, description, stats */}
  </div>
  
  {/* Секция действий */}
  <div className="module-card-actions">
    <button
      className="btn-unlock"
      onClick={(e) => handleUnlockModule(module.id, e)}
      disabled={unlockingModuleId === module.id}
    >
      {unlockingModuleId === module.id ? '🔄 Открываю...' : '🔓 Открыть для всех'}
    </button>
  </div>
</div>
```

---

### Стили

**Файл:** `tma/src/pages/curator/CourseDashboardPage.css`

**Новые стили:**
```css
.module-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.module-card-content {
  padding: 20px;
  cursor: pointer;
  flex: 1;
}

.module-card-content:hover {
  background: var(--color-primary-soft);
}

.module-card-actions {
  padding: 12px 20px;
  background: var(--color-background);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 8px;
}

.btn-unlock {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-primary);
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-unlock:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-unlock:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}
```

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
Updating 97f5ae0..61e575e
Fast-forward
 backend/src/course/admin.controller.ts         | ...
 backend/src/course/course.service.ts           | ...
 backend/src/course/dto/unlock-module.dto.ts    | ...
 tma/src/pages/curator/CourseDashboardPage.css  | ...
 tma/src/pages/curator/CourseDashboardPage.tsx  | ...
 5 files changed, 142 insertions(+), 32 deletions(-)
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
2. Перейдите на вкладку **"Курсы"**
3. Откройте курс "Пирамида Минто"
4. На каждой карточке модуля должна быть кнопка **"🔓 Открыть для всех"**
5. Нажмите кнопку на Модуле 1
6. Подтвердите действие
7. Должно появиться сообщение: "Модуль открыт для N учеников"
8. Счётчик участников на карточке обновится

---

## Проверка функциональности

### 1. Открытие модуля для всех учеников

```bash
curl -X POST \
  "https://tma.n8nrgimprovise.space/api/admin/modules/MODULE_ID/unlock" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "forAll": true
  }'
```

**Ожидаемый ответ:**
```json
{
  "unlocked": 5,
  "message": "Module unlocked for 5 user(s)"
}
```

---

### 2. Проверка созданных Enrollments

```bash
# В PostgreSQL
sudo -u postgres psql -d minto_db

# Запрос
SELECT 
  e.id,
  u."firstName", 
  u."lastName",
  m.title AS "moduleName",
  e.status,
  e."unlockedAt",
  curator."firstName" AS "unlockedBy"
FROM "Enrollment" e
JOIN "User" u ON e."userId" = u.id
JOIN "CourseModule" m ON e."moduleId" = m.id
LEFT JOIN "User" curator ON e."unlockedById" = curator.id
WHERE m.index = 1
ORDER BY e."unlockedAt" DESC;

# Ожидаемый результат: список учеников с enrollment для Модуля 1
```

---

### 3. Проверка со стороны ученика

1. Откройте TMA как ученик (LEARNER)
2. На дашборде должны появиться модули, которые куратор открыл
3. Статус модуля: `IN_PROGRESS`
4. Модуль должен быть доступен для прохождения

**API проверка:**
```bash
curl -X GET \
  "https://tma.n8nrgimprovise.space/api/course/modules" \
  -H "Authorization: Bearer LEARNER_JWT_TOKEN"
```

**Ожидаемый ответ:**
```json
[
  {
    "id": "...",
    "index": 1,
    "title": "Модуль 1: Введение в пирамиду Минто",
    "enrollment": {
      "id": "...",
      "status": "IN_PROGRESS",
      "unlockedAt": "2025-11-29T..."
    }
  }
]
```

---

## Флоу использования

### Для куратора:

```
1. Открыть TMA → Вкладка "Курсы"
   ↓
2. Выбрать курс "Пирамида Минто"
   ↓
3. Увидеть список модулей
   ↓
4. На карточке "Модуль 1" нажать "🔓 Открыть для всех"
   ↓
5. Подтвердить действие в диалоге
   ↓
6. Увидеть сообщение: "Модуль открыт для 5 учеников"
   ↓
7. Счётчик участников на карточке обновится: 0 → 5
```

### Для ученика:

```
1. Открыть TMA → Дашборд
   ↓
2. Модуль 1 теперь доступен (status: IN_PROGRESS)
   ↓
3. Нажать "Продолжить обучение" или кликнуть на модуль
   ↓
4. Увидеть список шагов модуля
   ↓
5. Начать прохождение
```

---

## Будущие улучшения (Next Steps)

### 1. Открытие модуля для конкретного ученика

**В `CuratorUserPage` (карточка ученика):**
```tsx
<button onClick={() => handleUnlockModuleForUser(userId, moduleId)}>
  🔓 Открыть модуль {moduleIndex}
</button>
```

**API вызов:**
```typescript
await api.post(`/admin/modules/${moduleId}/unlock`, {
  userIds: [userId],
});
```

---

### 2. Показывать статус модуля на карточке

**Индикаторы:**
- 🔒 Заблокирован (0 участников)
- 🔓 Открыт (N участников)
- ✅ Все завершили

**Реализация:**
```tsx
{module.enrollmentsCount === 0 && (
  <div className="lock-badge">🔒 Заблокирован</div>
)}
{module.enrollmentsCount > 0 && (
  <div className="unlock-badge">🔓 Открыт для {module.enrollmentsCount}</div>
)}
```

---

### 3. Закрытие/блокировка модуля

**Endpoint:** `POST /admin/modules/:moduleId/lock`

**Логика:**
- Удалить или обновить статус Enrollment на `LOCKED`
- Опция: для всех или для конкретных пользователей

---

### 4. История открытия модулей

**Таблица:** `ModuleUnlockHistory`

**Поля:**
- moduleId
- curatorId
- action (UNLOCK / LOCK)
- targetType (ALL / SPECIFIC / COMPLETED_PREVIOUS)
- affectedUsersCount
- timestamp

---

## Troubleshooting

### Ошибка: "No users to unlock module for"

**Причина:** В системе нет зарегистрированных учеников

**Решение:**
1. Проверьте наличие пользователей с ролью LEARNER:
   ```bash
   sudo -u postgres psql -d minto_db -c \
     "SELECT id, \"firstName\", \"lastName\", role FROM \"User\" WHERE role = 'LEARNER';"
   ```
2. Если пусто → зарегистрируйте учеников через Telegram бот

---

### Кнопка "Открыть для всех" не работает

**Причина:** Ошибка авторизации или роли

**Решение:**
1. Проверьте, что пользователь - CURATOR или ADMIN
2. Проверьте JWT токен в devtools → Network
3. Проверьте backend логи: `pm2 logs minto-backend`

---

### Счётчик участников не обновляется

**Причина:** Данные не перезагружены после unlock

**Решение:**
- После успешного unlock вызывается `await loadCourseData()` для обновления
- Если не работает → проверьте console.log в браузере
- Перезагрузите страницу вручную

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

**Версия:** 1.0  
**Дата:** 2025-11-29  
**Изменения:** Добавлена возможность открытия модулей для учеников кураторами

