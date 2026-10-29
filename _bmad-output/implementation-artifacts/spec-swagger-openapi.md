---
title: 'Documentação Swagger/OpenAPI da API'
type: 'feature'
created: '2026-10-29'
status: 'done'
baseline_commit: '91e9fa01e34f81703232335039f0b234f2f23166'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-lanceauto/SPEC.md'
---

<frozen-after-approval reason="intenção do usuário">

## Intent

**Problema:** A API do LanceAuto não tem documentação navegável; quem avalia o teste precisa ler o código para saber rotas, corpos, papéis e erros.

**Abordagem:** Gerar um OpenAPI 3.x em `apps/api` a partir dos zod de `packages/shared`, servir a Swagger UI em `/docs` e o JSON em `/docs/openapi.json`. Extra fora das fatias S00–S09: nenhuma rota, service ou tabela muda de comportamento.

## Boundaries & Constraints

**Always:**
- Todas as 22 operações REST existentes entram no documento (inventário: health; auth register/login; me; wallet GET e deposits; catalog brands/models/years/preview; brands; lots GET lista/detalhe, POST criar (JSON e multipart), bids, cancel; my/lots; me/bids; items image e images/{position}; receipts/{token}; lots/{id}/audit).
- Tags: Auth, Conta, Catálogo, Lotes, Lances, Comprovante, Auditoria, Saúde. Resumo e descrição em pt-BR.
- Entradas reaproveitam os zod do shared. Saídas hoje são interfaces TS: schemas zod novos em `apps/api/src/docs/`, cada um amarrado ao tipo do shared em tempo de compilação, para deriva quebrar o `typecheck`.
- Bearer JWT em `requireAuth`; opcional (`security: [{}, {bearerAuth: []}]`) em `optionalAuth`; papel citado na descrição de `requireRole`. Erros no envelope de INV-16 com os códigos reais de `errors.ts` e seus status, mais 429 onde há limitador.
- `…Cents` como inteiro em centavos; datas ISO UTC; ids string sem `format: uuid` (INV-2, T6, armadilha dos ids TEXT).
- Multipart de `POST /lots`: campo `payload` (JSON do lote, até 64 KiB) e partes `images` (até 5, 4 MiB cada, 20 MiB no total, JPEG/PNG/WebP conferidos pelos bytes), tudo lido das constantes do shared. Imagens: `image/jpeg|png|webp` binário, ETag, 304.
- Token do comprovante só como parâmetro de `/receipts/{token}` e como `myReceiptToken`/`receiptToken` nas respostas autenticadas do dono (T9); nenhum DTO público documentado tem `userId`, nome, e-mail nem token.
- Socket.IO fora do OpenAPI; eventos e `lot:join` só em texto na descrição geral, tirados de `events.ts`.
- Versões exatas no `package.json` (T13). Nada de `Date`/`Date.now()` novos em `apps/api/src` fora de `infra/clock.ts` (T6).

**Never:**
- Escrever YAML/JSON do OpenAPI à mão; alterar rotas, services, banco ou migração; importar `apps/api` no web (INV-17); afrouxar o CSP fora de `/docs`; `git push` ou deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| JSON | `GET /docs/openapi.json` | 200, `application/json`, OpenAPI 3.x válido | N/A |
| UI | `GET /docs/` | 200 HTML da Swagger UI; scripts e estilos carregam com o CSP de `/docs` | N/A |
| CSP isolado | `GET /health` | Cabeçalho `Content-Security-Policy` do helmet padrão, inalterado | N/A |
| Rota nova | Rota registrada no Express sem entrada no documento | Teste de cobertura falha nomeando método e caminho | N/A |
| Privacidade | Documento serializado | Sem `userId`, `email` nem `token` em resposta pública | Teste falha |

</frozen-after-approval>

## Code Map

- `apps/api/src/app.ts` -- `helmet()` global (linha ~89): trocar por seleção por caminho (`/docs` usa política própria); montar o router de docs depois do `requestContext`.
- `apps/api/src/routes/*.ts` -- fonte do inventário (paths, middlewares, limitadores); não editar.
- `apps/api/src/errors.ts`, `packages/shared/src/errors.ts` -- `ERROR_CODES`, `ERROR_HTTP_STATUS`, `errorEnvelopeSchema` (já é zod).
- `packages/shared/src/{auth,wallet,bids,cancel,lots,audit,receipts,my-bids,catalog}.ts` -- zod de entrada (`registerInputSchema`, `loginInputSchema`, `depositInputSchema`, `placeBidSchema`, `cancelLotSchema`, `createLotBaseSchema`, `lotListQuerySchema`) e saída (`auditViewSchema` é zod; o resto é `interface`).
- `apps/api/src/middleware/lot-upload.ts` -- limites reais do multipart.
- `apps/api/vitest.config.mts`, `apps/api/test/helpers/app.ts` -- `makeTestApp`/`testEnv`; teste de docs não precisa de banco (`db as never`, como `health.test.ts`).
- Novo `apps/api/src/docs/` -- `registry.ts`, `schemas.ts`, `paths/*.ts`, `document.ts`, `router.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json` + `package-lock.json` -- `@asteasolutions/zod-to-openapi@9.1.0` (peer zod ^4, CJS, publicada em 19/07/2026), `swagger-ui-express@5.0.1` (Express 5 ok), `@types/swagger-ui-express`, e `@apidevtools/swagger-parser` em devDependencies para validar o documento.
- [x] `apps/api/src/docs/schemas.ts` -- zod de saída ligados às interfaces do shared; confirmar se `createLotBaseSchema` (preprocess + refine) gera schema útil, senão descrever o `payload` a partir das mesmas constantes.
- [x] `apps/api/src/docs/paths/*.ts`, `registry.ts`, `document.ts` -- registrar as 22 operações, segurança, erros, multipart e imagens; descrição geral com Socket.IO.
- [x] `apps/api/src/docs/router.ts` + `app.ts` -- `/docs`, `/docs/openapi.json`, CSP próprio só em `/docs`.
- [x] `apps/api/src/docs/*.test.ts` -- validade (swagger-parser), cobertura de rotas contra a pilha do Express, privacidade, CSP de `/docs` x `/health`.
- [x] `_bmad-output/progresso.md` -- diário e relato de IA; `README` com a URL, se couber.

**Acceptance Criteria:**
- Dado o app sem banco, quando `GET /docs/openapi.json`, então 200 e o documento passa no swagger-parser.
- Dado o app, quando uma rota `GET|POST` nova for registrada sem documentar, então o teste de cobertura falha.
- Dado o navegador em `/docs`, então a UI carrega, "Authorize" aceita um Bearer e "Try it out" em `/health` responde.

## Implementation Notes

## Design Notes

- **Exposição:** `/docs` sempre ligado, inclusive em produção. O documento só descreve contratos já públicos e textos canônicos; não lê banco, env nem segredo. Valor do avaliador > risco nulo. Sem env nova.
- **CSP:** `helmet()` padrão no resto; em `/docs`, o mesmo helmet com `contentSecurityPolicy` ajustado (`style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`), medido no navegador, sem `script-src` afrouxado se a UI rodar só com `'self'`.
- **Servidor no documento:** `servers: [{url: "/"}]`, para o "Try it out" funcionar em qualquer host.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (raiz) -- expected: verdes (testes da API com `DATABASE_URL_TEST`).

**Manual checks (if no CLI):**
- API local em `/docs`: UI carrega sem erro de CSP no console, Authorize com Bearer, "Try it out" em `/health` e `/lots`.

## Review Triage Log

| Achado | Veredito | Rota | Evidência |
|--------|----------|------|-----------|
| Exemplo 401 de `POST /lots/{id}/bids` usa `BID_TEXT.unauthenticated` | medium | patch | `BID_TEXT.unauthenticated` não é emitido em lugar nenhum do servidor; `requireAuth` usa `AUTH_TEXT.unauthenticated` |
| Teste de segurança/papéis/429 compara com listas do próprio teste | medium | patch | `registeredRoutes` só lê método e caminho; remover `requireRole` não derruba nenhum teste |
| Validador do Swagger UI (`validator.swagger.io`) fora de localhost | medium | patch | padrão da UI; o `img-src` bloquearia o selo (erro de CSP em produção) |
| `/DOCS/` cai no helmet padrão | low | patch | medido: 200 com `upgrade-insecure-requests`; correção de uma linha |
| `createRequire(process.cwd())` no vitest.config | low | patch | depende do cwd; correção direta |
| Privacidade por lista de nomes exatos | low | patch | nome novo de token/id passaria; troca por regex |
| Literais de mensagem e limite de depósito soltos | low | patch | mesma raiz do exemplo 401; usar as constantes do shared |
| CI não sobe o `dist` com `/docs` | maybe-false | defer | conferido à mão: `dist` (21 caminhos) e `tsx` da dev servem 200; falta só trava em CI |
| `/docs` sem barra pode quebrar assets | false | — | medido: 301 para `/docs/` |
| README com URL de produção antes do deploy | low | rejeitado | deploy está previsto; sem push/deploy a pedido do Felipe |
| `payload` do multipart sem `contentType` JSON | false | — | `lot-upload.ts` lê o campo como texto, não confere o tipo da parte |
| Documento gerado de forma preguiçosa; refazer registro após falha; versão fixa | low | rejeitado | falha é determinística e coberta por teste; correção exige estado novo |
| Prefixo de rota perdido no helper de cobertura | low | rejeitado | falha alto (rota "sem documentação"), nenhum prefixo hoje |
| `bind<T>` não pega campo opcional extra; título de teste exagerado; `Retry-After`/`details` só em prosa; números em prosa; `persistAuthorization` | low | rejeitado | sem dano concreto no uso comum; `persistAuthorization` fica e vai no diário |
