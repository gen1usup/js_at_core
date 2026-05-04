import type { RouteDefinition, RouteRegistry, RouteParams } from '@automation-platform/contracts';

const buildRoute = <TParams extends RouteParams | undefined>(
  name: string,
  template: string
): RouteDefinition<TParams> => ({
  name,
  pathTemplate: template,
  build(params: TParams, query?: Record<string, string | number | boolean | null>) {
    let built = template;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        built = built.replace(`:${key}`, encodeURIComponent(String(value)));
      }
    }

    if (query && Object.keys(query).length > 0) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value === null) {
          continue;
        }
        search.set(key, String(value));
      }
      const serialized = search.toString();
      if (serialized) {
        built += `?${serialized}`;
      }
    }

    return built;
  }
});

export interface TemplateRoutes extends RouteRegistry {
  home: RouteDefinition<undefined>;
  login: RouteDefinition<undefined>;
  entities: RouteDefinition<undefined>;
  entityDetails: RouteDefinition<{ id: string }>;
}

export const templateRoutes: TemplateRoutes = {
  home: buildRoute('home', '/'),
  login: buildRoute('login', '/login'),
  entities: buildRoute('entities', '/entities'),
  entityDetails: buildRoute('entityDetails', '/entities/:id')
};
