export type UserRole = 'user' | 'admin';

export interface UserRecord {
  id: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  roles: UserRole[];
  createdAtIso: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  createdAtIso: string;
  expiresAtIso: string;
}

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface TaskRecord {
  id: string;
  title: string;
  ownerUserId: string;
  status: TaskStatus;
  correlationId: string;
  createdAtIso: string;
  updatedAtIso: string;
  lastError?: string;
}

export interface AuthDatabaseFile {
  users: UserRecord[];
  sessions: SessionRecord[];
}

export interface AppDatabaseFile {
  tasks: TaskRecord[];
}

export interface PublicUser {
  id: string;
  username: string;
  roles: UserRole[];
}

export interface QueueMessage<TPayload> {
  id: string;
  queue: string;
  payload: TPayload;
  correlationId: string;
  createdAtIso: string;
}

export interface TaskQueuePayload {
  taskId: string;
  ownerUserId: string;
}

export interface DemoConfig {
  host: string;
  port: number;
  dataDir: string;
  queueName: string;
  tokenTtlMs: number;
  workerPollMs: number;
}
