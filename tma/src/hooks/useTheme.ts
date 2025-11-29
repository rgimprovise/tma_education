import { useEffect } from 'react';
import { getTelegramTheme, applyTheme } from '../theme/colors';

/**
 * Хук для инициализации темы приложения
 * Применяет Telegram WebApp theme или дефолтную тему
 */
export function useTheme() {
  useEffect(() => {
    const theme = getTelegramTheme();
    applyTheme(theme);
  }, []);
}

