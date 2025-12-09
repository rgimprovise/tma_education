#!/usr/bin/env node

/**
 * Скрипт для поиска и отправки аудиофайлов, которые были отправлены без reply
 * 
 * Использование:
 *   node scripts/find-missing-audio.js [curatorTelegramId] --users "name1,name2"
 * 
 * Скрипт ищет submissions со статусом SENT, answerType = AUDIO/VIDEO, но answerFileId = null
 * и пытается найти соответствующие голосовые сообщения в истории Telegram
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
  console.log('  node scripts/find-missing-audio.js [curatorTelegramId] --users "name1,name2"');
  process.exit(1);
}

/**
 * Получить обновления от Telegram Bot API
 */
async function getUpdates(offset = 0) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&limit=100`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve(result);
          } else {
            reject(new Error(result.description || 'Unknown error'));
          }
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    }).on('error', reject);
  });
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
 * Найти голосовые сообщения в истории обновлений
 */
async function findVoiceMessagesInHistory(userTelegramIds, startDate, endDate) {
  console.log('🔍 Поиск голосовых сообщений в истории Telegram...');
  console.log(`   Период: ${startDate.toISOString()} - ${endDate.toISOString()}`);
  
  const voiceMessages = [];
  let offset = 0;
  let hasMore = true;
  let checkedCount = 0;

  while (hasMore) {
    try {
      const updates = await getUpdates(offset);
      const messages = updates.result || [];
      
      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      for (const update of messages) {
        checkedCount++;
        const message = update.message;
        
        if (!message) continue;
        
        const messageDate = new Date(message.date * 1000);
        if (messageDate < startDate || messageDate > endDate) {
          continue;
        }

        const fromId = message.from?.id?.toString();
        if (!fromId || !userTelegramIds.includes(fromId)) {
          continue;
        }

        // Проверяем голосовые сообщения
        if (message.voice) {
          voiceMessages.push({
            fileId: message.voice.file_id,
            userId: fromId,
            messageId: message.message_id,
            date: messageDate,
            duration: message.voice.duration,
            fileSize: message.voice.file_size,
          });
        }

        // Проверяем видео-заметки
        if (message.video_note) {
          voiceMessages.push({
            fileId: message.video_note.file_id,
            userId: fromId,
            messageId: message.message_id,
            date: messageDate,
            duration: message.video_note.duration,
            fileSize: message.video_note.length,
            type: 'video_note',
          });
        }
      }

      // Обновляем offset для следующей итерации
      if (messages.length > 0) {
        offset = Math.max(...messages.map(m => m.update_id)) + 1;
      } else {
        hasMore = false;
      }

      // Ограничение: проверяем максимум 10000 обновлений
      if (checkedCount >= 10000) {
        console.log(`   ⚠️  Достигнут лимит проверки (10000 обновлений)`);
        hasMore = false;
      }

      // Небольшая задержка, чтобы не превысить лимиты API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Ошибка при получении обновлений: ${error.message}`);
      hasMore = false;
    }
  }

  console.log(`   ✅ Проверено обновлений: ${checkedCount}`);
  console.log(`   ✅ Найдено голосовых сообщений: ${voiceMessages.length}`);
  
  return voiceMessages;
}

/**
 * Найти и отправить аудиофайлы
 */
async function findAndSendMissingAudio() {
  try {
    if (FLAG !== '--users' || !FLAG_VALUE) {
      console.error('❌ Ошибка: Используйте флаг --users "name1,name2"');
      process.exit(1);
    }

    const userNames = FLAG_VALUE.split(',').map(name => name.trim());
    console.log(`🔍 Поиск учеников: ${userNames.join(', ')}\n`);

    // Найти пользователей по именам
    const users = await prisma.user.findMany({
      where: {
        role: 'LEARNER',
        OR: userNames.map(name => {
          const parts = name.split(' ').filter(p => p.length > 0);
          if (parts.length === 1) {
            return {
              OR: [
                { firstName: { contains: parts[0], mode: 'insensitive' } },
                { lastName: { contains: parts[0], mode: 'insensitive' } },
              ],
            };
          } else {
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
        telegramId: true,
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
      console.log(`   - ${u.firstName} ${u.lastName} (Telegram ID: ${u.telegramId || 'нет'})`);
    });

    const userIds = users.map(u => u.id);
    const userTelegramIds = users
      .map(u => u.telegramId)
      .filter(id => id !== null)
      .map(id => id.toString());

    if (userTelegramIds.length === 0) {
      console.error('❌ У учеников нет Telegram ID');
      process.exit(1);
    }

    // Найти submissions без answerFileId
    const missingAudioSubmissions = await prisma.submission.findMany({
      where: {
        userId: { in: userIds },
        answerType: { in: ['AUDIO', 'VIDEO'] },
        answerFileId: null,
        status: 'SENT',
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            telegramId: true,
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

    console.log(`\n📦 Найдено submissions без answerFileId: ${missingAudioSubmissions.length}`);

    if (missingAudioSubmissions.length === 0) {
      console.log('✅ Все аудиофайлы найдены или submissions не требуют аудио');
      return;
    }

    // Показываем информацию о submissions
    missingAudioSubmissions.forEach(sub => {
      console.log(`\n   Submission: ${sub.id}`);
      console.log(`   Ученик: ${sub.user.firstName} ${sub.user.lastName} (TG: ${sub.user.telegramId})`);
      console.log(`   Модуль: ${sub.module.index} - ${sub.module.title}`);
      console.log(`   Задание: ${sub.step.index} - ${sub.step.title}`);
      console.log(`   Создан: ${sub.createdAt.toISOString()}`);
    });

    // Ищем голосовые сообщения в истории Telegram
    const startDate = new Date(Math.min(...missingAudioSubmissions.map(s => s.createdAt.getTime())));
    const endDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const voiceMessages = await findVoiceMessagesInHistory(userTelegramIds, startDate, endDate);

    if (voiceMessages.length === 0) {
      console.log('\n❌ Голосовые сообщения не найдены в истории Telegram');
      console.log('   Возможные причины:');
      console.log('   - Сообщения были отправлены слишком давно (Telegram хранит обновления ограниченное время)');
      console.log('   - Сообщения были отправлены не этим ботом');
      console.log('   - Сообщения были удалены');
      return;
    }

    console.log(`\n📤 Отправка найденных аудиофайлов куратору ${CURATOR_TELEGRAM_ID}...\n`);

    let successCount = 0;
    let errorCount = 0;

    // Группируем голосовые сообщения по пользователю и времени
    for (const submission of missingAudioSubmissions) {
      const userTelegramId = submission.user.telegramId?.toString();
      if (!userTelegramId) continue;

      // Находим ближайшее по времени голосовое сообщение от этого пользователя
      const submissionTime = submission.createdAt.getTime();
      const matchingVoice = voiceMessages
        .filter(vm => vm.userId === userTelegramId)
        .sort((a, b) => Math.abs(a.date.getTime() - submissionTime) - Math.abs(b.date.getTime() - submissionTime))[0];

      if (!matchingVoice) {
        console.log(`⚠️  Не найдено голосовое сообщение для submission ${submission.id}`);
        continue;
      }

      const caption = 
        `🎤 Голосовое сообщение ученика (найдено в истории)\n\n` +
        `👤 Ученик: ${submission.user.firstName} ${submission.user.lastName}\n` +
        `📚 Модуль ${submission.module.index}: ${submission.module.title}\n` +
        `📝 Задание ${submission.step.index}: ${submission.step.title}\n` +
        `🆔 Submission ID: ${submission.id}\n` +
        `📅 Дата сообщения: ${matchingVoice.date.toISOString()}`;

      try {
        await sendVoice(CURATOR_TELEGRAM_ID, matchingVoice.fileId, caption);
        console.log(`✅ Отправлено: ${submission.id} (${submission.user.firstName} ${submission.user.lastName})`);
        successCount++;
        
        // Обновляем submission с найденным fileId
        await prisma.submission.update({
          where: { id: submission.id },
          data: { answerFileId: matchingVoice.fileId },
        });
        
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
findAndSendMissingAudio();

