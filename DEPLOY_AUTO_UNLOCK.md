# Инструкция по деплою: Auto-unlock для новых учеников

## Проблема
После `git pull` и `npm run build` возникает ошибка:
```
TS2353: Object literal may only specify known properties, and 'autoUnlockForNewLearners' does not exist in type...
```

## Решение

### Шаг 1: Перегенерировать Prisma Client
```bash
cd /var/www/tma_education/backend
npx prisma generate
```

### Шаг 2: Применить миграцию БД
```bash
# Миграция уже создана, просто примените её:
npx prisma migrate deploy
```

### Шаг 3: Пересобрать backend
```bash
npm run build
```

### Шаг 4: Перезапустить приложение
```bash
pm2 restart minto-backend
```

## Проверка
После деплоя проверьте:
1. В TMA на странице курса должна появиться кнопка "➕ Открывать для новых учеников"
2. При включении кнопка должна стать зелёной "✅ Открывать для новых учеников"
3. Новые ученики при регистрации должны автоматически получать доступ к модулям с включённым флагом

