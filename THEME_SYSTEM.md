# Система унифицированных цветов TMA

## Обзор

Реализована единая цветовая схема для Telegram Mini App с интеграцией Telegram WebApp theme parameters. Все цвета вынесены в CSS переменные для простоты поддержки и консистентности дизайна.

---

## Архитектура

### 1. Файлы системы темы

**`tma/src/theme/colors.ts`**
- Определяет цветовую палитру приложения
- Функция `getTelegramTheme()`: получает цвета из Telegram WebApp или возвращает дефолтные
- Функция `applyTheme()`: применяет тему к CSS переменным
- Интерфейс `ThemeColors`: типизация всех цветов

**`tma/src/theme/theme.css`**
- CSS переменные для всех цветов
- Глобальные стили приложения
- Утилитные классы (text-primary, bg-surface и т.д.)

**`tma/src/hooks/useTheme.ts`**
- React хук для инициализации темы
- Вызывается в `App.tsx` при монтировании приложения

---

## Цветовая палитра

### Основные цвета

```css
--color-primary: #667eea           /* Основной бренд цвет (синий) */
--color-primary-soft: #edf2f7      /* Светлый фон в стиле primary */
--color-primary-hover: #5568d3     /* Цвет при наведении */
```

### Фоны

```css
--color-background: #f7fafc        /* Общий фон приложения */
--color-surface: #ffffff           /* Фон карточек и блоков */
--color-surface-hover: #f7fafc     /* Фон при наведении */
```

### Текст

```css
--color-text-primary: #1a202c      /* Основной текст (тёмный) */
--color-text-secondary: #718096    /* Приглушённый текст */
--color-text-on-primary: #ffffff   /* Текст на primary фоне (белый) */
```

### Границы и разделители

```css
--color-border: #e2e8f0            /* Цвет границ */
```

### Статусы

```css
--color-success: #48bb78           /* Успех (зелёный) */
--color-warning: #ed8936           /* Предупреждение (оранжевый) */
--color-error: #f56565             /* Ошибка (красный) */
--color-info: #4299e1              /* Информация (голубой) */
```

### Дополнительные переменные

```css
/* Тени */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)

/* Радиусы */
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px

/* Переходы */
--transition-fast: 0.15s ease
--transition-base: 0.2s ease
--transition-slow: 0.3s ease
```

---

## Интеграция с Telegram WebApp

### Автоматическое определение темы

Приложение автоматически использует цвета из Telegram, если они доступны:

```typescript
const tg = window.Telegram?.WebApp;
if (tg?.themeParams) {
  // Используем цвета из Telegram
  primary = tg.themeParams.button_color;
  background = tg.themeParams.bg_color;
  textPrimary = tg.themeParams.text_color;
  // ...
} else {
  // Fallback на дефолтные цвета
}
```

### Mapping Telegram → App Colors

| Telegram param | App variable |
|---|---|
| `button_color` | `--color-primary` |
| `button_text_color` | `--color-text-on-primary` |
| `bg_color` | `--color-background` |
| `secondary_bg_color` | `--color-surface` |
| `text_color` | `--color-text-primary` |
| `hint_color` | `--color-text-secondary` |
| `link_color` | `--color-info` |
| `destructive_text_color` | `--color-error` |
| `section_separator_color` | `--color-border` |

---

## Использование в CSS

### Правильно ✅

```css
.my-card {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.my-card:hover {
  box-shadow: var(--shadow-lg);
}

.primary-button {
  background: var(--color-primary);
  color: var(--color-text-on-primary); /* Белый текст на синей кнопке */
}

.primary-button:hover {
  background: var(--color-primary-hover);
}
```

### Неправильно ❌

```css
.my-card {
  background: #ffffff;              /* Хардкод цвета */
  color: #1a202c;                   /* Хардкод цвета */
  border: 1px solid #e2e8f0;        /* Хардкод цвета */
}

.primary-button {
  background: #667eea;              /* Хардкод цвета */
  color: white;                     /* Может не совпадать с Telegram темой */
}
```

---

## Исправленные проблемы с контрастом

### До

- Белый текст на белом/светлом фоне в некоторых карточках
- Градиенты с плохим контрастом
- Хардкодные цвета, не учитывающие Telegram тему

### После

- ✅ Тёмный текст (`--color-text-primary`) на светлом фоне
- ✅ Белый текст (`--color-text-on-primary`) на цветных кнопках/табах
- ✅ Приглушённый текст (`--color-text-secondary`) для второстепенной информации
- ✅ Правильный контраст во всех компонентах
- ✅ Поддержка Telegram темы (если пользователь использует тёмную тему в Telegram)

---

## Обновлённые компоненты

### Полностью обновлены:

1. **CuratorTabBar**
   - Фон: `--color-surface`
   - Активная вкладка: `--color-primary`
   - Текст: `--color-text-secondary` → `--color-text-primary` (активная)

2. **CuratorLayout**
   - Фон: `--color-background`

3. **CuratorCoursesDashboardPage**
   - Все карточки курсов: `--color-surface`
   - Заголовки: `--color-text-primary`
   - Описания: `--color-text-secondary`
   - Кнопки: `--color-primary` / `--color-text-on-primary`

4. **CourseDashboardPage**
   - Карточки статистики: `--color-surface`
   - Action cards: `--color-surface` с `--color-primary` border при hover
   - Иконки и текст с правильным контрастом

### Частично обновлены:

Остальные страницы куратора используют глобальные стили из `theme.css`, но их специфичные стили можно доработать аналогично.

---

## Развёртывание

```bash
# На VPS
cd /var/www/tma_education
git pull

# Пересборка TMA
cd tma
npm run build

# Backend пересобирать не нужно
```

---

## Проверка работы

### 1. Базовая проверка

1. Откройте TMA в Telegram
2. Проверьте, что:
   - Все тексты читаемы
   - Нет белого текста на белом фоне
   - Карточки отличаются от фона
   - Кнопки имеют правильный контраст

### 2. Проверка Telegram темы

1. Откройте Telegram в режиме тёмной темы
2. Откройте TMA
3. Цвета должны адаптироваться к теме Telegram

### 3. Проверка консистентности

1. Пройдите по всем страницам куратора
2. Убедитесь, что стиль единообразный
3. Проверьте hover эффекты и transitions

---

## Будущие улучшения

### 1. Тёмная тема

```typescript
// В colors.ts можно добавить:
export const darkTheme: ThemeColors = {
  primary: '#818cf8',
  background: '#1a202c',
  surface: '#2d3748',
  textPrimary: '#f7fafc',
  textSecondary: '#a0aec0',
  // ...
};
```

### 2. Кастомизация для организаций

```typescript
// Возможность переопределить primary цвет:
export function setCustomPrimary(color: string) {
  document.documentElement.style.setProperty('--color-primary', color);
}
```

### 3. Persist theme preference

```typescript
// Сохранять выбранную тему в localStorage:
localStorage.setItem('theme', 'light'); // or 'dark'
```

---

## Troubleshooting

### Цвета не применяются

**Причина:** CSS переменные не загружены

**Решение:**
1. Убедитесь, что `theme/theme.css` импортирован в `App.tsx`
2. Проверьте, что `useTheme()` вызван в `App` компоненте
3. Очистите кэш браузера

---

### Telegram тема не определяется

**Причина:** `window.Telegram.WebApp` недоступен

**Решение:**
1. Убедитесь, что TMA открыт через Telegram (не в браузере напрямую)
2. Проверьте, что `telegram-web-app.js` загружен
3. Fallback на дефолтные цвета работает автоматически

---

### Плохой контраст в некоторых местах

**Причина:** Не все компоненты обновлены

**Решение:**
1. Найдите компонент с проблемой
2. Замените хардкодные цвета на CSS переменные
3. Используйте `--color-text-primary` для основного текста
4. Используйте `--color-text-on-primary` для текста на цветном фоне

---

**Версия:** 1.0  
**Дата:** 2025-11-29  
**Автор:** Theme system implementation

