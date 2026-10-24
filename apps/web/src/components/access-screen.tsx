"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AUTH_TEXT,
  fieldErrors,
  loginInputSchema,
  registerInputSchema,
  ROLE_LABEL,
  type AuthResponse,
  type Role,
} from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page-shell";
import { RefusalMessage } from "@/components/ui/refusal-message";
import type { ApiResult } from "@/lib/api-client";
import { destinationAfterLogin } from "@/lib/sanitize-next";
import { AccessTabs } from "./access-tabs";
import { useAuth } from "./auth-provider";
import { RoleTickets } from "./role-tickets";

type Errors = Record<string, string>;
type TabId = "criar" | "entrar";

/** Traduz a falha da API em erros por campo e/ou uma mensagem do formulário. */
function explain(result: Extract<ApiResult<AuthResponse>, { ok: false }>): { fields: Errors; form: string | null } {
  const error = result.error;
  if (result.status === null || !error) return { fields: {}, form: AUTH_TEXT.network };
  if (error.code === "VALIDATION") {
    const fields = (error.details as { fields?: Errors } | undefined)?.fields ?? {};
    return { fields, form: Object.keys(fields).length === 0 ? error.message : null };
  }
  if (error.code === "EMAIL_TAKEN") return { fields: { email: AUTH_TEXT.emailTaken }, form: null };
  return { fields: {}, form: error.message };
}

/** Foco no primeiro campo inválido do formulário, depois que a tela refletiu os erros. */
function useFocusFirstInvalid(trigger: unknown) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [trigger]);
  return formRef;
}

export function AccessScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, status, login, register } = useAuth();
  const [tab, setTab] = useState<TabId>(params.get("aba") === "entrar" ? "entrar" : "criar");
  const [role, setRole] = useState<Role>("BIDDER");
  const next = params.get("next");

  // Quem já está logado não tem o que fazer aqui.
  useEffect(() => {
    if (status === "auth" && user) router.replace(destinationAfterLogin(user.role, next));
  }, [status, user, next, router]);

  const finish = (loggedRole: Role) => router.replace(destinationAfterLogin(loggedRole, next));

  return (
    <PageShell>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="titulo-acesso">
          <h1 id="titulo-acesso" className="t-display-titulo mb-6">
            Quem dá mais, leva.
          </h1>
          <p className="t-body-lead mb-6">
            Cadastre-se ou entre para dar lances ou montar lotes. Dinheiro de mentira, emoção de verdade.
          </p>
          <p className="t-body-nota">
            Seu nome nunca aparece em público. Em cada lote você vira um Licitante diferente, tipo Licitante C3E8.
          </p>
        </section>
        <AccessTabs
          label="Acesso"
          value={tab}
          onChange={setTab}
          tabs={[
            {
              id: "criar",
              label: "Criar conta",
              panel: <RegisterForm role={role} onRoleChange={setRole} onDone={finish} register={register} />,
            },
            { id: "entrar", label: "Entrar", panel: <LoginForm onDone={finish} login={login} /> },
          ]}
        />
      </div>
    </PageShell>
  );
}

type RegisterFn = ReturnType<typeof useAuth>["register"];
type LoginFn = ReturnType<typeof useAuth>["login"];

function RegisterForm({
  role,
  onRoleChange,
  onDone,
  register,
}: {
  role: Role;
  onRoleChange: (role: Role) => void;
  onDone: (role: Role) => void;
  register: RegisterFn;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useFocusFirstInvalid(attempt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setFormError(null);
    const parsed = registerInputSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setAttempt((n) => n + 1);
      return;
    }
    setErrors({});
    setSending(true);
    const result = await register(parsed.data);
    if (result.ok) {
      onDone(result.data.user.role);
      return;
    }
    const { fields, form } = explain(result);
    setErrors(fields);
    setFormError(form);
    // O servidor recusou: a senha some, o resto fica como estava.
    if (Object.keys(fields).length > 0) setPassword("");
    setAttempt((n) => n + 1);
    setSending(false);
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-5">
      <RoleTickets value={role} onChange={onRoleChange} error={errors.role} />
      <Field
        label="Nome"
        name="name"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        help="Mínimo de 8 caracteres"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />
      {formError ? <RefusalMessage>{formError}</RefusalMessage> : null}
      <Button type="submit" variant="primario" loading={sending} loadingText="Criando conta…" className="w-full">
        {`Criar conta de ${ROLE_LABEL[role]}`}
      </Button>
      <p className="t-body-nota">Em cada lote você ganha um pseudônimo de 4 caracteres. É ele que aparece nos lances.</p>
    </form>
  );
}

function LoginForm({ onDone, login }: { onDone: (role: Role) => void; login: LoginFn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [credentialsRefused, setCredentialsRefused] = useState(false);
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useFocusFirstInvalid(attempt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setFormError(null);
    setCredentialsRefused(false);
    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setAttempt((n) => n + 1);
      return;
    }
    setErrors({});
    setSending(true);
    const result = await login(parsed.data);
    if (result.ok) {
      onDone(result.data.user.role);
      return;
    }
    if (result.error?.code === "INVALID_CREDENTIALS") {
      setCredentialsRefused(true);
      setFormError(result.error.message);
    } else {
      const { fields, form } = explain(result);
      setErrors(fields);
      setFormError(form);
    }
    setAttempt((n) => n + 1);
    setSending(false);
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-5">
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
        invalid={credentialsRefused}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
        invalid={credentialsRefused}
      />
      {formError ? <RefusalMessage>{formError}</RefusalMessage> : null}
      <Button type="submit" variant="primario" loading={sending} loadingText="Entrando…" className="w-full">
        Entrar no pátio
      </Button>
    </form>
  );
}
