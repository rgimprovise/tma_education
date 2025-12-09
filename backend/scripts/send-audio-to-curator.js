#!/usr/bin/env node

/**
 * Скрипт для отправки аудиофайлов от учеников куратору
 * 
 * Использование:
 *   node scripts/send-audio-to-curator.js [curatorTelegramId] [--all|--no-transcription|--users "name1,name2"]
 * 
 * Примеры:
 *   # Отправить все аудио без транскрипции конкретному куратору
 *   node scripts/send-audio-to-curator.js 123456789 --no-transcription
 * 
 *   # Отправить все аудио конкретному куратору
 *   node scripts/send-audio-to-curator.js 123456789 --all
 * 
 *   # Отправить аудио конкретного ученика (по submissionId)
 *   node scripts/send-audio-to-curator.js 123456789 --submission-id cmix6547y00019uw2wtzw94yx
 * 
 *   # Отправить аудио от конкретных учеников (по именам)
 *   node scripts/send-audio-to-curator.js 123456789 --users "Анна Фомина,Екатерина Кузьмина"
 */

const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

// Получаем переменные окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURATOR_TELEGRAM_ID = process.argv[2];
const FLAG = process.argv[3];
const FLAG_VALUE = process.argv[4];

if (!BOT_TOKEN) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
  process.exit(1);
}

if (!CURATOR_TELEGRAM_ID) {
  console.error('❌ Ошибка: Укажите Telegram ID куратора');
  console.log('\nИспользование:');
  console.log('  node scripts/send-audio-to-curator.js [curatorTelegramId] [--all|--no-transcription|--submission-id <id>]');
  process.exit(1);
}

/**
 * Отправить голосовое сообщение через Telegram Bot API
 */
async function sendVoice(telegramId, fileId, caption) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`;
    const data = JSON.stringify({
      chat_id: telegramId,
      voice: fileId,
      caption: caption,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.ok) {
            resolve(result);
          } else {
            reject(new Error(result.description || 'Unknown error'));
          }
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Найти и отправить аудиофайлы
 */
async function findAndSendAudio() {
  try {
    let submissions = [];

    if (FLAG === '--users' && FLAG_VALUE) {
      // Найти аудио от конкретных учеников по именам
      const userNames = FLAG_VALUE.split(',').map(name => name.trim());
      console.log(`🔍 Поиск учеников: ${userNames.join(', ')}`);
      
      // Найти пользователей по именам (ищем по firstName и lastName)
      const users = await prisma.user.findMany({
        where: {
          role: 'LEARNER',
          OR: userNames.map(name => {
            const parts = name.split(' ').filter(p => p.length > 0);
            if (parts.length === 1) {
              // Только имя или фамилия
              return {
                OR: [
                  { firstName: { contains: parts[0], mode: 'insensitive' } },
                  { lastName: { contains: parts[0], mode: 'insensitive' } },
                ],
              };
            } else {
              // Имя и фамилия
              return {
                AND: [
                  { firstName: { contains: parts[0], mode: 'insensitive' } },
                  { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
                ],
              };
            }
          }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      if (users.length === 0) {
        console.error('❌ Ученики не найдены');
        process.exit(1);
      }

      console.log(`✅ Найдено учеников: ${users.length}`);
      users.forEach(u => {
        console.log(`   - ${u.firstName} ${u.lastName} (ID: ${u.id})`);
      });

      const userIds = users.map(u => u.id);

      submissions = await prisma.submission.findMany({
        where: {
          answerFileId: { not: null },
          answerType: { in: ['AUDIO', 'VIDEO'] },
          userId: { in: userIds },
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          step: {
            select: {
              title: true,
              index: true,
            },
          },
          module: {
            select: {
              title: true,
              index: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (FLAG === '--submission-id' && FLAG_VALUE) {
      // Отправить конкретный submission
      const submission = await prisma.submission.findUnique({
        where: { id: FLAG_VALUE },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          step: {
            select: {
              title: true,
              index: true,
            },
          },
          module: {
            select: {
              title: true,
              index: true,
            },
          },
        },
      });

      if (!submission) {
        console.error(`❌ Submission ${SUBMISSION_ID} не найден`);
        process.exit(1);
      }

      if (!submission.answerFileId) {
        console.error(`❌ У submission ${SUBMISSION_ID} нет аудиофайла`);
        process.exit(1);
      }

      submissions = [submission];
    } else if (FLAG === '--no-transcription') {
      // Найти все аудио без транскрипции
      submissions = await prisma.submission.findMany({
        where: {
          answerFileId: { not: null },
          answerType: { in: ['AUDIO', 'VIDEO'] },
          OR: [
            { answerText: null },
            { answerText: '' },
          ],
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          step: {
            select: {
              title: true,
              index: true,
            },
          },
          module: {
            select: {
              title: true,
              index: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (FLAG === '--all') {
      // Найти все аудио
      submissions = await prisma.submission.findMany({
        where: {
          answerFileId: { not: null },
          answerType: { in: ['AUDIO', 'VIDEO'] },
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          step: {
            select: {
              title: true,
              index: true,
            },
          },
          module: {
            select: {
              title: true,
              index: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      console.error('❌ Ошибка: Укажите флаг --all, --no-transcription, --submission-id <id> или --users "name1,name2"');
      process.exit(1);
    }

    if (submissions.length === 0) {
      console.log('✅ Аудиофайлы не найдены');
      return;
    }

    console.log(`📦 Найдено аудиофайлов: ${submissions.length}`);
    console.log(`📤 Отправка куратору ${CURATOR_TELEGRAM_ID}...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const submission of submissions) {
      const caption = 
        `🎤 Голосовое сообщение ученика\n\n` +
        `👤 Ученик: ${submission.user.firstName || ''} ${submission.user.lastName || ''}\n` +
        `📚 Модуль ${submission.module.index || '?'}: ${submission.module.title || '?'}\n` +
        `📝 Задание ${submission.step.index || '?'}: ${submission.step.title || '?'}\n` +
        `🆔 Submission ID: ${submission.id}` +
        (submission.answerText ? `\n📄 Транскрипт: ${submission.answerText.substring(0, 100)}...` : '\n⚠️ Транскрипт отсутствует');

      try {
        await sendVoice(CURATOR_TELEGRAM_ID, submission.answerFileId, caption);
        console.log(`✅ Отправлено: ${submission.id} (${submission.user.firstName} ${submission.user.lastName})`);
        successCount++;
        
        // Небольшая задержка между отправками, чтобы не превысить лимиты Telegram
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Ошибка при отправке ${submission.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Итого:`);
    console.log(`   ✅ Успешно: ${successCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск
findAndSendAudio();

