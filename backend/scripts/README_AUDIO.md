# Скрипт для отправки аудиофайлов куратору

## Описание

Скрипт `send-audio-to-curator.js` позволяет найти и отправить аудиофайлы от учеников куратору через Telegram бота.

## Использование на VPS

### 1. Найти все аудио без транскрипции

Отправить все аудиофайлы, у которых нет транскрипции (answerText пустой или null):

```bash
cd /var/www/tma_education/backend
source .env  # Или export TELEGRAM_BOT_TOKEN="..."
node scripts/send-audio-to-curator.js YOUR_TELEGRAM_ID --no-transcription
```

### 2. Отправить все аудиофайлы

Отправить все аудиофайлы (с транскрипцией и без):

```bash
cd /var/www/tma_education/backend
source .env
node scripts/send-audio-to-curator.js YOUR_TELEGRAM_ID --all
```

### 3. Отправить конкретный аудиофайл

Отправить аудиофайл конкретного submission:

```bash
cd /var/www/tma_education/backend
source .env
node scripts/send-audio-to-curator.js YOUR_TELEGRAM_ID --submission-id cmix6547y00019uw2wtzw94yx
```

## Как узнать свой Telegram ID

1. Напишите боту [@userinfobot](https://t.me/userinfobot) в Telegram
2. Бот вернет ваш Telegram ID (число, например: `123456789`)

## Примеры команд

```bash
# Отправить все аудио без транскрипции
cd /var/www/tma_education/backend
export TELEGRAM_BOT_TOKEN="8580479721:AAF3Pn_h623BNYrAnJBJjD0LFpaYu13A-Mw"
node scripts/send-audio-to-curator.js 123456789 --no-transcription

# Отправить конкретный файл
node scripts/send-audio-to-curator.js 123456789 --submission-id cmix6547y00019uw2wtzw94yx
```

## Что делает скрипт

1. Подключается к базе данных через Prisma
2. Находит submissions по критериям:
   - `--no-transcription`: аудио без транскрипции (answerText пустой или null)
   - `--all`: все аудиофайлы
   - `--submission-id <id>`: конкретный submission
3. Отправляет каждый аудиофайл куратору в Telegram с информацией:
   - Имя ученика
   - Модуль и задание
   - Submission ID
   - Транскрипт (если есть)

## Примечания

- Скрипт делает задержку 500ms между отправками, чтобы не превысить лимиты Telegram API
- Если файл не найден или произошла ошибка, скрипт продолжит отправку остальных файлов
- В конце выводится статистика: сколько успешно отправлено, сколько ошибок

