#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Развёртывание функционала аудио-сдачи (Часть 1: Инициация)${NC}"
echo "=========================================="
echo ""

# 1. Git pull
echo -e "${BLUE}📥 Получение обновлений из Git...${NC}"
git pull
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при получении обновлений${NC}"
  exit 1
fi
echo ""

# 2. Создание миграции БД
echo -e "${BLUE}🗄️  Создание миграции для telegramPromptMessageId...${NC}"
cd backend

# Создаём миграцию вручную
mkdir -p prisma/migrations/20251129110000_add_telegram_prompt_message_id

cat > prisma/migrations/20251129110000_add_telegram_prompt_message_id/migration.sql << 'SQL'
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "telegramPromptMessageId" INTEGER;
SQL

echo -e "${GREEN}✅ Файл миграции создан${NC}"
echo ""

# 3. Применить миграцию
echo -e "${BLUE}🗄️  Применение миграции к БД...${NC}"
npx prisma migrate deploy
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Миграция не применена через migrate deploy.${NC}"
  echo -e "${YELLOW}Попробуйте применить SQL вручную:${NC}"
  echo "sudo -u postgres psql -d minto_db << 'SQLEND'"
  echo 'ALTER TABLE "Submission" ADD COLUMN "telegramPromptMessageId" INTEGER;'
  echo "SQLEND"
  echo ""
  echo -e "${YELLOW}Затем продолжите:${NC}"
  echo "npx prisma generate"
  echo "npm run build"
  echo "pm2 restart minto-backend"
  exit 1
fi
echo ""

# 4. Генерация Prisma Client
echo -e "${BLUE}🔄 Обновление Prisma Client...${NC}"
npx prisma generate
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при генерации Prisma Client${NC}"
  exit 1
fi
echo ""

# 5. Сборка backend
echo -e "${BLUE}🔨 Сборка backend...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Ошибка при сборке backend${NC}"
  exit 1
fi
echo ""

# 6. Перезапуск backend
echo -e "${BLUE}🔄 Перезапуск backend...${NC}"
pm2 restart minto-backend
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Не удалось перезапустить через PM2. Запустите вручную.${NC}"
fi
echo ""

# 7. Статус PM2
echo -e "${BLUE}📊 Статус процессов PM2...${NC}"
pm2 status
echo ""

# 8. Проверка доступности API
echo -e "${BLUE}🔍 Проверка доступности backend API...${NC}"
curl -I https://tma.n8nrgimprovise.space/api/auth/telegram-webapp 2>/dev/null | head -n 1
echo ""

# 9. Последние логи
echo -e "${BLUE}📋 Последние логи backend...${NC}"
pm2 logs minto-backend --lines 30 --nostream
echo ""

echo -e "${GREEN}✅ Развёртывание Части 1 завершено!${NC}"
echo ""
echo -e "${BLUE}📝 Что было обновлено:${NC}"
echo "  1. ✅ Backend: Добавлено поле telegramPromptMessageId в Submission"
echo "  2. ✅ Backend: Создан AudioSubmissionsController"
echo "  3. ✅ Backend: Создан AudioSubmissionsService.startAudioSubmission()"
echo "  4. ✅ Backend: Зарегистрирован в SubmissionsModule"
echo "  5. ✅ Backend: Новый эндпоинт POST /audio-submissions/start"
echo ""
echo -e "${BLUE}🧪 Как проверить (Часть 1):${NC}"
echo ""
echo "Через curl:"
echo '  curl -X POST https://tma.n8nrgimprovise.space/api/audio-submissions/start \'
echo '    -H "Authorization: Bearer YOUR_TOKEN" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"stepId": "STEP_ID", "moduleId": "MODULE_ID"}'"'"
echo ""
echo "Ожидаемый результат:"
echo "  - 200 OK с submissionId и telegramMessageId"
echo "  - В Telegram пришло сообщение с инструкцией"
echo ""
echo -e "${YELLOW}⏭️  Следующий шаг: Часть 2 (обработка аудио, транскрибация, AI-оценка)${NC}"
echo -e "${YELLOW}📖 Подробности: см. AUDIO_SUBMISSION_FEATURE_PART1.md${NC}"

