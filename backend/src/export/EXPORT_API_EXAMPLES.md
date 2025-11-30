# Примеры использования API экспорта данных

## Эндпоинты

### 1. GET /admin/export/submissions
Экспорт сырых данных по сдачам

### 2. GET /admin/export/user-progress
Экспорт агрегированного прогресса пользователей

---

## Примеры HTTP-запросов

### Пример 1: Экспорт всех сдач по курсу в CSV

```bash
curl -X GET "http://localhost:3000/admin/export/submissions?courseId=course_123&format=csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o submissions_export.csv
```

**Ответ:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="submissions_export_course_course_123_2025-11-30.csv"`
- Тело: CSV файл с данными

---

### Пример 2: Экспорт сдач по модулю в TSV

```bash
curl -X GET "http://localhost:3000/admin/export/submissions?courseId=course_123&moduleId=module_456&format=tsv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o submissions_export.tsv
```

**Ответ:**
- Content-Type: `text/tab-separated-values; charset=utf-8`
- Content-Disposition: `attachment; filename="submissions_export_course_course_123_2025-11-30.tsv"`
- Тело: TSV файл с данными

---

### Пример 3: Экспорт сдач за период в JSON

```bash
curl -X GET "http://localhost:3000/admin/export/submissions?courseId=course_123&dateFrom=2025-11-01&dateTo=2025-11-30&format=json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o submissions_export.json
```

**Ответ:**
- Content-Type: `application/json; charset=utf-8`
- Content-Disposition: `attachment; filename="submissions_export_course_course_123_2025-11-30.json"`
- Тело: JSON массив объектов

---

### Пример 4: Экспорт прогресса пользователей в CSV

```bash
curl -X GET "http://localhost:3000/admin/export/user-progress?courseId=course_123&format=csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o user_progress_export.csv
```

**Ответ:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="user-progress_export_course_course_123_2025-11-30.csv"`
- Тело: CSV файл с данными

---

### Пример 5: Экспорт прогресса за период в TSV

```bash
curl -X GET "http://localhost:3000/admin/export/user-progress?courseId=course_123&dateFrom=2025-11-01&dateTo=2025-11-30&format=tsv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o user_progress_export.tsv
```

---

## Структура CSV/TSV файлов

### Формат: submissions (CSV)

**Заголовки:**
```
submissionId,userId,userFullName,userPosition,userRole,courseId,courseTitle,moduleId,moduleTitle,moduleIndex,stepId,stepTitle,stepIndex,stepType,isRequired,answerType,answerTextOrTranscript,aiScore,curatorScore,status,aiFeedback,curatorFeedback,createdAt,updatedAt,resubmissionRequested,resubmissionRequestedAt,telegramPromptMessageId,maxScore
```

**Пример строки:**
```
"sub_abc123","user_xyz789","Иван Иванов","Менеджер","LEARNER","course_001","Полный курс по пирамиде Минто","mod_101","Модуль 1: Введение",1,"step_202","Приветствие",0,"INFO",false,"TEXT","",null,null,"SENT",null,null,"2025-11-01T10:00:00.000Z","2025-11-01T10:00:00.000Z",false,null,null,10
"sub_abc124","user_xyz789","Иван Иванов","Менеджер","LEARNER","course_001","Полный курс по пирамиде Минто","mod_101","Модуль 1: Введение",1,"step_203","Что такое пирамида Минто",1,"TASK",true,"TEXT","Мой ответ на задание о пирамиде Минто. Это структурированный подход к изложению информации.",7.5,8.0,"CURATOR_APPROVED","Хороший ответ, но можно добавить больше деталей","Отлично! Продолжайте в том же духе.","2025-11-02T14:30:00.000Z","2025-11-02T15:00:00.000Z",false,null,null,10
"sub_abc125","user_xyz789","Иван Иванов","Менеджер","LEARNER","course_001","Полный курс по пирамиде Минто","mod_101","Модуль 1: Введение",1,"step_204","Практическое задание",2,"TASK",true,"AUDIO","Транскрипт аудио ответа: Пирамида Минто помогает структурировать информацию от общего к частному.",6.0,null,"AI_REVIEWED","Ответ слишком краткий, нужно больше деталей",null,"2025-11-03T09:15:00.000Z","2025-11-03T09:20:00.000Z",false,null,12345,10
```

**Примечания:**
- CSV использует запятые как разделители
- Значения с запятыми, кавычками или переносами строк оборачиваются в кавычки
- Кавычки внутри значений экранируются удвоением (`""`)
- Файл начинается с BOM (`\uFEFF`) для корректного отображения в Excel
- Даты в формате ISO 8601
- Булевы значения: `true` → `1`, `false` → `0`
- `null` значения представлены как пустые строки

---

### Формат: user-progress (CSV)

**Заголовки:**
```
userId,userFullName,userPosition,userRole,courseId,courseTitle,modulesCount,completedModulesCount,completionPercent,totalSubmissions,avgAiScore,avgCuratorScore,returnsCount,returnsPercent,firstActivityAt,lastActivityAt,activityPeriodDays,approvedSubmissionsCount,pendingSubmissionsCount,resubmissionRequestedCount,userCreatedAt
```

**Пример строки:**
```
"user_xyz789","Иван Иванов","Менеджер","LEARNER","course_001","Полный курс по пирамиде Минто",4,2,50.0,10,7.5,8.0,1,10.0,"2025-11-01T10:00:00.000Z","2025-11-15T14:30:00.000Z",14,7,2,0,"2025-10-15T08:00:00.000Z"
"user_abc456","Петр Петров","Директор","LEARNER","course_001","Полный курс по пирамиде Минто",4,4,100.0,15,8.5,9.0,0,0.0,"2025-10-20T12:00:00.000Z","2025-11-10T16:00:00.000Z",21,15,0,0,"2025-10-10T09:00:00.000Z"
```

**Примечания:**
- `completionPercent` и `returnsPercent` - числа с плавающей точкой
- `activityPeriodDays` - количество дней между первой и последней активностью
- `avgAiScore` и `avgCuratorScore` могут быть `null`, если нет оценок

---

## Формат: TSV (Tab-Separated Values)

TSV использует табуляцию (`\t`) как разделитель вместо запятых.

**Пример строки (submissions):**
```
sub_abc123	user_xyz789	Иван Иванов	Менеджер	LEARNER	course_001	Полный курс...	mod_101	Модуль 1	1	step_202	Приветствие	0	INFO	false	TEXT			null	null	SENT		null	null	2025-11-01T10:00:00.000Z	2025-11-01T10:00:00.000Z	false	null	null	10
```

**Примечания:**
- Табуляции и переносы строк в значениях заменяются на пробелы
- BOM не добавляется (в отличие от CSV)
- Удобен для обработки в текстовых редакторах и некоторых ИИ-инструментах

---

## Формат: JSON

**Пример (submissions):**
```json
[
  {
    "submissionId": "sub_abc123",
    "userId": "user_xyz789",
    "userFullName": "Иван Иванов",
    "userPosition": "Менеджер",
    "userRole": "LEARNER",
    "courseId": "course_001",
    "courseTitle": "Полный курс по пирамиде Минто",
    "moduleId": "mod_101",
    "moduleTitle": "Модуль 1: Введение",
    "moduleIndex": 1,
    "stepId": "step_202",
    "stepTitle": "Приветствие",
    "stepIndex": 0,
    "stepType": "INFO",
    "isRequired": false,
    "answerType": "TEXT",
    "answerTextOrTranscript": "",
    "aiScore": null,
    "curatorScore": null,
    "status": "SENT",
    "aiFeedback": null,
    "curatorFeedback": null,
    "createdAt": "2025-11-01T10:00:00.000Z",
    "updatedAt": "2025-11-01T10:00:00.000Z",
    "resubmissionRequested": false,
    "resubmissionRequestedAt": null,
    "telegramPromptMessageId": null,
    "maxScore": 10
  },
  {
    "submissionId": "sub_abc124",
    "userId": "user_xyz789",
    "userFullName": "Иван Иванов",
    "userPosition": "Менеджер",
    "userRole": "LEARNER",
    "courseId": "course_001",
    "courseTitle": "Полный курс по пирамиде Минто",
    "moduleId": "mod_101",
    "moduleTitle": "Модуль 1: Введение",
    "moduleIndex": 1,
    "stepId": "step_203",
    "stepTitle": "Что такое пирамида Минто",
    "stepIndex": 1,
    "stepType": "TASK",
    "isRequired": true,
    "answerType": "TEXT",
    "answerTextOrTranscript": "Мой ответ на задание о пирамиде Минто...",
    "aiScore": 7.5,
    "curatorScore": 8.0,
    "status": "CURATOR_APPROVED",
    "aiFeedback": "Хороший ответ, но можно добавить больше деталей",
    "curatorFeedback": "Отлично! Продолжайте в том же духе.",
    "createdAt": "2025-11-02T14:30:00.000Z",
    "updatedAt": "2025-11-02T15:00:00.000Z",
    "resubmissionRequested": false,
    "resubmissionRequestedAt": null,
    "telegramPromptMessageId": null,
    "maxScore": 10
  }
]
```

**Примечания:**
- Форматирование с отступами (pretty-print)
- `null` значения представлены как `null` (не пустые строки)
- Даты в формате ISO 8601
- Булевы значения: `true` / `false`

---

## Параметры запроса

### Общие параметры:

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `courseId` | string | Да | ID курса |
| `format` | string | Нет (по умолчанию `csv`) | Формат: `csv`, `tsv`, `json` |
| `dateFrom` | string (ISO 8601) | Нет | Начальная дата фильтрации |
| `dateTo` | string (ISO 8601) | Нет | Конечная дата фильтрации |

### Специфичные для `/admin/export/submissions`:

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `moduleId` | string | Нет | ID модуля для фильтрации |

---

## Авторизация

Все эндпоинты требуют JWT токен в заголовке:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Доступные роли:**
- `ADMIN` - полный доступ
- `CURATOR` - доступ к экспортам

---

## Обработка ошибок

### 400 Bad Request
- Отсутствует обязательный параметр `courseId`
- Неверный формат даты (`dateFrom` или `dateTo`)
- Неподдерживаемый формат экспорта

**Пример:**
```json
{
  "statusCode": 400,
  "message": "courseId is required"
}
```

### 401 Unauthorized
- Отсутствует или неверный JWT токен

### 403 Forbidden
- Пользователь не имеет прав доступа (не ADMIN и не CURATOR)

### 404 Not Found
- Курс не найден
- Модуль не найден (если указан `moduleId`)

**Пример:**
```json
{
  "statusCode": 404,
  "message": "Course not found"
}
```

---

## Оптимизация запросов

- Используйте фильтры `dateFrom` / `dateTo` для ограничения объёма данных
- Используйте `moduleId` для экспорта только по конкретному модулю
- Для больших объёмов данных рекомендуется использовать TSV или JSON (CSV может быть медленнее из-за экранирования)

---

## Использование в ИИ-анализе

### Рекомендации:

1. **Для анализа текстов:**
   - Используйте поле `answerTextOrTranscript` из экспорта `submissions`
   - Фильтруйте по `answerType: TEXT` или проверяйте наличие транскриптов для `AUDIO`/`VIDEO`

2. **Для анализа прогресса:**
   - Используйте экспорт `user-progress` для агрегированных метрик
   - Анализируйте `completionPercent`, `returnsPercent`, `avgAiScore`, `avgCuratorScore`

3. **Для анализа обратной связи:**
   - Используйте поля `aiFeedback` и `curatorFeedback` из экспорта `submissions`
   - Анализируйте корреляцию между `aiScore` и `curatorScore`

4. **Формат для ИИ:**
   - **TSV** - удобен для обработки в командной строке и некоторых ИИ-инструментах
   - **JSON** - удобен для программной обработки и интеграций
   - **CSV** - удобен для Excel и визуального анализа

