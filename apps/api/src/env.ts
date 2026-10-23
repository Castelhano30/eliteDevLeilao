import { z } from "zod";

const flag = z
  .string()
  .optional()
  .transform((value) => value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "precisa ter ao menos 32 caracteres"),
  AUDIT_HMAC_KEY: z.string().min(32, "precisa ter ao menos 32 caracteres"),
  WEB_ORIGIN: z.url(),
  FIPE_BASE_URL: z.url(),
  FIPE_TOKEN: z.string().optional(),
  WIKI_USER_AGENT: z.string().min(1),
  WIKIPEDIA_BASE_URL: z.url(),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_DISABLED: flag,
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Variáveis de ambiente inválidas ou ausentes:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "EnvError";
  }
}

/** Valida as variáveis de ambiente; lança `EnvError` listando cada uma que falhou. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  throw new EnvError(
    result.error.issues.map((issue) => {
      const name = issue.path.join(".") || "(env)";
      const missing = issue.code === "invalid_type" && source[name] === undefined;
      return `${name}: ${missing ? "ausente" : issue.message}`;
    }),
  );
}
