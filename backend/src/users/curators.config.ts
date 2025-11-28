/**
 * Конфигурация кураторов системы
 * Авторизация кураторов происходит по telegram_id
 */
export const CURATORS_TELEGRAM_IDS = [
  '7017219152', // Ростислав
  '447493564',  // Эдуард
] as const;

/**
 * Проверяет, является ли пользователь куратором по telegram_id
 */
export function isCurator(telegramId: string): boolean {
  return CURATORS_TELEGRAM_IDS.includes(telegramId as any);
}

