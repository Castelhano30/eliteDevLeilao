import type { Express } from "express";

/** Uma rota registrada no Express, como o OpenAPI a escreve: método em minúsculas e `{id}` no lugar de `:id`. */
export interface RegisteredRoute {
  method: string;
  path: string;
}

interface LayerLike {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: LayerLike[] };
}

function collect(stack: LayerLike[], out: RegisteredRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method, path: layer.route.path.replace(/:(\w+)/g, "{$1}") });
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      collect(layer.handle.stack, out);
    }
  }
}

/** Rotas (método + caminho) da pilha do Express 5, incluindo as dos routers montados em `/`. */
export function registeredRoutes(app: Express): RegisteredRoute[] {
  const out: RegisteredRoute[] = [];
  collect((app as unknown as { router: { stack: LayerLike[] } }).router.stack, out);
  return out;
}
