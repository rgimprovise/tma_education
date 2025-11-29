#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Исправление: применение миграции resubmission полей${NC}"
echo "=========================================="
echo ""

# 1. Создать миграцию на VPS
echo -e "${BLUE}📝 Создание миграции для resubmission полей...${NC}"
cd backend

# Создаём SQL миграцию вручную
mkdir -p prisma/migrations/20251129100000_add_resubmission_fields

cat > prisma/migrations/20251129100000_add_resubmission_fields/migration.sql << 'SQL'
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "resubmissionRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resubmissionRequestedAt" TIMESTAMP(3);
SQL

echo -e "${GREEN}✅ Файл миграции создан${NC}"
echo ""

# 2. Применить миграцию
echo -e "${BLUE}🗄️  Применение миграции к БД...${NC}"
npx prisma migrate deploy
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при применении миграции${NC}"
  echo ""
  echo -e "${YELLOW}Попробуйте применить SQL вручную:${NC}"
  echo "sudo -u postgres psql -d minto_db << 'SQLEND'"
  echo "ALTER TABLE \"Submission\" ADD COLUMN \"resubmissionRequested\" BOOLEAN NOT NULL DEFAULT false;"
  echo "ALTER TABLE \"Submission\" ADD COLUMN \"resubmissionRequestedAt\" TIMESTAMP(3);"
  echo "SQLEND"
  exit 1
fi
echo ""

# 3. Обновить Prisma Client
echo -e "${BLUE}🔄 Обновление Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при генерации Prisma Client${NC}"
  exit 1
fi
echo ""

# 4. Сборка backend
echo -e "${BLUE}🔨 Сборка backend...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при сборке backend${NC}"
  exit 1
fi
echo ""

# 5. Перезапуск backend
echo -e "${BLUE}🔄 Перезапуск backend...${NC}"
pm2 restart minto-backend
echo ""

# 6. Проверка статуса
echo -e "${BLUE}📊 Статус процессов PM2...${NC}"
pm2 status
echo ""

echo -e "${GREEN}✅ Исправление завершено!${NC}"
echo ""
echo -e "${BLUE}Что было сделано:${NC}"
echo "  1. ✅ Создан файл миграции для resubmission полей"
echo "  2. ✅ Применена миграция к БД"
echo "  3. ✅ Обновлён Prisma Client"
echo "  4. ✅ Пересобран backend"
echo "  5. ✅ Перезапущен backend"
echo ""
echo -e "${YELLOW}Теперь можно запустить полное развёртывание:${NC}"
echo "bash DEPLOY_CURATOR_SUBMISSION_REVIEW.sh"
