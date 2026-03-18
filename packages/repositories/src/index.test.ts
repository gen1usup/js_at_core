import { describe, expect, it } from 'vitest';
import type { HttpClient, HttpRequest, HttpResponse, PlatformLogger } from '@automation-platform/contracts';
import { TemplateApiRepository } from './index';

const noopLogger: PlatformLogger = {
  child: () => noopLogger,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined
};

class FakeHttpClient implements HttpClient {
  public state: { id: string; status: 'draft' | 'active' | 'archived'; name: string } = {
    id: '1',
    status: 'draft',
    name: 'entity'
  };

  public async send<TResponse, TBody = unknown>(
    request: HttpRequest<TBody>
  ): Promise<HttpResponse<TResponse>> {
    if (request.method === 'POST') {
      const body = request.body as { name?: string; status?: 'draft' | 'active' | 'archived' } | undefined;
      this.state = {
        id: '1',
        name: body?.name ?? 'entity',
        status: body?.status ?? 'draft'
      };
    }

    if (request.method === 'PUT') {
      const body = request.body as { status?: 'draft' | 'active' | 'archived' } | undefined;
      this.state.status = body?.status ?? this.state.status;
    }

    return {
      status: 200,
      headers: {},
      durationMs: 1,
      data: {
        id: this.state.id,
        name: this.state.name,
        status: this.state.status,
        createdAtIso: new Date().toISOString()
      } as TResponse
    };
  }
}

describe('repositories', () => {
  it('supports scenario-oriented operations for api repository', async () => {
    const client = new FakeHttpClient();
    const repository = new TemplateApiRepository(client, noopLogger);

    const created = await repository.createMinimalValid('A');
    expect(created.status).toBe('draft');

    await repository.update(created.id, { status: 'active' });
    const waited = await repository.waitUntilStatus(created.id, 'active', {
      timeoutMs: 1000,
      pollingIntervalMs: 20
    });

    expect(waited.status).toBe('active');
  });
});

