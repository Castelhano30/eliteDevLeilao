import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";
import tseslint from "typescript-eslint";

const WEB = "apps/web/**/*.{ts,tsx,js,jsx,mjs}";

const noDateNow = {
  selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
  message: "Date.now() é proibido aqui: use o Clock injetado (T6).",
};
const noNewDate = {
  selector: "NewExpression[callee.name='Date']",
  message: "new Date() é proibido aqui: use o Clock injetado (T6).",
};

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/next-env.d.ts", "_bmad/**", "_bmad-output/**", ".claude/**", ".agents/**", ".tmp/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  // Web: regras do Next só dentro de apps/web.
  ...nextVitals.map((config) => ({
    ...config,
    files: config.files ?? [WEB],
    settings: { ...config.settings, next: { rootDir: "apps/web" } },
  })),
  {
    files: [WEB],
    languageOptions: { globals: { ...globals.browser } },
  },
  // API: Date só em infra/clock.ts e nos testes (R-0.3, T6).
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/infra/clock.ts", "apps/api/src/**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", noDateNow, noNewDate] },
  },
  // Shared nunca usa Date.now().
  {
    files: ["packages/shared/src/**/*.ts"],
    ignores: ["packages/shared/src/**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", noDateNow] },
  },
);
