import jwt from "jsonwebtoken";
import { ROLES, type Role } from "@lanceauto/shared";

export const TOKEN_TTL = "7d";

export interface AuthUser {
  id: string;
  role: Role;
}

/** JWT HS256, 7 dias, claims `sub` e `role` (R-1.6). */
export function signToken(secret: string, user: AuthUser): string {
  return jwt.sign({ role: user.role }, secret, { algorithm: "HS256", subject: user.id, expiresIn: TOKEN_TTL });
}

/** Devolve o usuário do token ou `null`. O algoritmo é fixado: `none` e HS512 caem aqui. */
export function verifyToken(secret: string, token: unknown): AuthUser | null {
  if (typeof token !== "string" || token === "") return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || typeof payload.sub !== "string") return null;
    const role = (payload as { role?: unknown }).role;
    if (!ROLES.includes(role as Role)) return null;
    return { id: payload.sub, role: role as Role };
  } catch {
    return null;
  }
}
