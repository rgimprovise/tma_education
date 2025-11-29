# 🔗 Настройка Telegram Webhook

## Проблема

**Long polling конфликт:**
- Только один процесс может использовать long polling для бота
- Если токен используется где-то еще → новое подключение зависает
- `bot.start()` timeout через 30 секунд

**Решение:** Переключиться на **webhook режим**.

---

## Преимущества Webhook

✅ **Нет конфликтов:** Telegram сам отправляет updates на ваш сервер  
✅ **Быстрее:** Моментальная доставка сообщений  
✅ **Надёжнее:** Не зависает при сетевых проблемах  
✅ **Production-ready:** Рекомендуется Telegram для production  
✅ **Меньше нагрузки:** Не нужно постоянно опрашивать API  

---

## Настройка на VPS

### Шаг 1: Обновить код

```bash
cd /var/www/tma_education
git pull

cd backend
npm run build
```

### Шаг 2: Добавить переменные в .env

```bash
nano /var/www/tma_education/backend/.env
```

Добавьте строки:

```env
# Включить webhook режим
TELEGRAM_USE_WEBHOOK=true

# URL для webhook (замените на ваш домен)
TELEGRAM_WEBHOOK_URL=https://tma.n8nrgimprovise.space/api/telegram/webhook
```

**Важно:**
- URL должен начинаться с `https://` (Telegram требует HTTPS)
- Путь должен быть `/api/telegram/webhook` (Caddy проксирует /api → backend)

### Шаг 3: Перезапустить backend

```bash
cd /var/www/tma_education/backend
pm2 restart minto-backend

# Проверить логи
pm2 logs minto-backend --lines 50
```

**Должно появиться:**
```
🤖 Telegram Bot initialized (webhook mode): @tma_edu_bot
⚠️ Don't forget to set webhook URL via /telegram/set-webhook
```

### Шаг 4: Установить webhook в Telegram

**Вариант A: Через curl**

```bash
curl -X POST https://tma.n8nrgimprovise.space/api/telegram/set-webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://tma.n8nrgimprovise.space/api/telegram/webhook"}'
```

**Вариант B: Через Telegram API напрямую**

```bash
curl -X POST https://api.telegram.org/bot8580479721:AAF3Pn_h623BNYrAnJBJjD0LFpaYu13A-Mw/setWebhook \
  -d "url=https://tma.n8nrgimprovise.space/api/telegram/webhook"
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "message": "Webhook set successfully",
  "url": "https://tma.n8nrgimprovise.space/api/telegram/webhook"
}
```

### Шаг 5: Проверить webhook

```bash
curl https://tma.n8nrgimprovise.space/api/telegram/webhook-info
```

**Ожидаемый ответ:**
```json
{
  "ok": true,
  "info": {
    "url": "https://tma.n8nrgimprovise.space/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Шаг 6: Тестирование

1. **Отправьте /start боту в Telegram**
2. **Проверьте логи:**
   ```bash
   pm2 logs minto-backend --lines 30
   ```
3. **Должно быть:**
   ```
   [TelegramService] Received voice from 123456789...
   ```

---

## Caddy конфигурация

**Проверьте**, что Caddy проксирует `/api/telegram/*`:

```caddyfile
tma.n8nrgimprovise.space {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:3002
    }
    
    handle {
        root * /var/www/tma_education/tma/dist
        try_files {path} /index.html
        file_server
    }
}
```

Это должно быть уже настроено, но проверьте:

```bash
sudo cat /etc/caddy/Caddyfile
```

---

## Переключение обратно на Polling

Если нужно вернуться к polling (для локальной разработки):

### Шаг 1: Удалить webhook

```bash
curl -X POST https://api.telegram.org/bot8580479721:AAF3Pn_h623BNYrAnJBJjD0LFpaYu13A-Mw/deleteWebhook
```

### Шаг 2: Изменить .env

```env
TELEGRAM_USE_WEBHOOK=false
```

### Шаг 3: Перезапустить

```bash
pm2 restart minto-backend
```

---

## Troubleshooting

### Проблема: "Webhook не работает"

**Проверьте:**

1. **HTTPS работает:**
   ```bash
   curl -I https://tma.n8nrgimprovise.space/api/telegram/webhook
   ```
   Должно быть `405 Method Not Allowed` (это нормально, POST нужен)

2. **Backend доступен:**
   ```bash
   curl https://tma.n8nrgimprovise.space/api/users/me
   ```
   Должно быть `401 Unauthorized` (нужен токен, но сервер отвечает)

3. **Webhook установлен:**
   ```bash
   curl https://api.telegram.org/bot8580479721:AAF3Pn_h623BNYrAnJBJjD0LFpaYu13A-Mw/getWebhookInfo
   ```
   Должно быть `"url": "https://..."`, `"pending_update_count": 0`

### Проблема: "Bot is not running"

**Причины:**
- Webhook не установлен → установите через `/telegram/set-webhook`
- Backend не запущен → `pm2 restart minto-backend`
- `isRunning = false` → проверьте логи при старте

### Проблема: "Updates не приходят"

**Проверьте логи:**
```bash
pm2 logs minto-backend | grep "handleUpdate"
```

Должно быть:
```
[TelegramController] Handling webhook update
```

Если не появляется → Telegram не может достучаться до webhook URL.

---

## Мониторинг

### Проверить статус webhook

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Посмотреть логи обработки

```bash
pm2 logs minto-backend --lines 100 | grep -i telegram
```

### Проверить pending updates

Если `pending_update_count > 0` → есть необработанные сообщения.

**Очистить pending updates:**
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=<YOUR_URL>" \
  -d "drop_pending_updates=true"
```

---

## Рекомендации

### Для Production (VPS):

✅ **Используйте webhook:**
- Надёжнее
- Быстрее
- Нет конфликтов
- Меньше нагрузки

```env
TELEGRAM_USE_WEBHOOK=true
TELEGRAM_WEBHOOK_URL=https://tma.n8nrgimprovise.space/api/telegram/webhook
```

### Для локальной разработки:

✅ **Используйте polling:**
- Проще настроить
- Не нужен HTTPS
- Не нужен публичный URL

```env
TELEGRAM_USE_WEBHOOK=false
```

Но используйте **ngrok** или **localtunnel** для тестирования webhook:

```bash
ngrok http 3000
# Скопируйте HTTPS URL
# Установите webhook: https://xxx.ngrok.io/telegram/webhook
```

---

## Endpoint Reference

### POST /telegram/webhook
**Описание:** Принимает updates от Telegram  
**Auth:** Не требуется (Telegram отправляет напрямую)  
**Body:** Update объект от Telegram

### POST /telegram/set-webhook
**Описание:** Устанавливает webhook URL  
**Auth:** Не требуется (временно, можно добавить защиту)  
**Body:**
```json
{
  "url": "https://your-domain.com/api/telegram/webhook"
}
```

### GET /telegram/webhook-info
**Описание:** Получить информацию о webhook  
**Auth:** Не требуется

---

**Автор:** AI Assistant (Cursor)  
**Дата:** 2025-11-29  
**Версия:** 1.0

