export type Primitive = string | number | boolean | null;

export type Capability =
  | 'ui'
  | 'api'
  | 'db'
  | 'queue'
  | 'screenshots'
  | 'networkCapture'
  | 'consoleCapture'
  | 'fileUpload'
  | 'downloadHandling'
  | 'multiTab'
  | 'authViaApi'
  | 'authViaUi'
  | 'diagnostics'
  | 'cleanup'
  | 'plugins';

export type CapabilityMap = Partial<Record<Capability, boolean>>;
export type FeatureFlagMap = Record<string, boolean>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogMeta {
  readonly [key: string]: unknown;
}

export interface PlatformLogger {
  child(bindings: Record<string, unknown>): PlatformLogger;
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  fatal(message: string, meta?: LogMeta): void;
}

export interface RetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoffFactor?: number | undefined;
}

export interface TimeoutPolicy {
  timeoutMs: number;
  onTimeoutMessage?: string | undefined;
}

export interface UIActionOptions {
  timeoutMs?: number | undefined;
  retryPolicy?: RetryPolicy | undefined;
  diagnosticsOnFailure?: boolean | undefined;
  stepName?: string | undefined;
}

export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'testId';

export interface SelectorCandidate {
  strategy: SelectorStrategy;
  value: string;
  weight?: number | undefined;
  description?: string | undefined;
}

export interface SelectorDefinition {
  namespace: string;
  key: string;
  candidates: readonly SelectorCandidate[];
  description?: string | undefined;
  required?: boolean | undefined;
}

export interface ResolvedSelector {
  namespace: string;
  key: string;
  candidate: SelectorCandidate;
}

export interface SelectorRegistry {
  resolve(key: string, namespace?: string): SelectorDefinition | undefined;
  list(namespace?: string): readonly SelectorDefinition[];
}

export type RouteParams = Record<string, string | number>;

export interface RouteDefinition<TParams extends RouteParams | undefined = undefined> {
  name: string;
  pathTemplate: string;
  build(params: TParams, query?: Record<string, Primitive>): string;
}

export type RouteRegistry = Record<string, RouteDefinition<RouteParams | undefined>>;

export interface AuthSession {
  accessToken?: string | undefined;
  headers?: Record<string, string> | undefined;
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string | undefined;
    path?: string | undefined;
    expiresEpochSeconds?: number | undefined;
  }>;
}

export interface AuthProvider {
  name: string;
  authenticate(context: ExecutionContext): Promise<AuthSession>;
}

export interface RegisteredResource {
  id: string;
  type: string;
  value: unknown;
  createdAt: Date;
  tags?: readonly string[] | undefined;
}

export interface ResourceRegistry {
  register(resource: RegisteredResource): void;
  get(resourceId: string): RegisteredResource | undefined;
  list(type?: string): readonly RegisteredResource[];
  remove(resourceId: string): void;
  clear(): void;
}

export interface CleanupTask {
  id: string;
  description: string;
  run(): Promise<void>;
  critical?: boolean | undefined;
}

export interface CleanupResult {
  id: string;
  description: string;
  success: boolean;
  error?: unknown | undefined;
}

export interface CleanupRegistry {
  add(task: CleanupTask): void;
  runAll(): Promise<CleanupResult[]>;
}

export interface DiagnosticArtifact {
  id: string;
  type: 'screenshot' | 'html' | 'json' | 'network' | 'console' | 'custom';
  name: string;
  path: string;
  createdAtIso: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface DiagnosticSummary {
  executionId: string;
  testId?: string | undefined;
  startedAtIso: string;
  finishedAtIso?: string | undefined;
  durationMs?: number | undefined;
  failedStep?: string | undefined;
  errorMessage?: string | undefined;
  url?: string | undefined;
}

export interface DiagnosticBundle {
  summary: DiagnosticSummary;
  artifacts: DiagnosticArtifact[];
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'minor' | 'moderate' | 'major' | 'critical';
export type BusinessCriticality = 'p3' | 'p2' | 'p1' | 'blocker';
export type SuiteKind = 'smoke' | 'regression' | 'full';

export interface TestMetadata {
  testId: string;
  title: string;
  feature: string;
  component: string;
  severity: Severity;
  risk: RiskLevel;
  businessCriticality: BusinessCriticality;
  owner: string;
  tags: readonly string[];
  estimatedDurationMs: number;
  suite: SuiteKind;
  capabilityRequirements?: Capability[] | undefined;
  environmentRequirements?: readonly string[] | undefined;
  retryOverride?: {
    maxAttempts?: number | undefined;
    delayMs?: number | undefined;
    backoffFactor?: number | undefined;
  } | undefined;
  timeoutOverrideMs?: number | undefined;
}

export interface ExecutionContext {
  executionId: string;
  projectName: string;
  environment: string;
  startedAt: Date;
  correlationId: string;
  capabilityMap: CapabilityMap;
  featureFlags: FeatureFlagMap;
  logger: PlatformLogger;
  resources: ResourceRegistry;
  cleanup: CleanupRegistry;
  metadata?: TestMetadata | undefined;
}

export interface TestContext extends ExecutionContext {
  testId: string;
  testTitle: string;
}

export interface StepResult<TData = unknown> {
  stepName: string;
  attempt: number;
  durationMs: number;
  data?: TData | undefined;
}

export interface UIWaitOptions {
  timeoutMs?: number | undefined;
  pollingIntervalMs?: number | undefined;
}

export interface UIElementState {
  visible: boolean;
  enabled?: boolean | undefined;
  text?: string | undefined;
  value?: string | undefined;
}

export interface UIDriver {
  goto(url: string, options?: { timeoutMs?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' }): Promise<void>;
  close(): Promise<void>;
  currentUrl(): Promise<string>;
  screenshot(path: string, options?: { fullPage?: boolean }): Promise<void>;
  click(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  doubleClick(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  hover(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  fill(selector: ResolvedSelector, value: string, options?: UIActionOptions): Promise<void>;
  type(selector: ResolvedSelector, value: string, options?: UIActionOptions): Promise<void>;
  clear(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  press(selector: ResolvedSelector, key: string, options?: UIActionOptions): Promise<void>;
  select(selector: ResolvedSelector, value: string | string[], options?: UIActionOptions): Promise<void>;
  check(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  uncheck(selector: ResolvedSelector, options?: UIActionOptions): Promise<void>;
  upload(selector: ResolvedSelector, filePath: string, options?: UIActionOptions): Promise<void>;
  text(selector: ResolvedSelector, options?: UIActionOptions): Promise<string>;
  value(selector: ResolvedSelector, options?: UIActionOptions): Promise<string>;
  attribute(selector: ResolvedSelector, attribute: string, options?: UIActionOptions): Promise<string | null>;
  waitForVisible(selector: ResolvedSelector, options?: UIWaitOptions): Promise<void>;
  waitForHidden(selector: ResolvedSelector, options?: UIWaitOptions): Promise<void>;
  waitForExists(selector: ResolvedSelector, options?: UIWaitOptions): Promise<void>;
  evaluate<TOutput>(expression: () => TOutput): Promise<TOutput>;
}

export interface UIComponent {
  readonly componentName: string;
  isVisible(options?: UIWaitOptions): Promise<boolean>;
}

export interface HttpRequest<TBody = unknown, TQuery extends Record<string, Primitive | Primitive[] | undefined> = Record<string, Primitive | Primitive[] | undefined>> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: TQuery | undefined;
  body?: TBody | undefined;
  headers?: Record<string, string> | undefined;
  timeoutMs?: number | undefined;
  correlationId?: string | undefined;
}

export interface HttpResponse<TData = unknown> {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  data: TData;
  durationMs: number;
}

export interface HttpClient {
  send<TResponse, TBody = unknown, TQuery extends Record<string, Primitive | Primitive[] | undefined> = Record<string, Primitive | Primitive[] | undefined>>(
    request: HttpRequest<TBody, TQuery>
  ): Promise<HttpResponse<TResponse>>;
}

export interface ApiRepository<TEntity, TId> {
  getById(id: TId): Promise<TEntity | null>;
  create(payload: Partial<TEntity>): Promise<TEntity>;
  update(id: TId, payload: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

export interface DbQueryOptions {
  timeoutMs?: number | undefined;
  operationName?: string | undefined;
}

export interface DatabaseClient {
  queryOne<T>(sql: string, params: readonly unknown[], mapper?: (row: unknown) => T, options?: DbQueryOptions): Promise<T | null>;
  queryMany<T>(sql: string, params: readonly unknown[], mapper?: (row: unknown) => T, options?: DbQueryOptions): Promise<T[]>;
  scalar<T>(sql: string, params: readonly unknown[], options?: DbQueryOptions): Promise<T | null>;
  exists(sql: string, params: readonly unknown[], options?: DbQueryOptions): Promise<boolean>;
  execute(sql: string, params: readonly unknown[], options?: DbQueryOptions): Promise<number>;
  transaction<T>(action: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

export interface DbRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  remove(id: TId): Promise<void>;
}

export interface QueueMessage<TPayload = unknown> {
  id: string;
  queue: string;
  payload: TPayload;
  correlationId?: string | undefined;
  headers?: Record<string, string> | undefined;
  createdAtIso: string;
}

export interface QueuePublishRequest<TPayload = unknown> {
  queue: string;
  payload: TPayload;
  correlationId?: string | undefined;
  headers?: Record<string, string> | undefined;
}

export interface QueuePollOptions {
  limit?: number | undefined;
  waitMs?: number | undefined;
}

export interface QueueWaitOptions {
  timeoutMs: number;
  pollingIntervalMs: number;
}

export interface QueueClient {
  publish<TPayload>(request: QueuePublishRequest<TPayload>): Promise<QueueMessage<TPayload>>;
  poll<TPayload>(queue: string, options?: QueuePollOptions): Promise<Array<QueueMessage<TPayload>>>;
  acknowledge(queue: string, messageId: string): Promise<void>;
  purge?(queue: string): Promise<void>;
}

export interface QueueDiagnosticsEntry {
  queue: string;
  messageId: string;
  correlationId?: string | undefined;
  observedAtIso: string;
  payloadPreview: string;
}

export interface DataGateway<TCommand, TResult> {
  execute(command: TCommand, context: ExecutionContext): Promise<TResult>;
}

export type PluginHookName =
  | 'beforeExecution'
  | 'afterExecution'
  | 'beforeStep'
  | 'afterStep'
  | 'onFailure'
  | 'onDiagnostics';

export interface PluginHookPayload {
  executionId: string;
  stepName?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  error?: unknown | undefined;
  diagnostics?: DiagnosticBundle | undefined;
}

export interface PlatformPlugin {
  name: string;
  version: string;
  enabled?: boolean | undefined;
  hooks?: Partial<Record<PluginHookName, (context: ExecutionContext, payload: PluginHookPayload) => Promise<void> | void>> | undefined;
}

export interface ProjectAdapter {
  name: string;
  version: string;
  capabilities: CapabilityMap;
  featureFlags: FeatureFlagMap;
  routes: RouteRegistry;
  selectors: SelectorRegistry;
  authProvider?: AuthProvider | undefined;
  initialize?(context: ExecutionContext): Promise<void>;
  dispose?(context: ExecutionContext): Promise<void>;
}

export interface CliScaffoldOptions {
  name: string;
  directory: string;
  force?: boolean | undefined;
}

export interface CliValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}



