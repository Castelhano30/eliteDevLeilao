import type { ZodError } from "zod";

/** Primeira mensagem de cada campo, para o `details.fields` do erro `VALIDATION`. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}
