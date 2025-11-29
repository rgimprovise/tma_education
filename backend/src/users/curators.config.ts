/**
 * Конфигурация кураторов системы
 * Авторизация кураторов происходит по telegram_id
 * 
 * Примечание: 
 * - Ростислав (7017219152) создаётся через seed.ts с ролью ADMIN
 * - Эдуард (447493564) создаётся через seed.ts с ролью CURATOR
 * - При первой авторизации через Telegram оба будут распознаны как кураторы
 */
export const CURATORS_TELEGRAM_IDS = [
  '7017219152', // Ростислав (ADMIN)
  '447493564',  // Эдуард (CURATOR)
] as const;

/**
 * Проверяет, является ли пользователь куратором по telegram_id
 */
export function isCurator(telegramId: string): boolean {
  return CURATORS_TELEGRAM_IDS.includes(telegramId as any);
}

