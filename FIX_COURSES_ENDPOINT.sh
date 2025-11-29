#!/bin/bash

# Быстрое исправление: пересборка backend для endpoints курсов
# Проблема: CourseCoursesController и CoursesService не были скомпилированы

set -e

echo "🔧 Исправление: пересборка backend для /admin/courses"
echo "========================================================"

# 1. Получить последние изменения
echo ""
echo "📥 Получение обновлений..."
git pull

# 2. Обновить Prisma Client (сгенерировать типы для новой модели Course)
echo ""
echo "🔄 Обновление Prisma Client..."
cd backend
npx prisma generate

# 3. Пересобрать backend
echo ""
echo "🔨 Сборка backend..."
npm run build

# 4. Перезапустить backend
echo ""
echo "🔄 Перезапуск backend..."
pm2 restart minto-backend

# 5. Проверить логи
echo ""
echo "📋 Последние логи backend:"
pm2 logs minto-backend --lines 20 --nostream

echo ""
echo "✅ Готово!"
echo ""
echo "Проверьте endpoints:"
echo "  curl -I https://tma.n8nrgimprovise.space/api/admin/courses"
echo ""
echo "Теперь TMA должна работать корректно на вкладке 'Курсы'"

