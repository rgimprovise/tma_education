# API Endpoints Documentation

Документация эндпоинтов для Telegram Mini App.

## Base URL
```
http://localhost:3000
```

## Authentication

Все эндпоинты (кроме `/auth/telegram-webapp`) требуют JWT токен в заголовке:
```
Authorization: Bearer <token>
```

---

## Auth

### POST /auth/telegram-webapp

Аутентификация через Telegram WebApp.

**Request:**
```json
{
  "initData": "query_id=...&user=..."
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "telegramId": "123456789",
    "firstName": "Иван",
    "lastName": "Иванов",
    "role": "LEARNER"
  }
}
```

---

## Users

### GET /users/me

Информация о текущем пользователе.

**Response:**
```json
{
  "id": "user_id",
  "telegramId": "123456789",
  "firstName": "Иван",
  "lastName": "Иванов",
  "position": "Менеджер",
  "role": "LEARNER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Course

### GET /course/modules

Список модулей с их статусом для текущего пользователя.

**Response:**
```json
[
  {
    "id": "module_id",
    "index": 1,
    "title": "Модуль 1: Принцип пирамиды Минто",
    "description": "Описание модуля",
    "isExam": false,
    "enrollment": {
      "id": "enrollment_id",
      "status": "IN_PROGRESS",
      "unlockedAt": "2024-01-01T00:00:00.000Z",
      "completedAt": null
    }
  }
]
```

### GET /course/modules/:id

Детальная информация о модуле по его ID.

**Response:**
```json
{
  "id": "module_id",
  "index": 1,
  "title": "Модуль 1: Принцип пирамиды Минто",
  "description": "Описание модуля",
  "isExam": false,
  "steps": [
    {
      "id": "step_id",
      "index": 0,
      "type": "INFO",
      "title": "Введение",
      "content": "Текст введения..."
    }
  ],
  "enrollment": {
    "id": "enrollment_id",
    "status": "IN_PROGRESS"
  }
}
```

### GET /course/modules/:id/steps

Список шагов модуля с прогрессом пользователя.

**Response:**
```json
[
  {
    "id": "step_id",
    "moduleId": "module_id",
    "index": 0,
    "type": "INFO",
    "title": "Введение",
    "content": "Текст...",
    "requiresAiReview": false,
    "expectedAnswer": "TEXT",
    "maxScore": 10,
    "submission": null
  },
  {
    "id": "step_id_2",
    "moduleId": "module_id",
    "index": 1,
    "type": "TASK",
    "title": "Задание М1.1",
    "content": "Текст задания...",
    "requiresAiReview": true,
    "expectedAnswer": "TEXT",
    "maxScore": 10,
    "submission": {
      "id": "submission_id",
      "status": "AI_REVIEWED",
      "aiScore": 7.5,
      "curatorScore": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
]
```

### GET /course/steps/:id

Детальная информация по шагу (для страницы задания).

**Response:**
```json
{
  "id": "step_id",
  "moduleId": "module_id",
  "index": 1,
  "type": "TASK",
  "title": "Задание М1.1: Разбор SCQR",
  "content": "Проанализируйте рабочий кейс...",
  "requiresAiReview": true,
  "expectedAnswer": "TEXT",
  "maxScore": 10,
  "submission": {
    "id": "submission_id",
    "status": "AI_REVIEWED",
    "aiScore": 7.5,
    "curatorScore": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Submissions

### POST /submissions

Создать сдачу задания.

**Request:**
```json
{
  "stepId": "step_id",
  "moduleId": "module_id",
  "answerText": "Текст ответа...",
  "answerFileId": null,
  "answerType": "TEXT"
}
```

**Response:**
```json
{
  "id": "submission_id",
  "userId": "user_id",
  "moduleId": "module_id",
  "stepId": "step_id",
  "answerText": "Текст ответа...",
  "answerFileId": null,
  "answerType": "TEXT",
  "aiScore": null,
  "aiFeedback": null,
  "curatorScore": null,
  "curatorFeedback": null,
  "status": "SENT",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /submissions/my

Мои сдачи (для обучающихся).

**Response:**
```json
[
  {
    "id": "submission_id",
    "userId": "user_id",
    "moduleId": "module_id",
    "stepId": "step_id",
    "answerText": "Текст ответа...",
    "status": "AI_REVIEWED",
    "aiScore": 7.5,
    "aiFeedback": "Хороший ответ, но можно улучшить...",
    "step": {
      "id": "step_id",
      "title": "Задание М1.1",
      "index": 1
    },
    "module": {
      "id": "module_id",
      "index": 1,
      "title": "Модуль 1"
    }
  }
]
```

### GET /submissions

Список сдач (для кураторов - все, для обучающихся - только свои).

**Response:** (аналогично `/submissions/my`)

### GET /submissions/:id

Детальная информация о сдаче.

**Response:**
```json
{
  "id": "submission_id",
  "userId": "user_id",
  "moduleId": "module_id",
  "stepId": "step_id",
  "answerText": "Текст ответа...",
  "answerFileId": null,
  "answerType": "TEXT",
  "aiScore": 7.5,
  "aiFeedback": "Комментарий ИИ...",
  "curatorScore": 8.0,
  "curatorFeedback": "Комментарий куратора...",
  "status": "CURATOR_APPROVED",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "step": {
    "id": "step_id",
    "title": "Задание М1.1",
    "index": 1
  },
  "module": {
    "id": "module_id",
    "index": 1,
    "title": "Модуль 1"
  },
  "user": {
    "id": "user_id",
    "firstName": "Иван",
    "lastName": "Иванов"
  }
}
```

---

---

## Admin (для кураторов и администраторов)

Все эндпоинты требуют роль `CURATOR` или `ADMIN`.

### GET /admin/learners

Список обучающихся с их прогрессом по модулям.

**Response:**
```json
[
  {
    "id": "user_id",
    "telegramId": "123456789",
    "firstName": "Иван",
    "lastName": "Иванов",
    "position": "Менеджер",
    "role": "LEARNER",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "enrollments": [
      {
        "id": "enrollment_id",
        "module": {
          "id": "module_id",
          "index": 1,
          "title": "Модуль 1"
        },
        "status": "IN_PROGRESS",
        "unlockedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalSubmissions": 5,
    "pendingSubmissions": 2
  }
]
```

### GET /admin/learners/:id

Детальный прогресс пользователя + последние сдачи.

**Response:**
```json
{
  "id": "user_id",
  "telegramId": "123456789",
  "firstName": "Иван",
  "lastName": "Иванов",
  "enrollments": [
    {
      "id": "enrollment_id",
      "module": {
        "id": "module_id",
        "index": 1,
        "title": "Модуль 1",
        "description": "Описание"
      },
      "status": "IN_PROGRESS",
      "unlockedAt": "2024-01-01T00:00:00.000Z",
      "unlockedBy": {
        "id": "curator_id",
        "firstName": "Куратор",
        "lastName": "Иванов"
      }
    }
  ],
  "recentSubmissions": [
    {
      "id": "submission_id",
      "status": "AI_REVIEWED",
      "aiScore": 7.5,
      "step": {
        "id": "step_id",
        "title": "Задание М1.1",
        "index": 1
      },
      "module": {
        "id": "module_id",
        "index": 1,
        "title": "Модуль 1"
      }
    }
  ],
  "statistics": {
    "totalSubmissions": 10,
    "approvedSubmissions": 7,
    "pendingSubmissions": 2,
    "returnedSubmissions": 1
  }
}
```

### POST /admin/modules/:moduleId/unlock

Открыть модуль для пользователей.

**Request:**
```json
{
  "userIds": ["user_id_1", "user_id_2"]
}
```

Или для открытия всем, кто завершил предыдущий модуль:
```json
{
  "allCompletedPrevious": true
}
```

**Response:**
```json
{
  "unlocked": 5,
  "message": "Module unlocked for 5 user(s)"
}
```

### GET /admin/submissions

Список сдач с фильтрами.

**Query Parameters:**
- `moduleId` (optional) - фильтр по модулю
- `status` (optional) - фильтр по статусу (SENT, AI_REVIEWED, CURATOR_APPROVED, CURATOR_RETURNED)

**Response:**
```json
[
  {
    "id": "submission_id",
    "userId": "user_id",
    "moduleId": "module_id",
    "stepId": "step_id",
    "answerText": "Текст ответа...",
    "status": "AI_REVIEWED",
    "aiScore": 7.5,
    "aiFeedback": "Комментарий ИИ...",
    "step": {
      "id": "step_id",
      "title": "Задание М1.1",
      "index": 1
    },
    "module": {
      "id": "module_id",
      "index": 1,
      "title": "Модуль 1"
    },
    "user": {
      "id": "user_id",
      "firstName": "Иван",
      "lastName": "Иванов",
      "telegramId": "123456789"
    }
  }
]
```

### POST /admin/submissions/:id/approve

Одобрить сдачу.

**Request:**
```json
{
  "curatorScore": 8.5,
  "curatorFeedback": "Отличная работа! Хорошо структурировано."
}
```

**Response:**
```json
{
  "id": "submission_id",
  "status": "CURATOR_APPROVED",
  "curatorScore": 8.5,
  "curatorFeedback": "Отличная работа!",
  ...
}
```

### POST /admin/submissions/:id/return

Вернуть сдачу на доработку.

**Request:**
```json
{
  "curatorFeedback": "Нужно доработать структуру. Главная мысль должна быть в начале."
}
```

**Response:**
```json
{
  "id": "submission_id",
  "status": "CURATOR_RETURNED",
  "curatorFeedback": "Нужно доработать...",
  ...
}
```

---

## Error Responses

Все эндпоинты могут возвращать стандартные HTTP ошибки:

- `400 Bad Request` - неверные данные запроса
- `401 Unauthorized` - отсутствует или неверный JWT токен
- `403 Forbidden` - недостаточно прав (не та роль)
- `404 Not Found` - ресурс не найден
- `500 Internal Server Error` - внутренняя ошибка сервера

**Формат ошибки:**
```json
{
  "statusCode": 404,
  "message": "Module not found",
  "error": "Not Found"
}
```

