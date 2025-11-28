# Telegram Bot Module

Модуль для работы с Telegram Bot на базе библиотеки **grammY**.

## Настройка

### 1. Получение токена бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям и получите токен
4. Добавьте токен в `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

### 2. Настройка WebApp URL

Укажите URL вашего Telegram Mini App в `.env`:
```env
TMA_URL=https://your-tma-domain.com
```

Для разработки:
```env
TMA_URL=http://localhost:5173
```

## Функциональность

### Команда /start

При отправке команды `/start` бот:
1. Находит или создаёт пользователя по `telegramId`
2. Отправляет приветственное сообщение (разное для обучающихся и кураторов)
3. Отправляет кнопку для открытия Telegram Mini App

### Функции-обёртки

#### sendMessage(telegramId, text, options?)
Отправляет сообщение пользователю.

**Параметры:**
- `telegramId` - Telegram ID пользователя
- `text` - Текст сообщения
- `options` - Дополнительные опции (клавиатура, parse_mode и т.д.)

#### notifyCuratorAboutSubmission(curatorTelegramId, submission)
Отправляет уведомление куратору о новой сдаче.

**Используется:**
- Автоматически вызывается после проверки сдачи через ИИ
- Показывает информацию о сдаче и оценку ИИ
- Предлагает кнопки "Одобрить" / "Вернуть на доработку"

#### notifyLearnerAboutReview(learnerTelegramId, submission)
Отправляет уведомление обучающемуся о результате проверки.

**Используется:**
- После одобрения сдачи куратором
- После возврата сдачи на доработку

#### notifyModuleCompleted(learnerTelegramId, moduleIndex, moduleTitle)
Уведомляет о завершении модуля.

**Используется:**
- Автоматически при завершении модуля (все шаги одобрены)

#### notifyModuleUnlocked(learnerTelegramId, moduleIndex, moduleTitle)
Уведомляет об открытии нового модуля.

**Используется:**
- При открытии модуля куратором через `/admin/modules/:id/unlock`

## Интеграция

TelegramService автоматически интегрирован с:
- **SubmissionsService** - уведомления о сдачах
- **CourseService** - уведомления об открытии/завершении модулей

## Обработка ошибок

- Все ошибки логируются через `Logger`
- Ошибки отправки сообщений не прерывают основной поток
- Бот продолжает работать даже при ошибках в отдельных уведомлениях

## Разработка

### Polling vs Webhook

По умолчанию используется **polling** (для разработки).

Для production можно настроить webhook:
```typescript
// В telegram.service.ts
await this.bot.api.setWebhook('https://your-domain.com/webhook');
```

### Тестирование

1. Запустите backend:
   ```bash
   npm run start:dev
   ```

2. Найдите вашего бота в Telegram
3. Отправьте команду `/start`
4. Проверьте, что бот отвечает и отправляет кнопку

## Расширение функциональности

Для добавления новых команд или обработчиков:

1. Добавьте обработчик в `setupHandlers()`:
   ```typescript
   this.bot.command('newcommand', async (ctx: Context) => {
     // Ваша логика
   });
   ```

2. Для callback_query:
   ```typescript
   this.bot.callbackQuery(/^prefix_/, async (ctx: Context) => {
     // Ваша логика
   });
   ```

## Безопасность

- Токен бота хранится в `.env` и не коммитится в репозиторий
- Все команды обрабатываются с проверкой ошибок
- Валидация данных перед отправкой сообщений

