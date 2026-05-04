import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AppDatabaseFile,
  AuthDatabaseFile,
  SessionRecord,
  TaskRecord,
  TaskStatus,
  UserRecord
} from './types';
import { assertObject, ensureStringArray, ValidationError } from './validation';

const AUTH_DB_FILE = 'auth-db.json';
const APP_DB_FILE = 'app-db.json';

const defaultAuthDb = (): AuthDatabaseFile => ({
  users: [],
  sessions: []
});

const defaultAppDb = (): AppDatabaseFile => ({
  tasks: []
});

const parseUser = (value: unknown): UserRecord => {
  const object = assertObject(value, 'Invalid user record');

  const id = object.id;
  const username = object.username;
  const normalizedUsername = object.normalizedUsername;
  const passwordHash = object.passwordHash;
  const createdAtIso = object.createdAtIso;

  if (typeof id !== 'string' || id.length === 0) {
    throw new ValidationError('Invalid user.id');
  }

  if (typeof username !== 'string' || username.length < 3) {
    throw new ValidationError('Invalid user.username');
  }

  if (typeof normalizedUsername !== 'string' || normalizedUsername.length < 3) {
    throw new ValidationError('Invalid user.normalizedUsername');
  }

  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new ValidationError('Invalid user.passwordHash');
  }

  if (typeof createdAtIso !== 'string' || createdAtIso.length === 0) {
    throw new ValidationError('Invalid user.createdAtIso');
  }

  const roles = ensureStringArray(object.roles, 'user.roles') as UserRecord['roles'];

  return {
    id,
    username,
    normalizedUsername,
    passwordHash,
    roles,
    createdAtIso
  };
};

const parseSession = (value: unknown): SessionRecord => {
  const object = assertObject(value, 'Invalid session record');

  const tokenHash = object.tokenHash;
  const userId = object.userId;
  const createdAtIso = object.createdAtIso;
  const expiresAtIso = object.expiresAtIso;

  if (typeof tokenHash !== 'string' || tokenHash.length === 0) {
    throw new ValidationError('Invalid session.tokenHash');
  }

  if (typeof userId !== 'string' || userId.length === 0) {
    throw new ValidationError('Invalid session.userId');
  }

  if (typeof createdAtIso !== 'string' || createdAtIso.length === 0) {
    throw new ValidationError('Invalid session.createdAtIso');
  }

  if (typeof expiresAtIso !== 'string' || expiresAtIso.length === 0) {
    throw new ValidationError('Invalid session.expiresAtIso');
  }

  return {
    tokenHash,
    userId,
    createdAtIso,
    expiresAtIso
  };
};

const parseTaskStatus = (value: unknown): TaskStatus => {
  if (value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed') {
    return value;
  }

  throw new ValidationError('Invalid task.status');
};

const parseTask = (value: unknown): TaskRecord => {
  const object = assertObject(value, 'Invalid task record');

  const id = object.id;
  const title = object.title;
  const ownerUserId = object.ownerUserId;
  const correlationId = object.correlationId;
  const createdAtIso = object.createdAtIso;
  const updatedAtIso = object.updatedAtIso;

  if (typeof id !== 'string' || id.length === 0) {
    throw new ValidationError('Invalid task.id');
  }

  if (typeof title !== 'string' || title.length === 0) {
    throw new ValidationError('Invalid task.title');
  }

  if (typeof ownerUserId !== 'string' || ownerUserId.length === 0) {
    throw new ValidationError('Invalid task.ownerUserId');
  }

  if (typeof correlationId !== 'string' || correlationId.length === 0) {
    throw new ValidationError('Invalid task.correlationId');
  }

  if (typeof createdAtIso !== 'string' || createdAtIso.length === 0) {
    throw new ValidationError('Invalid task.createdAtIso');
  }

  if (typeof updatedAtIso !== 'string' || updatedAtIso.length === 0) {
    throw new ValidationError('Invalid task.updatedAtIso');
  }

  const status = parseTaskStatus(object.status);
  const lastError = object.lastError;

  if (lastError !== undefined && typeof lastError !== 'string') {
    throw new ValidationError('Invalid task.lastError');
  }

  const task: TaskRecord = {
    id,
    title,
    ownerUserId,
    status,
    correlationId,
    createdAtIso,
    updatedAtIso
  };

  if (lastError !== undefined) {
    task.lastError = lastError;
  }

  return task;
};

const parseAuthDb = (value: unknown): AuthDatabaseFile => {
  const object = assertObject(value, 'Invalid auth database');
  const usersRaw = object.users;
  const sessionsRaw = object.sessions;

  if (!Array.isArray(usersRaw) || !Array.isArray(sessionsRaw)) {
    throw new ValidationError('Invalid auth database shape');
  }

  return {
    users: usersRaw.map((item) => parseUser(item)),
    sessions: sessionsRaw.map((item) => parseSession(item))
  };
};

const parseAppDb = (value: unknown): AppDatabaseFile => {
  const object = assertObject(value, 'Invalid app database');
  const tasksRaw = object.tasks;

  if (!Array.isArray(tasksRaw)) {
    throw new ValidationError('Invalid app database shape');
  }

  return {
    tasks: tasksRaw.map((item) => parseTask(item))
  };
};

const nowIso = (): string => new Date().toISOString();

const cloneUser = (user: UserRecord): UserRecord => ({
  ...user,
  roles: [...user.roles]
});

const cloneSession = (session: SessionRecord): SessionRecord => ({
  ...session
});

const cloneTask = (task: TaskRecord): TaskRecord => ({
  ...task
});

export class JsonDatabases {
  private readonly authDbPath: string;
  private readonly appDbPath: string;

  private authDb: AuthDatabaseFile = defaultAuthDb();
  private appDb: AppDatabaseFile = defaultAppDb();

  private writeChain: Promise<void> = Promise.resolve();

  public constructor(private readonly dataDir: string) {
    this.authDbPath = path.resolve(dataDir, AUTH_DB_FILE);
    this.appDbPath = path.resolve(dataDir, APP_DB_FILE);
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    this.authDb = await this.loadFile(this.authDbPath, defaultAuthDb, parseAuthDb);
    this.appDb = await this.loadFile(this.appDbPath, defaultAppDb, parseAppDb);

    await this.cleanupExpiredSessions();
  }

  public async createUser(username: string, passwordHash: string): Promise<UserRecord> {
    const normalizedUsername = username.trim().toLowerCase();

    if (this.authDb.users.some((user) => user.normalizedUsername === normalizedUsername)) {
      throw new ValidationError('User already exists');
    }

    const user: UserRecord = {
      id: randomUUID(),
      username: username.trim(),
      normalizedUsername,
      passwordHash,
      roles: ['user'],
      createdAtIso: nowIso()
    };

    this.authDb.users.push(user);
    await this.persistAuth();

    return cloneUser(user);
  }

  public async findUserByUsername(username: string): Promise<UserRecord | null> {
    const normalized = username.trim().toLowerCase();
    const found = this.authDb.users.find((user) => user.normalizedUsername === normalized);
    return found ? cloneUser(found) : null;
  }

  public async findUserById(userId: string): Promise<UserRecord | null> {
    const found = this.authDb.users.find((user) => user.id === userId);
    return found ? cloneUser(found) : null;
  }

  public async createSession(
    userId: string,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<SessionRecord> {
    const session: SessionRecord = {
      tokenHash,
      userId,
      createdAtIso: nowIso(),
      expiresAtIso
    };

    this.authDb.sessions = this.authDb.sessions.filter((item) => item.tokenHash !== tokenHash);
    this.authDb.sessions.push(session);
    await this.persistAuth();

    return cloneSession(session);
  }

  public async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const found = this.authDb.sessions.find((session) => session.tokenHash === tokenHash);
    if (!found) {
      return null;
    }

    if (new Date(found.expiresAtIso).getTime() <= Date.now()) {
      return null;
    }

    return cloneSession(found);
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    this.authDb.sessions = this.authDb.sessions.filter(
      (session) => session.tokenHash !== tokenHash
    );
    await this.persistAuth();
  }

  public async createTask(input: {
    title: string;
    ownerUserId: string;
    correlationId: string;
  }): Promise<TaskRecord> {
    const createdAtIso = nowIso();

    const task: TaskRecord = {
      id: randomUUID(),
      title: input.title,
      ownerUserId: input.ownerUserId,
      status: 'queued',
      correlationId: input.correlationId,
      createdAtIso,
      updatedAtIso: createdAtIso
    };

    this.appDb.tasks.push(task);
    await this.persistApp();

    return cloneTask(task);
  }

  public async getTaskById(taskId: string): Promise<TaskRecord | null> {
    const found = this.appDb.tasks.find((task) => task.id === taskId);
    return found ? cloneTask(found) : null;
  }

  public async listTasksByOwner(ownerUserId: string): Promise<TaskRecord[]> {
    return this.appDb.tasks
      .filter((task) => task.ownerUserId === ownerUserId)
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
      .map((task) => cloneTask(task));
  }

  public async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    lastError?: string
  ): Promise<TaskRecord | null> {
    const task = this.appDb.tasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }

    task.status = status;
    task.updatedAtIso = nowIso();

    if (lastError) {
      task.lastError = lastError;
    } else {
      delete task.lastError;
    }

    await this.persistApp();

    return cloneTask(task);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const before = this.authDb.sessions.length;
    this.authDb.sessions = this.authDb.sessions.filter(
      (session) => new Date(session.expiresAtIso).getTime() > now
    );

    if (this.authDb.sessions.length !== before) {
      await this.persistAuth();
    }
  }

  private async persistAuth(): Promise<void> {
    await this.enqueueWrite(async () => {
      await fs.writeFile(this.authDbPath, `${JSON.stringify(this.authDb, null, 2)}\n`, 'utf8');
    });
  }

  private async persistApp(): Promise<void> {
    await this.enqueueWrite(async () => {
      await fs.writeFile(this.appDbPath, `${JSON.stringify(this.appDb, null, 2)}\n`, 'utf8');
    });
  }

  private async enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.writeChain.then(() => operation());
    this.writeChain = next.catch(() => undefined);
    await next;
  }

  private async loadFile<T>(
    filePath: string,
    fallbackFactory: () => T,
    parser: (input: unknown) => T
  ): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return parser(parsed);
    } catch (error) {
      const fallback = fallbackFactory();
      await fs.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');

      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return parser(fallback);
      }

      return fallback;
    }
  }
}
