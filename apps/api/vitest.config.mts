import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  // O vite carregaria o `zod` ESM, e o `@lanceauto/shared` compilado (CJS) o `zod` CJS: duas cópias, e o
  // `.openapi()` do `zod-to-openapi` só vale na que ele estendeu. Fixar a CJS deixa uma só, como em produção.
  resolve: { alias: [{ find: /^zod$/, replacement: require.resolve("zod") }] },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Um Postgres compartilhado em DATABASE_URL_TEST: arquivos rodam um por vez (T2).
    fileParallelism: false,
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
