import type { AuthProvider, AuthSession, ExecutionContext } from '@automation-platform/contracts';

export class TemplateAuthProvider implements AuthProvider {
  public readonly name = 'template-auth-provider';

  public async authenticate(context: ExecutionContext): Promise<AuthSession> {
    context.logger.info('Template auth provider: authenticate invoked', {
      executionId: context.executionId,
      strategy: context.capabilityMap.authViaApi ? 'api' : 'ui'
    });

    if (context.capabilityMap.authViaApi) {
      return {
        accessToken: process.env.TEMPLATE_AUTH_TOKEN ?? 'template-token',
        headers: {
          'x-project': context.projectName
        }
      };
    }

    return {
      cookies: [
        {
          name: 'session',
          value: process.env.TEMPLATE_SESSION_COOKIE ?? 'template-session',
          path: '/'
        }
      ]
    };
  }
}
