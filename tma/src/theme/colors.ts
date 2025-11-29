/**
 * Цветовая палитра приложения
 * Интегрируется с Telegram WebApp theme если доступна
 */

export interface ThemeColors {
  // Основные цвета
  primary: string;
  primarySoft: string;
  primaryHover: string;
  
  // Фоны
  background: string;
  surface: string;
  surfaceHover: string;
  
  // Текст
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  
  // Границы и разделители
  border: string;
  
  // Статусы
  success: string;
  warning: string;
  error: string;
  info: string;
}

// Дефолтная светлая тема
export const defaultTheme: ThemeColors = {
  primary: '#667eea',
  primarySoft: '#edf2f7',
  primaryHover: '#5568d3',
  
  background: '#f7fafc',
  surface: '#ffffff',
  surfaceHover: '#f7fafc',
  
  textPrimary: '#1a202c',
  textSecondary: '#718096',
  textOnPrimary: '#ffffff',
  
  border: '#e2e8f0',
  
  success: '#48bb78',
  warning: '#ed8936',
  error: '#f56565',
  info: '#4299e1',
};

/**
 * Получить тему из Telegram WebApp или вернуть дефолтную
 */
export function getTelegramTheme(): ThemeColors {
  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  const tg = window.Telegram?.WebApp;
  if (!tg?.themeParams) {
    return defaultTheme;
  }

  const params = tg.themeParams;

  // Используем цвета из Telegram, если они доступны
  // Note: некоторые свойства могут отсутствовать в типизации, но существовать в runtime
  const themeParams = params as any;
  
  return {
    primary: params.button_color || defaultTheme.primary,
    primarySoft: params.secondary_bg_color || defaultTheme.primarySoft,
    primaryHover: params.button_color || defaultTheme.primaryHover,
    
    background: params.bg_color || defaultTheme.background,
    surface: params.secondary_bg_color || defaultTheme.surface,
    surfaceHover: lighten(params.secondary_bg_color || defaultTheme.surface, 0.03),
    
    textPrimary: params.text_color || defaultTheme.textPrimary,
    textSecondary: params.hint_color || defaultTheme.textSecondary,
    textOnPrimary: params.button_text_color || defaultTheme.textOnPrimary,
    
    border: themeParams.section_separator_color || defaultTheme.border,
    
    success: defaultTheme.success,
    warning: defaultTheme.warning,
    error: themeParams.destructive_text_color || defaultTheme.error,
    info: params.link_color || defaultTheme.info,
  };
}

/**
 * Применить тему к CSS переменным
 */
export function applyTheme(theme: ThemeColors) {
  const root = document.documentElement;
  
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-primary-soft', theme.primarySoft);
  root.style.setProperty('--color-primary-hover', theme.primaryHover);
  
  root.style.setProperty('--color-background', theme.background);
  root.style.setProperty('--color-surface', theme.surface);
  root.style.setProperty('--color-surface-hover', theme.surfaceHover);
  
  root.style.setProperty('--color-text-primary', theme.textPrimary);
  root.style.setProperty('--color-text-secondary', theme.textSecondary);
  root.style.setProperty('--color-text-on-primary', theme.textOnPrimary);
  
  root.style.setProperty('--color-border', theme.border);
  
  root.style.setProperty('--color-success', theme.success);
  root.style.setProperty('--color-warning', theme.warning);
  root.style.setProperty('--color-error', theme.error);
  root.style.setProperty('--color-info', theme.info);
}

/**
 * Осветлить цвет на заданный процент
 */
function lighten(color: string, amount: number): string {
  // Простая реализация для hex цветов
  if (color.startsWith('#')) {
    const num = parseInt(color.slice(1), 16);
    const r = Math.min(255, Math.floor((num >> 16) + 255 * amount));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + 255 * amount));
    const b = Math.min(255, Math.floor((num & 0x0000FF) + 255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
  return color;
}

