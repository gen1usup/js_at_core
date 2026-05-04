import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { JsonDatabases } from './database';
import type { PublicUser, UserRecord } from './types';
import { ValidationError } from './validation';

const PASSWORD_KEY_BYTES = 32;

const hashPassword = (plainText: string): string => {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(plainText, salt, PASSWORD_KEY_BYTES).toString('hex');
  return `${salt}:${digest}`;
};

const verifyPassword = (plainText: string, encodedHash: string): boolean => {
  const [salt, expectedHex] = encodedHash.split(':');
  if (!salt || !expectedHex) {
    return false;
  }

  const computedHex = scryptSync(plainText, salt, PASSWORD_KEY_BYTES).toString('hex');

  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  const computedBuffer = Buffer.from(computedHex, 'hex');

  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, computedBuffer);
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const generateAccessToken = (): string =>
  `${randomBytes(24).toString('hex')}${Date.now().toString(16)}`;

const toPublicUser = (record: UserRecord): PublicUser => ({
  id: record.id,
  username: record.username,
  roles: [...record.roles]
});

export interface LoginResult {
  token: string;
  expiresAtIso: string;
  user: PublicUser;
}

export class AuthService {
  public constructor(
    private readonly database: JsonDatabases,
    private readonly tokenTtlMs: number
  ) {}

  public async register(input: { username: string; password: string }): Promise<PublicUser> {
    const username = input.username.trim();
    const password = input.password;

    if (username.length < 3 || username.length > 60) {
      throw new ValidationError('Username must contain 3..60 symbols');
    }

    if (password.length < 8 || password.length > 256) {
      throw new ValidationError('Password must contain 8..256 symbols');
    }

    const created = await this.database.createUser(username, hashPassword(password));
    return toPublicUser(created);
  }

  public async login(input: { username: string; password: string }): Promise<LoginResult> {
    const username = input.username.trim();
    const password = input.password;

    const user = await this.database.findUserByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ValidationError('Invalid username or password');
    }

    const token = generateAccessToken();
    const tokenHash = hashToken(token);
    const expiresAtIso = new Date(Date.now() + this.tokenTtlMs).toISOString();

    await this.database.createSession(user.id, tokenHash, expiresAtIso);

    return {
      token,
      expiresAtIso,
      user: toPublicUser(user)
    };
  }

  public async resolveUserByToken(token: string | undefined): Promise<PublicUser | null> {
    if (!token) {
      return null;
    }

    const session = await this.database.findSessionByTokenHash(hashToken(token));
    if (!session) {
      return null;
    }

    const user = await this.database.findUserById(session.userId);
    if (!user) {
      return null;
    }

    return toPublicUser(user);
  }

  public async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.database.revokeSession(hashToken(token));
  }
}
