import * as crypto from 'crypto';

/**
 * Валидация данных из Telegram WebApp
 * Согласно https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * 
 * @param initData - строка initData из window.Telegram.WebApp
 * @param botToken - токен бота из конфигурации
 * @returns true если данные валидны, false иначе
 */
export function validateTelegramWebAppData(
  initData: string,
  botToken: string,
): boolean {
  try {
    // Парсим initData в URLSearchParams
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return false;
    }

    // Удаляем hash из параметров для проверки
    params.delete('hash');

    // Создаём data-check-string:
    // параметры сортируются по ключу и объединяются в формате key=value
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Создаём секретный ключ: HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем HMAC-SHA256 с секретным ключом
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем с полученным hash
    if (computedHash !== hash) {
      return false;
    }

    // Проверяем timestamp (auth_date) - данные не должны быть старше 24 часов
    const authDate = params.get('auth_date');
    if (!authDate) {
      return false;
    }

    const authTimestamp = parseInt(authDate, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 часа в секундах

    if (currentTimestamp - authTimestamp > maxAge) {
      return false; // Данные устарели
    }

    return true;
  } catch (error) {
    // Любая ошибка парсинга/валидации = false
    console.error('Telegram WebApp validation error:', error);
    return false;
  }
}

