# Быстрый старт на VPS

## 1. Проверка ошибки Telegram бота

```bash
# На VPS выполните:
cd /var/www/tma_education/backend
pm2 logs minto-backend --lines 100 | grep -A 10 "Error\|error\|ERROR"
```

Это покажет реальную ошибку. Чаще всего проблема в:
- Не сгенерирован Prisma Client
- Не применены миграции
- Проблема с подключением к БД

## 2. Исправление возможных проблем

```bash
cd /var/www/tma_education/backend

# 1. Убедитесь, что Prisma Client сгенерирован
npx prisma generate

# 2. Проверьте миграции
npx prisma migrate status

# 3. Если миграций нет, создайте и примените
npx prisma migrate dev --name init
# ИЛИ для production:
npx prisma migrate deploy

# 4. Пересоберите и перезапустите
npm run build
pm2 restart minto-backend
```

## 3. Настройка TMA Frontend

```bash
cd /var/www/tma_education/tma

# 1. Установите зависимости (если еще не установлены)
npm install

# 2. Создайте .env файл
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3000
EOF

# 3. Соберите production версию
npm run build

# 4. Проверьте, что dist папка создана
ls -la dist
```

## 4. Настройка Caddy (быстрый вариант для IP)

Если у вас нет домена, используйте IP адрес. Создайте простой Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Вставьте (замените `79.132.140.13` на ваш IP, если другой):

```
# Backend API на порту 3000
:3000 {
    reverse_proxy localhost:3000
}

# TMA Frontend на порту 5173 (или другой)
:5173 {
    root * /var/www/tma_education/tma/dist
    file_server
    try_files {path} /index.html
}
```

Или если хотите использовать один порт (например, 80):

```
:80 {
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

Примените конфигурацию:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 5. Обновление TMA_URL в backend

```bash
cd /var/www/tma_education/backend
nano .env
```

Измените `TMA_URL` на:
- Если используете IP: `TMA_URL="http://79.132.140.13:5173"`
- Если используете домен: `TMA_URL="https://tma.your-domain.com"`

Перезапустите backend:
```bash
pm2 restart minto-backend
```

## 6. Проверка

### Backend
```bash
curl http://localhost:3000/auth/telegram-webapp
# Должен вернуть ошибку валидации (это нормально, значит API работает)
```

### TMA
Откройте в браузере:
- `http://79.132.140.13:5173` (если настроили порт 5173)
- Или `http://79.132.140.13` (если настроили порт 80)

### Telegram Bot
1. Откройте бота в Telegram
2. Отправьте `/start`
3. Проверьте логи: `pm2 logs minto-backend`

## 7. Если бот все еще выдает ошибку

Выполните на VPS и пришлите вывод:

```bash
cd /var/www/tma_education/backend
pm2 logs minto-backend --lines 200 > /tmp/bot_logs.txt
cat /tmp/bot_logs.txt
```

Также проверьте:
```bash
# Проверка Prisma
npx prisma db pull

# Проверка подключения к БД
psql -U minto_user -d minto_db -c "SELECT 1;"
```

