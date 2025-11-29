#!/bin/bash

# Скрипт полного развёртывания Шага 2: Backend + TMA
# Включает миграцию Course и обновление TMA

set -e  # Остановка при ошибке

echo "🚀 Развёртывание: Шаг 2 - Course Entity + TMA Refactor"
echo "=========================================================="

# 1. Получить обновления
echo ""
echo "📥 Получение обновлений из Git..."
git pull

# 2. Применить миграцию БД
echo ""
echo "🗄️  Применение миграции базы данных..."
cd backend
npx prisma migrate deploy

# 3. Пересобрать backend
echo ""
echo "🔨 Сборка backend..."
npm run build

# 4. Перезапустить backend
echo ""
echo "🔄 Перезапуск backend..."
pm2 restart minto-backend

# 5. Пересобрать TMA
echo ""
echo "🎨 Сборка TMA (frontend)..."
cd ../tma
npm run build

# 6. Перезагрузить Caddy
echo ""
echo "🌐 Перезагрузка Caddy..."
sudo systemctl reload caddy

# 7. Проверить статусы
echo ""
echo "✅ Проверка статусов..."
echo ""
echo "Backend (PM2):"
pm2 status

echo ""
echo "Caddy:"
sudo systemctl status caddy --no-pager | head -5

echo ""
echo "🎉 Развёртывание завершено!"
echo ""
echo "📋 Проверьте работу:"
echo "1. Backend API: curl -I https://tma.n8nrgimprovise.space/api/course/modules"
echo "2. TMA: https://tma.n8nrgimprovise.space"
echo "3. Backend логи: pm2 logs minto-backend --lines 50"
echo ""
echo "📚 В TMA вкладка 'Курсы' теперь показывает список курсов,"
echo "   а при клике на курс - его модули."

