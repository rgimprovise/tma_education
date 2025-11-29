#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🎤 DEPLOYMENT: Audio Submission Feature Part 2 - Processing & Transcription
# ═══════════════════════════════════════════════════════════════════════════════
#
# Этот скрипт развёртывает Часть 2 аудио-сдачи заданий:
# - Обработка голосовых/видео сообщений в Telegram боте
# - Транскрибация через OpenAI Whisper
# - AI-оценка транскрипта
# - Обновление Submission с результатами
# - Уведомления куратору и ученику
# - Кнопка "🎤 Сдать голосовым" в TMA
#
# ТРЕБОВАНИЯ:
# - Часть 1 уже развёрнута (DEPLOY_AUDIO_SUBMISSION_PART1.sh)
# - OPENAI_API_KEY в backend/.env
# - Telegram бот запущен
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Выход при ошибке

PROJECT_ROOT="/var/www/tma_education"
BACKEND_DIR="$PROJECT_ROOT/backend"
TMA_DIR="$PROJECT_ROOT/tma"

echo "════════════════════════════════════════════════════════════════"
echo "🎤 Развёртывание Audio Submission Feature Part 2"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ───────────────────────────────────────────────────────────────────
# Шаг 1: Backend - Сборка
# ───────────────────────────────────────────────────────────────────

echo "📦 Шаг 1: Сборка backend..."
cd "$BACKEND_DIR"

# Проверяем, что зависимости установлены
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules не найдены, запускаем npm install..."
  npm install
fi

# Генерируем Prisma Client (на случай изменений в schema)
echo "🔄 Генерация Prisma Client..."
npx prisma generate

# Собираем backend
echo "🔨 Сборка backend..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Backend собран успешно"
else
  echo "❌ Ошибка при сборке backend"
  exit 1
fi

echo ""

# ───────────────────────────────────────────────────────────────────
# Шаг 2: Перезапуск backend
# ───────────────────────────────────────────────────────────────────

echo "🔄 Шаг 2: Перезапуск backend через PM2..."

pm2 restart minto-backend

# Даём время на запуск
sleep 3

# Проверяем статус
pm2 status minto-backend

echo "✅ Backend перезапущен"
echo ""

# ───────────────────────────────────────────────────────────────────
# Шаг 3: TMA - Сборка
# ───────────────────────────────────────────────────────────────────

echo "📦 Шаг 3: Сборка TMA..."
cd "$TMA_DIR"

# Проверяем, что зависимости установлены
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules не найдены, запускаем npm install..."
  npm install
fi

# Собираем TMA
echo "🔨 Сборка TMA..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ TMA собран успешно"
else
  echo "❌ Ошибка при сборке TMA"
  exit 1
fi

echo ""

# ───────────────────────────────────────────────────────────────────
# Шаг 4: Проверка Caddy
# ───────────────────────────────────────────────────────────────────

echo "🌐 Шаг 4: Перезапуск Caddy (если нужно)..."

# Проверяем конфигурацию Caddy
sudo caddy validate --config /etc/caddy/Caddyfile

if [ $? -eq 0 ]; then
  echo "✅ Caddy конфигурация валидна"
  # Перезагружаем Caddy для применения новых статических файлов TMA
  sudo systemctl reload caddy
  echo "✅ Caddy перезагружен"
else
  echo "⚠️  Ошибка в конфигурации Caddy"
fi

echo ""

# ───────────────────────────────────────────────────────────────────
# Шаг 5: Проверка логов backend
# ───────────────────────────────────────────────────────────────────

echo "📋 Шаг 5: Проверка логов backend..."
echo ""
echo "────────────────────────────────────────────────────────────────"
pm2 logs minto-backend --lines 30 --nostream
echo "────────────────────────────────────────────────────────────────"
echo ""

# ───────────────────────────────────────────────────────────────────
# Итоговая информация
# ───────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════════"
echo "✅ Развёртывание Audio Submission Part 2 завершено!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📝 Что изменилось:"
echo ""
echo "Backend:"
echo "  • AiService.transcribeAudio() - транскрибация через Whisper"
echo "  • TelegramService - обработчики voice/video_note"
echo "  • TelegramService.getFileUrl() - скачивание файлов из Telegram"
echo "  • AudioSubmissionsService.processVoiceSubmission() - полная обработка"
echo ""
echo "Frontend (TMA):"
echo "  • StepPage - кнопка '🎤 Сдать голосовым сообщением'"
echo "  • handleStartAudioSubmission() - инициация аудио-сдачи"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🧪 Тестирование:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. Создайте шаг с expectedAnswer = AUDIO/VIDEO"
echo "2. Откройте модуль для ученика (куратор)"
echo "3. В TMA нажмите '🎤 Сдать голосовым сообщением'"
echo "4. В Telegram отправьте голосовое **ответом** на инструкцию"
echo "5. Дождитесь обработки (5-20 секунд)"
echo "6. Проверьте уведомление ученику: 'Оценка: X/10'"
echo "7. Проверьте уведомление куратору"
echo "8. В TMA обновите StepPage - должен быть статус 'AI_REVIEWED'"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 Мониторинг:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Логи backend:"
echo "  pm2 logs minto-backend --lines 100"
echo ""
echo "Поиск ошибок транскрибации:"
echo "  pm2 logs minto-backend | grep 'transcrib'"
echo ""
echo "Поиск ошибок обработки голосовых:"
echo "  pm2 logs minto-backend | grep 'voice'"
echo ""
echo "Статус PM2:"
echo "  pm2 status"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "⚙️  Если что-то не работает:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. Проверить OPENAI_API_KEY:"
echo "   cat $BACKEND_DIR/.env | grep OPENAI_API_KEY"
echo ""
echo "2. Проверить, что бот работает:"
echo "   pm2 logs minto-backend | grep 'Telegram Bot started'"
echo ""
echo "3. Проверить обработчики бота:"
echo "   pm2 logs minto-backend | grep 'Received voice'"
echo ""
echo "4. Проверить Whisper API:"
echo "   pm2 logs minto-backend | grep 'Starting transcription'"
echo ""
echo "5. Перезапустить backend:"
echo "   pm2 restart minto-backend"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Документация: AUDIO_SUBMISSION_FEATURE_PART2.md"
echo ""
echo "🎉 Готово! Аудио-сдача заданий полностью работает!"
echo ""

