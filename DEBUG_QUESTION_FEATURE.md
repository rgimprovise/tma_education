# Команды для диагностики функции "Задать вопрос куратору"

## 1. Просмотр последних логов с фильтрацией по функции

```bash
# Все логи, связанные с handleQuestionMessage
pm2 logs minto-backend --lines 200 | grep -A 20 "handleQuestionMessage"

# Только ошибки
pm2 logs minto-backend --lines 200 | grep -A 10 "ERROR.*handleQuestionMessage"

# Логи поиска кураторов
pm2 logs minto-backend --lines 200 | grep -A 5 "Searching for curators"

# Логи отправки сообщений кураторам
pm2 logs minto-backend --lines 200 | grep -A 5 "Sending to curator"
```

## 2. Просмотр всех логов в реальном времени

```bash
# Все логи в реальном времени
pm2 logs minto-backend --lines 0

# Только ошибки в реальном времени
pm2 logs minto-backend --lines 0 | grep -i error
```

## 3. Проверка конкретных этапов обработки

```bash
# Проверка получения вопроса от ученика
pm2 logs minto-backend --lines 200 | grep "Processing question from user"

# Проверка найденных кураторов
pm2 logs minto-backend --lines 200 | grep "Found.*curators"

# Проверка успешных отправок
pm2 logs minto-backend --lines 200 | grep "Successfully sent to"

# Проверка ошибок отправки
pm2 logs minto-backend --lines 200 | grep "Failed to send question to curator"
```

## 4. Проверка Prisma запросов

```bash
# Все ошибки Prisma
pm2 logs minto-backend --lines 200 | grep -A 15 "PrismaClient"

# Ошибки валидации Prisma
pm2 logs minto-backend --lines 200 | grep -A 20 "PrismaClientValidationError"
```

## 5. Проверка состояния бота

```bash
# Проверка, что бот запущен
pm2 status

# Проверка использования памяти и CPU
pm2 monit

# Перезапуск бота (если нужно)
pm2 restart minto-backend
```

## 6. Проверка базы данных (кураторы)

```bash
# Подключение к PostgreSQL
cd /var/www/tma_education/backend
npx prisma studio
# Или через psql:
# psql $DATABASE_URL

# SQL запрос для проверки кураторов:
# SELECT id, "telegramId", "firstName", "lastName", role 
# FROM "User" 
# WHERE role IN ('CURATOR', 'ADMIN') AND "telegramId" IS NOT NULL;
```

## 7. Проверка конфигурации Telegram бота

```bash
# Проверка переменных окружения (не показывать токен в логах!)
cd /var/www/tma_education/backend
grep TELEGRAM_BOT_TOKEN .env | head -c 20
# Должен показать начало токена

# Проверка webhook
curl -X GET "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## 8. Детальная диагностика конкретной ошибки

```bash
# Полный стек ошибки
pm2 logs minto-backend --lines 500 | grep -B 10 -A 30 "Error handling question message"

# Все логи за последние 5 минут с временными метками
pm2 logs minto-backend --lines 0 --nostream | tail -100

# Сохранение логов в файл для анализа
pm2 logs minto-backend --lines 500 > /tmp/telegram_logs.txt
grep -A 20 "handleQuestionMessage" /tmp/telegram_logs.txt
```

## 9. Проверка кода на VPS

```bash
# Проверка, что изменения применены
cd /var/www/tma_education/backend
git log --oneline -5
git show HEAD:src/telegram/telegram.service.ts | grep -A 10 "Searching for curators"

# Проверка скомпилированного кода
grep -A 10 "Searching for curators" dist/main.js | head -20
```

## 10. Тестирование функции вручную

После отправки вопроса от ученика, выполните:

```bash
# Проверка последних логов сразу после отправки
pm2 logs minto-backend --lines 50 --nostream

# Поиск всех упоминаний telegramId ученика
pm2 logs minto-backend --lines 200 | grep "430019680"
```

## 11. Проверка отправки сообщений через Telegram API

```bash
# Проверка последних отправленных сообщений в логах
pm2 logs minto-backend --lines 200 | grep -i "sendMessage\|send.*curator"

# Проверка ошибок Telegram API
pm2 logs minto-backend --lines 200 | grep -A 10 "Telegram.*error\|grammy.*error"
```

## 12. Мониторинг в реальном времени при тестировании

```bash
# Откройте два терминала:

# Терминал 1: Все логи
pm2 logs minto-backend --lines 0

# Терминал 2: Только ошибки и handleQuestionMessage
pm2 logs minto-backend --lines 0 | grep -E "ERROR|handleQuestionMessage|curator"
```

## Пример полной диагностики одной ошибки:

```bash
# 1. Найти ошибку
pm2 logs minto-backend --lines 200 | grep -B 5 -A 25 "Error handling question message"

# 2. Проверить контекст (что было до ошибки)
pm2 logs minto-backend --lines 200 | grep -B 30 "Error handling question message" | tail -40

# 3. Проверить, были ли найдены кураторы
pm2 logs minto-backend --lines 200 | grep -A 5 "Searching for curators"

# 4. Проверить Prisma ошибки
pm2 logs minto-backend --lines 200 | grep -A 20 "PrismaClient"
```

