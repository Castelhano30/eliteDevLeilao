import { z } from "zod";

export const ROLES = ["BIDDER", "AUCTIONEER"] as const;
export type Role = (typeof ROLES)[number];

/** Rótulo de cada papel em pt-BR (caixa baixa, para frases). */
export const ROLE_LABEL: Record<Role, string> = { BIDDER: "licitante", AUCTIONEER: "leiloeiro" };

/** Tela inicial de cada papel (S01 9.2). */
export function homeFor(role: Role): string {
  return role === "BIDDER" ? "/" : "/painel";
}

export const PASSWORD_MIN = 8;
/** Limite do bcrypt, medido em bytes UTF-8 (R-1.3). `TextEncoder` existe no navegador e no Node. */
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MAX = 120;

export const AUTH_TEXT = {
  nameRequired: "Informe seu nome.",
  nameTooLong: "O nome pode ter até 120 caracteres.",
  emailRequired: "Informe seu e-mail.",
  emailInvalid: "Esse e-mail não parece um e-mail.",
  passwordRequiredRegister: "Informe uma senha.",
  passwordRequiredLogin: "Informe sua senha.",
  passwordTooShort: "A senha precisa de pelo menos 8 caracteres.",
  passwordTooLong: "A senha pode ter até 72 caracteres.",
  roleRequired: "Escolha licitante ou leiloeiro.",
  invalidCredentials: "E-mail e senha não batem. Confira o que está anotado; recuperar senha não é uma opção aqui.",
  emailTaken: "Esse e-mail já está cadastrado. Entre na aba “Entrar”.",
  depositRoleNotAllowed: "Só licitantes depositam saldo simulado.",
  unauthenticated: "Entre para continuar.",
  network: "Não deu para falar com o servidor. Confira a conexão e tente de novo.",
} as const;

export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

const isEmail = (value: string) => z.email().safeParse(value).success;

const emailField = z
  .string({ error: AUTH_TEXT.emailRequired })
  .trim()
  .toLowerCase()
  .min(1, AUTH_TEXT.emailRequired)
  .refine(isEmail, AUTH_TEXT.emailInvalid);

const nameField = z
  .string({ error: AUTH_TEXT.nameRequired })
  .trim()
  .min(1, AUTH_TEXT.nameRequired)
  .max(NAME_MAX, AUTH_TEXT.nameTooLong);

const registerPassword = z
  .string({ error: AUTH_TEXT.passwordRequiredRegister })
  .min(1, AUTH_TEXT.passwordRequiredRegister)
  .min(PASSWORD_MIN, AUTH_TEXT.passwordTooShort)
  .refine((value) => utf8Length(value) <= PASSWORD_MAX_BYTES, AUTH_TEXT.passwordTooLong);

export const registerInputSchema = z.object({
  name: nameField,
  email: emailField,
  password: registerPassword,
  role: z.enum(ROLES, { error: AUTH_TEXT.roleRequired }),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailField,
  password: z.string({ error: AUTH_TEXT.passwordRequiredLogin }).min(1, AUTH_TEXT.passwordRequiredLogin),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}
