# Automation Platform Core (TypeScript Monorepo)

## 1. Что это за проект
Это production-grade монорепозиторий с переиспользуемым ядром автоматизации для многих веб-проектов. Ядро разделено на независимые пакеты: UI (Puppeteer), API (Axios), DB, Queue, диагностика, orchestration, plugins, governance, CLI и template-проект.

## 2. Для чего он нужен
Проект решает задачу стандартизации автоматизации в компании:
- единые контракты и архитектурные границы;
- быстрый онбординг нового проекта через adapter/registry/config;
- уменьшение copy-paste фреймворков между командами;
- сильная типизация + runtime validation + observability.

## 3. Ключевые архитектурные принципы
- Composition over inheritance.
- Capability-based design (функции включаются/отключаются флагами).
- Typed contracts + runtime validation на границах.
- Fail-fast config.
- Детальная диагностика и артефакты.
- Domain-neutral core + project-specific adapters.

## 4. Почему выбраны Puppeteer и Axios
- Puppeteer: стабильная автоматизация Chromium, достаточный low-level контроль, возможность строить свой abstraction layer без vendor lock-in на уровне test DSL.
- Axios: зрелая экосистема interceptors/retries/timeouts и удобная композиция typed HTTP client abstraction.

## 5. Общая структура monorepo
```text
/packages
  contracts
  config
  logger
  utils
  metadata
  execution
  diagnostics
  selectors
  ui-driver
  ui-core
  ui-components
  ui-flows
  api-core
  db-core
  queue-core
  data-support
  repositories
  gateways
  plugins
  governance
  cli
/projects
  template-webapp
/scripts
.github/workflows/ci.yml
.gitlab-ci.yml
```

## 6. Подробное описание каждого пакета
- `contracts`: централизованные интерфейсы (adapter/auth/routes/selectors/execution/http/db/queue/plugins/cli).
- `config`: zod-схемы, загрузка env, merge base+env+project, нормализация путей, fail-fast.
- `logger`: pino-based structured logging, контекстные child logger, redaction.
- `utils`: retry/wait, masking, id generation, typed error model.
- `metadata`: declaration/validation helper для test metadata.
- `execution`: execution context, step runner, cleanup/resource registries.
- `diagnostics`: failure bundle, артефакты (screenshot/html/storage/network/console/API/DB/queue traces).
- `selectors`: namespaced registry, builder, fallback/prioritization, Puppeteer conversion.
- `ui-driver`: Puppeteer abstraction (navigation/actions/waits/storage/network/console/tabs/dialogs).
- `ui-core`: устойчивые UI actions/assertions/waits с retry.
- `ui-components`: domain-neutral компоненты (button/input/table/modal/...).
- `ui-flows`: high-level flows (auth/crud/search/upload/permission).
- `api-core`: typed Axios wrapper, retries/polling/pagination/error mapping.
- `db-core`: PostgreSQL client abstraction, tx helpers, read-only/write guards.
- `queue-core`: vendor-neutral queue contracts + in-memory adapter + waiters + DLQ abstraction.
- `data-support`: builders/factories/presets/deterministic generator/snapshot diff/lifecycle support.
- `repositories`: reusable API/DB repositories + scenario methods (`createMinimalValid`, `waitUntilStatus`, ...).
- `gateways`: orchestration facade над repositories + queue + cleanup.
- `plugins`: plugin manager + lifecycle hooks + working diagnostics plugin.
- `governance`: quality rules (selectors/metadata/config/naming/no-hard-sleep scan).
- `cli`: scaffolding/validation/inspection commands.

## 7. Как установить зависимости
```bash
npm install
```

## 8. Как собрать проект
```bash
npm run build
```

## 9. Как запускать lint/typecheck/tests
```bash
npm run lint
npm run typecheck
npm run test
npm run validate
npm run ci
```

## 10. Как устроен конфиг
Конфиг собирается в `packages/config` и всегда проходит runtime-валидацию через `zod`.

Порядок приоритета источников (от меньшего к большему):
1. `DEFAULT_CONFIG` из `packages/config/src/index.ts`
2. Переменные окружения `AP_*` (через `dotenv`)
3. `base` override
4. `environment` override
5. `project` override

Что это дает:
- единый контракт конфигурации для всех проектов;
- fail-fast поведение при неверных параметрах;
- возможность безопасно переопределять настройки под проект/стенд.

Использование:
```ts
import { loadPlatformConfig } from '@automation-platform/config';

const config = loadPlatformConfig({
  envFilePath: '.env',
  base: {},
  environment: {},
  project: {}
});
```

### 10.1 Где хранить данные проекта (секреты, пользователи, токены)
- Секреты БД/API/пользователей хранить только в env/secret manager (локально `.env`, в CI/CD — защищенные переменные).
- В репозитории хранить только пример `.env.example` без реальных значений.
- Не хранить пароли/токены в `config.ts`, `adapter.ts`, `repository.ts`.
- Для пользовательских аккаунтов (логин/пароль, cookie, token) читать значения в `AuthProvider` из `process.env`.

### 10.2 Пример env-конфигурации проекта
```env
AP_PROJECT_NAME=my-project
AP_ENV=staging
AP_BASE_URL=https://my-app.company

AP_API_ENABLED=true
AP_API_TIMEOUT_MS=10000

AP_DB_ENABLED=true
AP_DB_URL=postgres://user:pass@db-host:5432/app_db
AP_DB_READ_ONLY=false
AP_DB_MAX_CONNECTIONS=10
AP_DB_TIMEOUT_MS=10000
AP_DB_WRITE_ENVS=staging,prod-like

AP_QUEUE_ENABLED=true
AP_QUEUE_PROVIDER=custom
AP_QUEUE_ENDPOINT=amqp://...

AP_LOG_LEVEL=info
AP_ARTIFACTS_DIR=./artifacts

PROJECT_ADMIN_USER=admin@example.com
PROJECT_ADMIN_PASSWORD=...
PROJECT_AUTH_TOKEN=...
```

### 10.3 Где держать project-specific override
- Файл `projects/<project>/src/config.ts` — только не-секретные проектные defaults/feature flags/capabilities.
- Секреты туда не класть.

## 11. Как подключить новый проект
1. Создать проект в `projects/<name>`.
2. Реализовать `ProjectAdapter`.
3. Подключить routes/selectors/auth-provider.
4. Создать project-level repositories/gateways/flows.
5. Добавить проект в `tsconfig.build.json` references.

## 12. Как написать project adapter
Файл должен экспортировать объект `ProjectAdapter`:
- `name`, `version`;
- `capabilities`, `featureFlags`;
- `routes`, `selectors`;
- `authProvider`;
- optional `initialize/dispose`.

См. `projects/template-webapp/src/adapter.ts`.

## 13. Как устроены routes
Routes типизированы как `RouteDefinition<TParams>` и собраны в `RouteRegistry`. В template-проекте есть `buildRoute` helper и набор маршрутов `home/login/entities/entityDetails`.

## 14. Как устроены selectors
Selectors — namespaced registry с fallback candidates:
- strategies: `testId`, `css`, `xpath`, `text`;
- priority/fallback + diagnostic-friendly resolution;
- builders через `SelectorBuilder`.

## 15. Как устроен UI layer
- `ui-driver`: низкоуровневый безопасный Puppeteer facade.
- `ui-core`: retryable actions + wait/assert wrappers.
- `ui-components`: reusable component objects.
- `ui-flows`: бизнес-сценарии из компонентов/действий.

## 16. Как устроены компоненты
Реализованы: `Button`, `Input`, `Textarea`, `Checkbox`, `Radio`, `Select`, `Table`, `Grid`, `Modal`, `Drawer`, `Toast`, `Tabs`, `Pagination`, `Header`, `Sidebar`, `FileUploader`, `FilterPanel`, `DatePicker`, `Loader`.

## 17. Как устроены flows
`ui-flows` содержит:
- `AuthFlow` (login/logout),
- `EntityCrudFlow` (create/edit/delete),
- `SearchFilterSortFlow`,
- `FileTransferFlow`,
- `PermissionVisibilityFlow`.

## 18. Как устроен API layer
`AxiosHttpClient` предоставляет:
- normalised request API,
- auth injection,
- retries/backoff,
- timeout handling,
- response validation (zod),
- polling/pagination/eventual consistency.

### 18.1 Как подключить свой API
```ts
import { AxiosHttpClient } from '@automation-platform/api-core';

const apiClient = new AxiosHttpClient({
  baseUrl: config.api.baseUrl,
  timeoutMs: config.api.timeoutMs,
  retry: config.api.retry,
  logger,
  authTokenProvider: async () => process.env.PROJECT_AUTH_TOKEN
});
```

Дальше `apiClient` передается в ваши repositories (`TemplateWebApiRepository` или собственные).

## 19. Как устроен DB layer
`PostgresDatabaseClient`:
- `queryOne/queryMany/scalar/exists/execute/transaction`;
- parameterized query only;
- read-only mode + write guard by env;
- trace logging + error mapping.

### 19.1 Как подключить свою БД
Для PostgreSQL:
```ts
import { PostgresDatabaseClient } from '@automation-platform/db-core';

const dbClient = new PostgresDatabaseClient(
  {
    connectionString: config.db.connectionString,
    maxConnections: config.db.maxConnections,
    statementTimeoutMs: config.db.statementTimeoutMs,
    readOnly: config.db.readOnly,
    environment: config.environment,
    writeAllowedEnvironments: config.db.writeAllowedEnvironments
  },
  logger
);
```

Если нужна другая БД, реализуйте свой адаптер, совместимый с контрактом `DatabaseClient` из `contracts`, и подключайте его в composition root аналогично.

## 20. Как устроен queue layer
`queue-core`:
- `QueueClient` contract;
- `InMemoryQueueClient` adapter;
- `QueueWaiter` (`waitForMessage`, `waitForCorrelation`, `waitForBackgroundJob`);
- `InMemoryDeadLetterQueueAdapter`.

## 21. Как устроены repositories
`repositories` содержит базовые API/DB абстракции и template-реализации:
- `TemplateApiRepository`;
- `TemplateDbRepository`;
- scenario helpers: `createMinimalValid`, `createDraftLike`, `deleteIfExists`, `existsById`, `waitUntilStatus`.

## 22. Как устроены gateways
`TemplateEntityGateway` orchestrates:
- API update,
- queue wait/ack,
- cleanup registration,
- DB/API access через высокоуровневые методы.

## 23. Как работает cleanup
Execution context содержит `CleanupRegistry`.
Ресурсы регистрируются через `LifecycleEntitySupport`, cleanup задачи выполняются детерминированно в обратном порядке.

## 24. Как работает diagnostics
`createFailureBundle` собирает:
- screenshot,
- HTML,
- URL,
- cookies/localStorage/sessionStorage,
- api/db/queue traces,
- console/network,
- manifest.

Все складывается в `artifacts/diagnostics/<executionId>`.

## 25. Как пользоваться CLI
CLI пакет: `@automation-platform/cli`.
Команды:
```bash
node packages/cli/dist/index.js create adapter --name demo --directory projects/demo/src
node packages/cli/dist/index.js create selector-module --name auth --directory projects/demo/src
node packages/cli/dist/index.js create component --name profile --directory projects/demo/src
node packages/cli/dist/index.js create flow --name login --directory projects/demo/src
node packages/cli/dist/index.js create repository --name orders --directory projects/demo/src
node packages/cli/dist/index.js create gateway --name orders --directory projects/demo/src
node packages/cli/dist/index.js create template-test --name smoke --directory projects/demo/tests
node packages/cli/dist/index.js validate-config
node packages/cli/dist/index.js validate-governance --root .
node packages/cli/dist/index.js inspect-env
```

## 26. Как расширять framework
- Добавлять новые capability flags.
- Реализовывать новые adapters поверх contracts.
- Расширять plugins/governance/runners без изменения доменного кода тестов.

## 27. Как писать новые компоненты
1. Наследоваться от `BaseComponent` в `ui-components`.
2. Использовать `UICore` вместо raw driver.
3. Добавить action/state/assert методы.
4. Зарегистрировать фабричный метод в `ComponentFactory`.

## 28. Как писать новые repositories
1. Использовать `BaseApiRepository`/`BaseDbRepository`.
2. Добавлять scenario-oriented методы, а не только CRUD.
3. Делать idempotent delete/wait helpers.

## 29. Как писать новые gateways
1. Инжектить repositories + queue + execution context.
2. Оркестрировать async verification.
3. Регистрировать cleanup ресурсы.

## 30. Как добавлять плагины
1. Реализовать `PlatformPlugin`.
2. Подписаться на lifecycle hook (`beforeStep`, `onFailure`, `onDiagnostics`, ...).
3. Зарегистрировать через `PluginManager.register`.

## 31. Лучшие практики
- Использовать `waitFor/retry`, не `sleep`.
- Работать через gateways/flows, а не через raw infra в тестах.
- Хранить selectors/routes централизованно.
- Включать diagnostics для flaky/critical сценариев.

## 32. Антипаттерны
- Хардкод URL/selectors в тестах.
- Прямой Puppeteer/Axios/SQL вызов в бизнес-сценарии без слоя abstractions.
- Неидемпотентный cleanup.
- Скрытые side effects без логирования.

## 33. Пример жизненного цикла теста/сценария
1. Load config.
2. Create execution context.
3. Initialize adapter/plugins.
4. Run steps via `StepRunner`.
5. Use gateway/flows.
6. On failure: collect diagnostics bundle.
7. Run cleanup registry.
8. Finalize and persist artifacts.

## 34. Пример подключения template-webapp
См. `projects/template-webapp`:
- adapter: `src/adapter.ts`
- routes: `src/routes.ts`
- selectors: `src/selectors.ts`
- auth provider: `src/auth-provider.ts`
- repositories/gateway/async scenario: `src/*.ts`
- tests: `tests/template.test.ts`

### 34.1 Как конфигурировать классы проекта из данных конфигурации
Рекомендуется делать единый `bootstrap` (composition root), где из `config + env` собираются все зависимости:

```ts
import { loadPlatformConfig } from '@automation-platform/config';
import { createLogger } from '@automation-platform/logger';
import { createExecutionContext } from '@automation-platform/execution';
import { AxiosHttpClient } from '@automation-platform/api-core';
import { PostgresDatabaseClient } from '@automation-platform/db-core';
import { InMemoryQueueClient } from '@automation-platform/queue-core';
import { TemplateWebApiRepository } from './api-repository';
import { TemplateWebDbRepository } from './db-repository';
import { TemplateWebGateway } from './gateway';

const config = loadPlatformConfig();
const logger = createLogger({
  level: config.logging.level,
  serviceName: config.projectName,
  environment: config.environment
});

const context = createExecutionContext({
  projectName: config.projectName,
  environment: config.environment,
  capabilityMap: config.capabilities,
  featureFlags: config.featureFlags,
  logger
});

const apiClient = new AxiosHttpClient({
  baseUrl: config.api.baseUrl,
  timeoutMs: config.api.timeoutMs,
  retry: config.api.retry,
  logger,
  authTokenProvider: async () => process.env.PROJECT_AUTH_TOKEN
});

const dbClient = new PostgresDatabaseClient(
  {
    connectionString: config.db.connectionString,
    maxConnections: config.db.maxConnections,
    statementTimeoutMs: config.db.statementTimeoutMs,
    readOnly: config.db.readOnly,
    environment: config.environment,
    writeAllowedEnvironments: config.db.writeAllowedEnvironments
  },
  logger
);

const queueClient = new InMemoryQueueClient(logger);

const apiRepo = new TemplateWebApiRepository(apiClient, logger);
const dbRepo = new TemplateWebDbRepository(dbClient, logger);

const gateway = new TemplateWebGateway(apiRepo, dbRepo, queueClient, context, logger);
```

После этого тесты и сценарии должны использовать `gateway/flows`, а не собирать инфраструктуру вручную в каждом тесте.

## 35. Переменные окружения
Основные `AP_*`:
- `AP_PROJECT_NAME`
- `AP_ENV`
- `AP_BASE_URL`
- `AP_UI_ENABLED`
- `AP_BROWSER_HEADLESS`
- `AP_API_ENABLED`
- `AP_DB_ENABLED`
- `AP_DB_URL`
- `AP_DB_READ_ONLY`
- `AP_DB_MAX_CONNECTIONS`
- `AP_DB_TIMEOUT_MS`
- `AP_DB_WRITE_ENVS`
- `AP_QUEUE_ENABLED`
- `AP_QUEUE_PROVIDER`
- `AP_QUEUE_ENDPOINT`
- `AP_QUEUE_TIMEOUT_MS`
- `AP_QUEUE_NAME`
- `AP_ARTIFACTS_DIR`
- `AP_LOG_LEVEL`
- `AP_FEATURE_FLAGS`

Проектные (кастомные) переменные лучше именовать отдельно, например:
- `PROJECT_AUTH_TOKEN`
- `PROJECT_ADMIN_USER`
- `PROJECT_ADMIN_PASSWORD`
- `PROJECT_TEST_USER_1`

См. `.env.example`.

## 36. Ограничения текущей реализации
- Queue adapter по умолчанию in-memory (для реального брокера нужен vendor adapter).
- DB интеграционные тесты с PostgreSQL не включены в unit run (нужен внешний инстанс).
- UI e2e не запускаются автоматически в test suite (фокус на framework internals).

## 37. Идеи дальнейшего развития
- Реальные adapters для Kafka/Rabbit/SQS.
- Расширение plugin ecosystem (a11y/visual/AI) до production-ready реализаций.
- Affected-package CI mode.
- Distributed execution и sharding.
- Интеграция с test management/reporting системами.

---

## Быстрый старт
```bash
npm install
npm run ci
```

## CI/CD
- Готовые шаблоны: `.github/workflows/ci.yml`, `.gitlab-ci.yml`.
- Пайплайн-гейты: lint, typecheck, test, build, validate.
- Артефакты: `artifacts/**`, `coverage/**`, `packages/*/dist`, `projects/*/dist`.
- Команда для пайплайна: `npm run ci`.

## Секреты и безопасность
- Секреты не хранятся в репозитории.
- Маскирование чувствительных полей в `utils.maskSensitive` и logger redaction.
- Используйте секреты через CI variables / env.

## Состояние валидации
На текущей версии репозитория успешно проходят:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run validate`
- `npm run ci`


## Дополнение: Standalone Demo Web App
В репозитории добавлен полностью изолированный демонстрационный проект: `demo-web-app/`.

- Он не импортирует `@automation-platform/*` пакеты.
- Не участвует в сборке core-пакетов.
- Может быть удалён целиком без влияния на работоспособность core.

Отдельная инструкция запуска: `demo-web-app/README.md`.

## Showcase Tests
- Mock showcase (core in isolation): `projects/core-showcase-tests/tests/core-capabilities-showcase.test.ts`
- Real integration with demo app: `projects/core-showcase-tests/tests/integration-real-demo.test.ts`
- If `demo-web-app` is removed, real integration test is auto-skipped and core test suite remains runnable.
