# Demo Web App

Изолированное демонстрационное приложение (API + auth + file DB + queue + worker).

Важно:
- Приложение не использует `@automation-platform/*` пакеты.
- Оно лежит отдельно от core (`demo-web-app/`) и может быть удалено без влияния на жизнеспособность core.

## Стек
- Node.js 20+
- TypeScript
- HTTP server на стандартном модуле `node:http`
- Две файловые БД (JSON): `auth-db.json` и `app-db.json`
- In-memory очередь и background worker

## Что демонстрирует
- Регистрация и логин пользователя
- Bearer token авторизация
- Создание задачи через API
- Асинхронная обработка задачи worker-ом через очередь
- DLQ (dead-letter queue) при ошибке обработки

## Быстрый запуск (из корня репозитория)

1. Проверка компиляции демо:
```bash
npx tsc -p demo-web-app/tsconfig.json --noEmit
```

2. Запуск демо-сервера:
```bash
npx tsx demo-web-app/src/server.ts
```

3. Открыть UI:
- `http://127.0.0.1:3010`

## Запуск сценария smoke (авто-проверка)
Сценарий сам поднимает приложение на случайном порту, проходит register/login/createTask/waitCompleted и завершает процесс.

```bash
npx tsx demo-web-app/src/demo-scenario.ts
```

## Конфигурация через env
Можно переопределить параметры перед запуском.

- `DEMO_HOST` (по умолчанию `127.0.0.1`)
- `DEMO_PORT` (по умолчанию `3010`)
- `DEMO_DATA_DIR` (по умолчанию `./demo-web-app/data`)
- `DEMO_QUEUE_NAME` (по умолчанию `demo.task.jobs`)
- `DEMO_TOKEN_TTL_MS` (по умолчанию `3600000`)
- `DEMO_WORKER_POLL_MS` (по умолчанию `250`)

Пример для PowerShell:

```powershell
$env:DEMO_PORT='3020'
$env:DEMO_DATA_DIR='C:\temp\demo-web-data'
npx tsx demo-web-app/src/server.ts
```

## Основные API

### `POST /api/auth/register`
```json
{
  "username": "demo-user",
  "password": "P@ssw0rd123"
}
```

### `POST /api/auth/login`
```json
{
  "username": "demo-user",
  "password": "P@ssw0rd123"
}
```

### `GET /api/auth/me`
Требует заголовок `Authorization: Bearer <token>`.

### `POST /api/tasks`
```json
{
  "title": "process order #123"
}
```

Если в заголовке `x-correlation-id` не передан id, сервер создаст его сам.

### `GET /api/tasks`
Список задач текущего пользователя.

### `GET /api/tasks/:id`
Детали задачи текущего пользователя.

### `GET /api/queue/dlq`
Список задач пользователя, попавших в failed.

## Как вызвать падение в очередь DLQ
Создайте задачу с маркером `[fail]` в title:

```json
{
  "title": "[fail] force worker error"
}
```

Worker пометит её как `failed` и отправит событие в DLQ.

## Формат данных
- `demo-web-app/data/auth-db.json`: пользователи и сессии
- `demo-web-app/data/app-db.json`: задачи

## Удаление демо
Для полного удаления:
1. Удалите папку `demo-web-app/`.
2. Core проект продолжит работать без изменений, так как зависимости и сборка core не связаны с этим демо.

## Отдельный запуск как автономного проекта
Если хотите запускать демо полностью отдельно от core-инструментов:

```bash
cd demo-web-app
npm install
npm run build
npm run dev
```

## Интеграция с core тестами
В core добавлен отдельный real integration test, который поднимает это demo-приложение и проверяет связку core API/diagnostics/plugins/cleanup:

- `projects/core-showcase-tests/tests/integration-real-demo.test.ts`

Этот тест автоматически пропускается (`skip`), если `demo-web-app` отсутствует.
