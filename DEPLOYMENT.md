# Инструкция по развертыванию на VPS

## Предварительные требования

- VPS с Ubuntu/Debian
- PostgreSQL установлен и запущен
- Node.js 18+ и npm
- Caddy установлен
- PM2 установлен (`npm install -g pm2`)

## Шаг 1: Клонирование и настройка

```bash
# Клонируем репозиторий
cd /var/www
git clone <your-repo-url> tma_education
cd tma_education
```

## Шаг 2: Настройка Backend

```bash
cd backend

# Установка зависимостей
npm install

# Настройка .env
cp env.example .env
nano .env  # Отредактируйте переменные окружения

# Генерация Prisma Client
npx prisma generate

# Применение миграций
npx prisma migrate deploy

# Сборка проекта
npm run build
```

### Переменные окружения для backend (.env)

```env
# Database
DATABASE_URL="postgresql://minto_user:135246@localhost:5432/minto_db"

# Telegram
TELEGRAM_BOT_TOKEN="your_bot_token"

# OpenAI
OPENAI_API_KEY="your_openai_key"

# JWT
JWT_SECRET="your_jwt_secret"

# Application
PORT=3000
NODE_ENV=production

# TMA URL (важно: должен быть доступен извне)
TMA_URL="https://tma.your-domain.com"
# Или для IP: TMA_URL="http://79.132.140.13"
```

## Шаг 3: Запуск Backend через PM2

```bash
cd /var/www/tma_education/backend

# Запуск
pm2 start npm --name "minto-backend" -- run start:prod

# Сохранение конфигурации PM2
pm2 save
pm2 startup  # Следуйте инструкциям для автозапуска

# Проверка статуса
pm2 status
pm2 logs minto-backend
```

## Шаг 4: Настройка TMA Frontend

```bash
cd /var/www/tma_education/tma

# Установка зависимостей
npm install

# Создание .env файла
cat > .env << EOF
VITE_API_URL=http://localhost:3000
EOF

# Сборка production версии
npm run build
```

### Переменные окружения для TMA (.env)

```env
# URL backend API (для production используйте полный URL)
VITE_API_URL=https://api.your-domain.com
# Или если используете один домен: VITE_API_URL=https://your-domain.com/api
```

## Шаг 5: Настройка Caddy

### Вариант 1: Отдельные поддомены

```bash
# Создайте Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Содержимое (замените `your-domain.com` на ваш домен):

```
# Backend API
api.your-domain.com {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
}

# TMA Frontend
tma.your-domain.com {
    root * /var/www/tma_education/tma/dist
    file_server
    try_files {path} /index.html
}
```

### Вариант 2: Один домен с путями

```
your-domain.com {
    # Backend API
    handle /api/* {
        reverse_proxy localhost:3000 {
            rewrite /api /strip_prefix
        }
    }
    
    # TMA Frontend
    handle {
        root * /var/www/tma_education/tma/dist
        file_server
        try_files {path} /index.html
    }
}
```

### Применение конфигурации Caddy

```bash
# Проверка конфигурации
sudo caddy validate --config /etc/caddy/Caddyfile

# Перезагрузка Caddy
sudo systemctl reload caddy

# Проверка статуса
sudo systemctl status caddy
```

## Шаг 6: Настройка Telegram Bot

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot` или выберите существующего бота
3. Настройте WebApp:
   ```
   /newapp
   Выберите бота
   Название: MINTO Education
   Описание: Система обучения «Пирамида Минто»
   URL: https://tma.your-domain.com
   ```

4. Убедитесь, что в `backend/.env` указан правильный `TMA_URL`

## Шаг 7: Проверка работоспособности

### Backend

```bash
# Проверка API
curl http://localhost:3000/auth/telegram-webapp

# Проверка через Caddy (если настроен)
curl https://api.your-domain.com/auth/telegram-webapp
```

### TMA

1. Откройте в браузере: `https://tma.your-domain.com`
2. Должна загрузиться страница авторизации

### Telegram Bot

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Должно появиться приветственное сообщение с кнопкой "Открыть учебное приложение"

## Устранение неполадок

### Backend не запускается

```bash
# Проверьте логи
pm2 logs minto-backend --lines 50

# Проверьте, что Prisma Client сгенерирован
ls -la node_modules/.prisma/client

# Если нет - сгенерируйте
npx prisma generate

# Проверьте подключение к БД
npx prisma db pull
```

### Ошибка "Произошла ошибка" в Telegram боте

1. Проверьте логи backend:
   ```bash
   pm2 logs minto-backend --lines 100
   ```

2. Убедитесь, что:
   - Prisma Client сгенерирован
   - Миграции применены
   - База данных доступна
   - `TELEGRAM_BOT_TOKEN` правильный

3. Проверьте подключение к БД:
   ```bash
   cd backend
   npx prisma studio  # Откроет веб-интерфейс для БД
   ```

### TMA не загружается

1. Проверьте, что сборка выполнена:
   ```bash
   ls -la /var/www/tma_education/tma/dist
   ```

2. Проверьте права доступа:
   ```bash
   sudo chown -R www-data:www-data /var/www/tma_education/tma/dist
   ```

3. Проверьте логи Caddy:
   ```bash
   sudo journalctl -u caddy -f
   ```

### CORS ошибки

Если возникают CORS ошибки, добавьте в `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: ['https://tma.your-domain.com', 'http://localhost:5173'],
  credentials: true,
});
```

## Обновление приложения

```bash
cd /var/www/tma_education

# Обновление кода
git pull origin main

# Backend
cd backend
npm install
npm run build
pm2 restart minto-backend

# TMA
cd ../tma
npm install
npm run build
# Caddy автоматически подхватит новые файлы
```

## Полезные команды

```bash
# Просмотр логов PM2
pm2 logs minto-backend

# Перезапуск backend
pm2 restart minto-backend

# Просмотр логов Caddy
sudo journalctl -u caddy -f

# Проверка статуса сервисов
pm2 status
sudo systemctl status caddy
sudo systemctl status postgresql
```

