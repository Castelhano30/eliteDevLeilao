---
id: S00
titulo: Fundação — monorepo, deploy mínimo, tokens/tema, primitivos e CI
depende_de: []
cobre: [MONO, DKR, UX-THEME, O5, O3, DEP, H4]
parcial: [O4, TST, E13, D3, D5, D6, UX-A11Y, UX-RESP, UX-RECON, CLK]
fontes_de_origem: [PRD Arquitetura/Deploy/Monorepo/Docker/Testes · AD-1,3,10,13 · Ambientes e deploy mínimo · DESIGN (todo) · EXPERIENCE Accessibility Floor/Responsive]
---
# S00 — Fundação

## 1. Objetivo e demonstração
Deixar no ar o esqueleto do LanceAuto (web + API + banco), com o sistema visual "Manual de pátio" inteiro em código, para que nenhuma fatia posterior precise abrir o DESIGN.md.

Roteiro de demonstração:
1. `git clone` + `cp .env.example .env` + `docker compose up` sobe db, api e web; `http://localhost:3000` mostra a página diagnóstica.
2. A página diagnóstica exibe "API: ok · Banco: ok" (chama `GET /health`) e "Socket: conectado".
3. O mesmo na URL pública: web na Vercel chamando a API no Render (CORS ok), banco no Neon.
4. Alternar o tema pelo select "Tema" (Sistema/Claro/Noite) troca todas as cores sem flash ao recarregar.
5. `/kit` (só em dev) mostra todos os primitivos nos dois temas.
6. `npm test` e `npm run lint` passam local e no GitHub Actions.

## 2. Fora desta fatia
| Item | Fatia |
|---|---|
| Qualquer tabela/modelo Prisma (User, Wallet…) e a primeira migração real | S01 |
| Auth, Header por papel, BalanceChip | S01 |
| Vitrine (substitui a página diagnóstica) | S02 |
| Salas do Socket.IO, `Publisher` real | S04 |
| Cronometro, PlacaLance, PlacarPosicao, FaixaStatus, LotCard, CarPhoto, Recibo | S02/S03/S05 |
| Remover `/kit` do alcance público, varredura final de a11y | S09 |

## 3. Ponto de partida
Repositório com só `_bmad-output/` versionado (branch `main`, remoto `Castelhano30/eliteDevLeilao`, privado). Esta fatia passa a versionar o código (ajustar `.gitignore` para ignorar `node_modules`, `.next`, `dist`, `.env`, e **não** ignorar mais as pastas de código). Commits atômicos, pt-BR, enxutos, tom humano.

**Invariantes que valem aqui**
- INV-2 Dinheiro em centavos; UI em reais inteiros `R$ 31.000,00` (",00" fixo), em IBM Plex Mono. `MAX_DEPOSIT_CENTS = 1_000_000_000`.
- INV-3 Datas ISO UTC `Z`; `new Date()`/`Date.now()` proibidos fora de `infra/clock.ts`; UI em America/Sao_Paulo.
- INV-4 Mutação só por REST; Socket.IO só transmite; eventos depois do commit via `Publisher`.
- INV-16 Erro: `{ "error": { "code", "message", "details"? } }`.
- INV-17 Contratos em `packages/shared`; `web` nunca importa `apps/api`.
- INV-18 Voz do pátio (pt-BR, sem exclamação/emoji).

## 4. Regras de negócio
Esta fatia não implementa regra de leilão. Regras de engenharia (todas verificáveis):
- R-0.1 Um único repositório com npm workspaces: `apps/web`, `apps/api`, `packages/shared`. `web` e `api` dependem de `shared`; `shared` só depende de `zod`; `web` nunca importa `apps/api`. (MONO · AD-13)
- R-0.2 `apps/api/src/env.ts` valida com zod e **falha no boot** se faltar variável. `AUDIT_HMAC_KEY` ≥ 32 bytes; `JWT_SECRET` ≥ 32 caracteres. (Config)
- R-0.3 `Date`/`Date.now()` só em `infra/clock.ts`. Regra de lint (`no-restricted-syntax`/`no-restricted-globals`) fora desse arquivo e de testes. (AD-10)
- R-0.4 Toda resposta de erro usa o envelope; erros não previstos viram `{code:"INTERNAL", message:"Algo travou do nosso lado. Tente de novo em instantes."}` HTTP 500 e vão para o log com `requestId`, sem stack para o cliente.
- R-0.5 CORS aceita só `WEB_ORIGIN`; `helmet` ligado; rate-limit é utilitário reutilizável (`makeRateLimiter({windowMs,max})`), aplicado só a partir da S01.
- R-0.6 Services recebem `Clock`; produção usa `SystemClock`, testes/seed usam `FakeClock` (`now()`, `set(date)`, `advance(ms)`).
- R-0.7 Rotas só validam (zod), autenticam e chamam service; services devolvem `DomainEvent[]`; a rota entrega ao `Publisher` depois do commit (nesta fatia `NoopPublisher`). (AD-1)
- R-0.8 Nada que o usuário digitou é perdido por falha de rede (princípio do `apiClient`/formulários: erros voltam como objeto, não lançam sem tratamento).

## 5. Modelo de dados
`apps/api/prisma/schema.prisma` com **apenas** `generator` e `datasource` (sem modelos):
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }
```
Não criar enums nem tabelas. `prisma migrate deploy` roda no start da API e passa sem migrações pendentes (a primeira migração real é da S01). `/health` testa o banco com `SELECT 1` via `$queryRaw`.

## 6. Contratos REST
| Rota | Papel | Resposta | Erros |
|---|---|---|---|
| `GET /health` | público | `200 { "ok": true, "db": true }`; se o banco falhar `503 { "ok": false, "db": false }` (sem envelope) | — |

Envelope de erro e tabela de códigos que o `ErrorCode` de `shared` já deve conter desde o dia 1 (as fatias usam, não redefinem):

| Código | HTTP | `details` |
|---|---|---|
| `BELOW_MINIMUM` | 422 | `{ minimumCents, currentBidCents, reason: "MINIMUM"\|"OUTDATED" }` |
| `INSUFFICIENT_BALANCE` | 422 | `{ availableCents }` |
| `ALREADY_WINNING` | 409 | — |
| `LOT_NOT_STARTED` | 409 | `{ startsAt }` |
| `LOT_ENDED` | 409 | — |
| `LOT_CANCELLED` | 409 | — |
| `LOT_CHANGED` | 409 | `{ entryCount }` |
| `ROLE_NOT_ALLOWED` | 403 | — |
| `FORBIDDEN` | 403 | — (não é dono) |
| `UNAUTHENTICATED` | 401 | — |
| `VALIDATION` | 400 | `{ fields: { campo: "mensagem" } }` |
| `EMAIL_TAKEN` | 409 | — |
| `INVALID_CREDENTIALS` | 401 | — |
| `NOT_FOUND` | 404 | — |
| `EXTERNAL_UNAVAILABLE` | 503 | `{ source: "FIPE"\|"WIKIPEDIA" }` |
| `INTERNAL` | 500 | — |
| `RATE_LIMITED` | 429 | — (mensagem: "Calma, uma coisa de cada vez. Tente de novo em instantes.") |

## 7. Contratos Socket.IO
Socket.IO 4.x montado no mesmo `http.Server` do Express, caminho padrão `/socket.io`, CORS só `WEB_ORIGIN`. Aceita conexão com `auth: { token? }` opcional; **nesta fatia o token não é validado** (a S01 valida e entra o socket em `user:{id}`). Sem salas e sem eventos de negócio. Constantes de nomes de eventos em `packages/shared/events.ts`:
`bid:placed`, `lot:closed`, `lot:cancelled`, `showcase:lot`, `wallet:updated` (S→C); `lot:join`, `showcase:join` (C→S). Payloads serão tipados pelas fatias donas.

`DomainEvent` = `{ type: EventName; room: string; payload: unknown }`. `Publisher` = `{ publish(events: DomainEvent[]): void }`. `NoopPublisher` descarta.

## 8. Mensagens
Texto do erro interno e do rate-limit na tabela da seção 6. Textos da página diagnóstica (provisória, só pt-BR): "API: ok", "API: fora do ar", "Banco: ok", "Socket: conectado", "Socket: desconectado".

## 9. Telas e estados
### 9.1 Layout raiz (`app/layout.tsx`)
- `<html lang="pt-BR">`, `data-theme` definido por **script inline antes da pintura** (ver 10.1).
- "Pular para o conteúdo" (SkipLink) como primeiro elemento focável, visível ao receber foco, alvo `#conteudo` no `<main>`.
- Landmarks: `header`, `nav` (com `aria-label`), `main id="conteudo"`.
- Providers: TanStack Query, cliente Socket.IO (singleton, conecta ao montar; sem salas).
- Largura máxima do conteúdo 1320px, margem lateral `clamp(16px,4vw,56px)`.

### 9.2 Página diagnóstica (`/`)
Provisória (a S02 substitui). `PageShell` com título "LanceAuto" (display-titulo), três linhas de status em `mono-dado`: API, Banco, Socket, cada uma com ponto colorido **e** texto (nunca só cor: verde só para "ok"; ferrugem para falha). Estados: carregando ("Consultando…" em FeedbackState), erro (FeedbackState erro com "Tentar novamente"), ok.

### 9.3 `/kit` (apenas `NODE_ENV !== "production"`)
Página com todos os primitivos e variantes, com ThemeSwitch no topo. Em produção retorna `notFound()`. Serve de checklist visual de S00 e de referência viva para as fatias.

### 9.4 Estados globais obrigatórios dos primitivos
`prefers-reduced-motion`: animações desligadas e o estado final aparece direto (nada some porque a animação foi cortada).

## 10. Componentes criados

### 10.1 Tokens e tema (copiar literalmente para `app/globals.css` e `tailwind.config`)

**Cores — tema claro "De dia · papel"** (`:root`, e `[data-theme="claro"]`):
```css
--c-fundo:#E8DFCB; --c-papel:#F5EEDF; --c-suave:#DDD3BC; --c-pontos:#C9BEA5;
--c-tinta:#1E1C19; --c-tinta2:#5B5449; --c-linha:#1E1C19; --c-sombra:#1E1C19;
--c-tracejado:#8A8273; --c-ocre:#E2A514; --c-sobre-ocre:#1E1C19;
--c-ferrugem:#A43C1E; --c-verde:#2E6A3E; --c-sobre-cor:#F5EEDF;
--c-painel:#141311; --c-led:#F2B92B; --c-led-alerta:#FF6A3D; --c-falha:rgba(164,60,30,.12);
```
**Cores — tema noite "À noite · carvão"** (`[data-theme="noite"]`; e em `@media (prefers-color-scheme: dark)` sob `:root:not([data-theme="claro"])`):
```css
--c-fundo:#161513; --c-papel:#262420; --c-suave:#2F2C27; --c-pontos:#3F3B34;
--c-tinta:#ECE4D2; --c-tinta2:#B3AA99; --c-linha:#CFC5B0; --c-sombra:#3A362F;
--c-tracejado:#6E675C; --c-ocre:#E8AE22; --c-sobre-ocre:#161513;
--c-ferrugem:#E36A43; --c-verde:#74B585; --c-sobre-cor:#161513;
--c-painel:#0B0B0A; --c-led:#F2B92B; --c-led-alerta:#FF6A3D; --c-falha:rgba(227,106,67,.16);
```
**Literais fixos** (iguais nos dois temas, não acompanham o tema): `--f-faixa-placa:#E2A514; --f-brasil-texto:#FFFFFF; --f-digito-placa:#F5EEDF; --f-linha-central-placa:#000000; --f-rotulo-relogio:#8A8273; --f-rotulo-nota-painel:#B3AA99;`

Tailwind: `theme.extend.colors` mapeia cada chave para `var(--c-…)` (ex. `fundo`, `papel`, `suave`, `pontos`, `tinta`, `tinta2`, `linha`, `sombra`, `tracejado`, `ocre`, `sobreOcre`, `ferrugem`, `verde`, `sobreCor`, `painel`, `led`, `ledAlerta`, `falha`) e as fixas (`faixaPlaca`, `brasilTexto`, `digitoPlaca`, `linhaCentralPlaca`, `rotuloRelogio`, `rotuloNotaPainel`). Proibido qualquer cor fora desta lista, gradiente, sombra com blur, segundo botão ocre na mesma tela.

**Papéis das cores:** ocre = ação (só ela pede clique; um botão ocre por tela; também etiqueta de lote ao vivo/agendado, marca "VOCÊ", selo "+2 MIN"); tinta/linha/sombra = texto, bordas, sombras (`tinta2` = texto secundário); papel/fundo/suave/pontos = superfícies (`fundo` página, `papel` cartões/recibos, `suave` fundo de imagem/desabilitado/abas inativas, `pontos` pontilhado); ferrugem = superado, tempo acabando, adulterado, erro, selo Ao vivo; verde = "ganhando" e "íntegro", **mais nada**; `painel/led/ledAlerta` = display do cronômetro e placas; `falha` = linha de auditoria que não confere.

**Tema — mecanismo:** padrão `prefers-color-scheme` (sistema). Chave manual em `localStorage["lanceauto-tema"]` ∈ `"claro"|"noite"` (ausente = sistema). Script inline no `<head>` (antes da pintura) lê a chave (em try/catch) e, se existir, define `document.documentElement.dataset.theme`; se não existir, não define (CSS segue o sistema). Sistema acompanha mudança do SO; escolha manual prevalece.

**Tipografia** (3 famílias via `next/font/google`; fallback Georgia/serif para Newsreader, monospace para Plex): Big Shoulders Display 600/800/900; IBM Plex Mono 400/500/600; Newsreader 400/600 normal e itálico, opsz 6..72. Regra de ouro: lote, R$, cronômetro, pseudônimo e hash **sempre** em IBM Plex Mono; cartaz (títulos, botões, carimbos) sempre CAIXA-ALTA em Big Shoulders 800–900, entrelinha apertada. Classes utilitárias (`.t-<nome>`):

| Classe | Família | Tamanho | Peso | Entrelinha | Extra |
|---|---|---|---|---|---|
| `t-display` | Big Shoulders | — | 900 | 1 | caixa-alta |
| `t-mono` | Plex Mono | 14px | 400 | 1.3 | |
| `t-logo` | Big Shoulders | 56px | 800 | 1 | ls .1em |
| `t-logo-tela` | Big Shoulders | 30px | 800 | 1 | ls .1em |
| `t-display-hero` | Big Shoulders | clamp(68px,11vw,184px) | 900 | .8 | |
| `t-display-titulo` | Big Shoulders | clamp(60px,9vw,132px) | 900 | .84 | |
| `t-display-secao` | Big Shoulders | clamp(46px,6vw,76px) | 900 | 1 | |
| `t-cartaz-cartao` | Big Shoulders | 32px | 800 | 1 | |
| `t-cartaz-subtitulo` | Big Shoulders | 26px | 800 | 1 | |
| `t-botao-primario` | Big Shoulders | 22px | 900 | 1 | ls .04em |
| `t-botao` | Big Shoulders | 20px | 800 | 1 | ls .04em |
| `t-carimbo` | Big Shoulders | 26px | 900 | 1 | ls .08em |
| `t-placar` | Big Shoulders | 30px | 900 | 1 | |
| `t-numero-lote` | Big Shoulders | 52px | 900 | .9 | |
| `t-body-lead` | Newsreader | 21px | 400 | 1.4 | |
| `t-body` | Newsreader | 17px | 400 | 1.45 | |
| `t-body-nota` | Newsreader | 15px | 400 | 1.35 | cor tinta2 |
| `t-body-legenda` | Newsreader | 13px | 400 | 1.3 | |
| `t-mono-recibo` | Plex Mono | 17px | 400 | 1.7 | |
| `t-mono-dado` | Plex Mono | 14px | 600 | 1.3 | |
| `t-mono-rotulo` | Plex Mono | 12px | 400 | — | ls .12em, caixa-alta |
| `t-mono-rotulo-pequeno` | Plex Mono | 10px | 400 | — | ls .16em, caixa-alta |
| `t-cronometro` | Plex Mono | 40px | 600 | 1 | (Sala 58px, cartão 28px) |

Outras medidas observadas: h1 de tela Sala `clamp(48px,7vw,104px)` lh .84; Acesso `clamp(64px,9vw,140px)`; botão primário da Sala 30px/min-height 64; carimbo Arrematado na Sala 52px; rótulos mono 10–13px caixa-alta tracking .10–.16em.

**Raios** (`rounded`): `nenhum:0` (cartões, botões, inputs, tabelas), `placa:3px`, `logo-interno:6px`, `logo-tela:7px`, `logo:10px`, `circulo:50%`. Canto reto é a regra (0–2px).

**Espaçamento (valores observados, não escala nomeada):** 8, 12, 14, 16, 18, 20, 24, 26, 30, 32, 36, 40, 48px; `gutter-lateral: clamp(16px,4vw,56px)`; `container-max:1320px`; `container-comprovante:1200px`; `pagina-manual:1440px`; `celular:390px`; `cartao-padding:24px`; `alvo-minimo:44px`; `botao-altura:52px`.

**Bordas:** padrão 3px sólida em `linha`; título/cabeçalho 4px; destaque 5px (ex. Disponível na Carteira, carimbo grande); carimbo 4px sólida + `outline:2px solid; outline-offset:3px` (exceto "Sem lances": 4px tracejada, sem outline); divisória/chip 2px; tracejada-divisória 2px dashed `tracejado`. Tracejado = "não é botão, é papel": divisor 2px dashed `tracejado`, recibo 2px dashed, recusa 2px dashed `ferrugem`, desabilitado 3px dashed `tinta2`, vazio 3px dashed `tracejado`.

**Sombras (duras, sem blur, sempre na cor `sombra`):** cartão/peça `6px 6px 0`; botão `5px 5px 0`; botão pressionado `2px 2px 0` (e translada 3px); logo-e-pequenos/chips `4px 4px 0`; imagem-e-painel/diálogo `8px 8px 0`. Noite: sombra `#3A362F`, borda `#CFC5B0` (já nos tokens).

**Movimento (keyframes):** `la-pulsa` (opacidade 1→.35→1; 1.2s em pontos e selo, 1s no cronômetro de alerta, .7–.8s em "consultando"); `la-vira` (rotateX 90°→0, .5s; atraso .06s por dígito); `la-bate` (carimbo escala 2.6→1, `cubic-bezier(.2,.8,.3,1)`, .55–.6s, assenta em -6°); `la-mais` (selo "+2 MIN" sobe e fixa, .6s); `la-entra` (linha nova desce de -16px, .4s); `la-marca` (linha nova flash ocre `rgba(226,165,20,.55)`→0, 1.6–1.8s). Global obrigatório:
```css
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
```
Nenhum estado depende de animação para ser percebido.

**Foco global:** `outline:3px solid var(--c-tinta); outline-offset:3px; box-shadow:0 0 0 3px var(--c-papel)` em `:focus-visible` de links, botões, campos e do cartão do radio quando o input recebe foco. Nunca remover. Links: `color:var(--c-tinta)`, `:hover{color:var(--c-ferrugem)}`.

**Contraste (verificado, não regredir):** rótulo relógio #8A8273 sobre painel #141311 = 4,88:1; papel sobre verde ou ferrugem (claro) = 5,60:1; ferrugem noite sobre papel noite = 4,73:1. "BRASIL" branco sobre faixa #E2A514 = 2,18:1 → **restrito à marca decorativa**, nunca em texto de interface. Texto de interface ≥ 4,5:1 (3:1 para texto grande e controles/foco).

### 10.2 Primitivos (cada um em `apps/web/src/components/ui/`, com variantes visíveis em `/kit`)

**Logo (logo-placa).** Link para `/` com `aria-label="LanceAuto, vitrine"`. Placa Mercosul: contorno 4px `tinta`, raio externo 10px (manual) / 7px (telas, `t-logo-tela` 30px), sombra `6px 6px 0` (`4px 4px 0` nas telas). Faixa superior `faixaPlaca` com "BRASIL" `brasilTexto` (Plex Mono 12px/600, ls .5em; nas telas 8px, ls .42em), **decorativo `aria-hidden`**. Placa inferior: `margin:0 4px 4px`, `padding:8px 16px 5px`, borda 2px sem o lado de cima, raio `0 0 6px 6px`, dois pontos redondos de 8px nas laterais, texto "LANCE·AUTO" Big Shoulders 800 (56px manual; 28–30px nas telas) ls .1em. Contorno e letras seguem a cor de texto do tema; faixa e branco fixos.

**Button.** Props `variant: "primario"|"secundario"|"desabilitado"|"atalho"`, `destrutivo?` (só secundário: texto `ferrugem`). Raio 0, `min-height:52px` (atalho 44px).
- primário: fundo `ocre`, texto `sobreOcre`, `t-botao-primario`, borda 3px `tinta`, sombra `5px 5px 0 sombra`, padding `10px 26px 8px`; `:active` translada 3px e sombra `2px 2px 0`. **Só um por tela** (na camada ativa, quando houver diálogo).
- secundário: fundo `papel`, texto `tinta`, `t-botao`, borda 3px `tinta`, sombra `5px 5px 0`, padding `10px 22px 8px`.
- desabilitado: usa `disabled` real; fundo `suave`, texto `tinta2`, `t-botao`, borda `3px dashed tinta2`, sem sombra, cursor padrão.
- atalho: borda 2px `linha`, `t-mono` 14px, min-height 44px (ex. "+ R$ 500").
- Estado "enviando": botão fica inerte (`aria-disabled`, sem trocar para variante desabilitada), texto trocável por prop.
- Alvo de toque ≥ 44px em todos.

**Field.** Rótulo visível sempre (`t-mono-rotulo`, caixa-alta); o rótulo **não** contém ajuda — ajuda vai em `aria-describedby`. Caixa fundo `fundo`, borda 3px `linha`, raio 0, `min-height:50px`, Newsreader 19px. Erro: `aria-invalid="true"`, borda 3px `ferrugem`, mensagem textual ligada por `aria-describedby`. Placeholder `tinta2`, nunca substitui rótulo. Desabilitado: `suave`/`tinta2`, sem sombra. Preserva o valor digitado em erro. Props para variantes: `prefix`/`suffix` (campo composto de lance e depósito usam: prefixo "R$" Plex Mono 600 18px, input numérico Plex Mono 600 28px min-height 56px, sufixo fixo ",00"), `inputMode`, `mask`.

**RefusalMessage (mensagem-recusa).** `role="alert"`; caixa transparente, borda `2px dashed ferrugem`, texto `ferrugem`, padding `8px 10px`, `t-body-nota` (15px/1.35), ícone SVG 18×18 (círculo cortado, traço 2px, `aria-hidden`), raio 0. Ícone + texto juntos, nunca só cor. Aceita `action` (link, ex. "Depositar na carteira →" em `ferrugem` peso 600). Uma por vez; fica "colada" ao botão que a causou.

**FeedbackState (estado-feedback).** Fundo `papel`, texto `tinta2`, borda `3px dashed tracejado`, padding 24px. Variantes: `carregando` ("Carregando…", preserva o espaço da região), `vazio`, `erro` (cor `ferrugem` + texto + botão secundário "Tentar novamente"). Sem skeleton animado obrigatório. Falha de rede mantém dados anteriores marcados como desatualizados. Sucesso genérico é neutro (nunca verde decorativo). Anuncia por live region (`role="status"`, e `role="alert"` no erro).

**Stamp (carimbo).** `t-carimbo` (26px; "Arrematado" grande na Sala 52px), caixa-alta, padding `4px 12px 2px`, lh 1, raio 0, borda 4px sólida + `outline:2px; outline-offset:3px`.
| Variante | Cor | Rotação |
|---|---|---|
| Ao vivo | `ferrugem` | -5° |
| Arrematado | `tinta` | +3° |
| Sem lances | `tinta2`, borda 4px **tracejada**, sem outline | -2° |
| Íntegro | `verde` | -7° |
| Adulterado | `ferrugem` | +4° |
| Cancelado | `tinta2` | -4° |
Ao encerrar "bate" (`la-bate`) e assenta em -6°. O texto do carimbo é o status; não depende da rotação nem da cor. Prop `animate`. **Ao vivo** inclui o ponto de 10px com `la-pulsa 1.2s infinite` (parado em reduced-motion) — é o `selo-ao-vivo` (rotação -5°, texto `ferrugem`).

**LotTag (etiqueta-lote).** "Etiqueta amarrada no retrovisor". Fundo `ocre` (lote ao vivo ou agendado) ou `papel` (encerrado); contorno 3px via `clip-path` chanfrado (18px externo/17px interno); padding `10px 18px 8px 36px`; furo circular 10×10 com borda 3px, fundo `fundo`, `left:10px`; rótulo "LOTE" Plex Mono 11px ls .14em; número `t-numero-lote` (52px; nas telas 34–64px), exibido com 3 dígitos (`018`). Cordão SVG de 2 curvas, traço 2.5px, `left:-22px; top:-26px; z-index:2`, sempre saindo do furo. Rotação -4° a +3° (-2° encerrados). Decorativa: nunca é o único meio de saber o status.

**Perforation (picote).** Altura 24px, fundo `papel`, linha `2px dashed tracejado` (`left/right:20px; top:11px`), dois semicírculos 24×24 nas laterais com fundo `fundo`. "O picote separa o que se destaca."

**DataTable (tabela).** `<table>` com `caption` (visualmente oculta quando o título já está na tela) e `th scope="col"`. Fundo `papel`, borda 3px `linha`, sombra `6px 6px 0`, linhas separadas por `2px dashed tracejado`. Cabeçalho Plex Mono 11px, peso 500, ls .12em, cor `tinta2`, padding 12px 8px (20px nas extremidades), borda inferior 3px `linha`; células padding 14px 8px (20px nas extremidades). Valores Plex Mono; tipo de movimento Big Shoulders caixa-alta. `min-width` 560–780px (prop) dentro de contêiner `role="region"`, `tabindex="0"`, `aria-label` obrigatório, `overflow-x:auto`. Ações dentro da linha mantêm alvo ≥ 44px.

**FilterTabs (aba-filtro).** Grupo de botões `aria-pressed`, altura 48px, borda 3px `linha`, canto reto (apesar do nome "pill"). Ativa: fundo `tinta`, texto `fundo`; inativa transparente. Contador opcional Plex Mono de 2 dígitos. Não confundir com as abas do Acesso (S01).

**Dialog (dialogo).** Fundo `papel`, texto `tinta`, borda 3px `linha`, sombra `8px 8px 0`, padding 24px, largura máx. 560px, margem lateral mínima 16px, raio 0; backdrop `rgba(30,28,25,.65)`. Comportamento: no máx. um nível; `role="dialog"` + `aria-modal` + `aria-labelledby`; foco vai ao título ao abrir (`tabindex="-1"`) e **volta ao elemento de origem** ao fechar; `Esc` fecha sem agir; conteúdo sob o diálogo fica `inert`; tab preso dentro. Duas ações que quebram linha: secundário "Voltar" e primário/destrutivo; a única ação primária da camada ativa é o ocre.

**IdentityChip (chip-identidade).** Fundo `papel`, texto `tinta`, borda 2px `linha`, `t-mono`, padding `8px 12px`. Conteúdo "VOCÊ · Licitante" ou "VOCÊ · Leiloeiro" (o "VOCÊ" com fundo `ocre`, peso 600). **Nunca mostra pseudônimo** (pseudônimo é por lote).

**ThemeSwitch.** `<select>` nativo rotulado "Tema" com opções Sistema/Claro/Noite, altura 48px, tokens de campo. Persiste em `localStorage` (try/catch); "Sistema" remove a chave.

**SkipLink.** "Pular para o conteúdo", `href="#conteudo"`, oculto até receber foco; ao receber foco aparece com `Button secundário`.

**PageShell.** Contêiner `max-width:1320px`, margens laterais `clamp(16px,4vw,56px)`, título de página opcional (`t-display-titulo`), espaço vertical 48px; aceita `width="comprovante"` (1200px).

Responsivo: **sem media queries de largura**; reflow por `flex-wrap`, `grid` com `auto-fit/auto-fill` e `minmax(min(100%,N),1fr)`, `clamp()`. Referências 1440px e 390px; validar 320px e zoom 200%. Só tabelas rolam na horizontal.

## 11. Seed desta fatia
Nenhum dado. Cria o esqueleto: `apps/api/prisma/seed.ts` (função `main` vazia que loga "sem dados ainda") e scripts `npm run seed` e `npm run seed:demo` apontando para ele. `fipe-fixture.json` fica para S02.

## 12. Critérios de aceite
- AC-0.1 [auto] Dado `docker compose up` com `.env` copiado do `.env.example`, quando chamo `GET /health`, então recebo `200 {"ok":true,"db":true}`.
- AC-0.2 [auto] Dado o banco parado, quando chamo `GET /health`, então recebo `503 {"ok":false,"db":false}`.
- AC-0.3 [auto] Dado `JWT_SECRET` ausente, quando a API sobe, então o processo encerra com mensagem listando a variável faltante.
- AC-0.4 [auto] Dado `AUDIT_HMAC_KEY` com menos de 32 bytes, quando a API sobe, então encerra com erro.
- AC-0.5 [auto] Dado uma rota que lança `Error` genérico, quando é chamada, então a resposta é `500` com `{error:{code:"INTERNAL",message:"Algo travou do nosso lado. Tente de novo em instantes."}}` sem stack, e o log tem o `requestId`.
- AC-0.6 [auto] Dado `AppError(VALIDATION,{fields:{email:"x"}})`, quando lançado, então a resposta é `400` com o envelope e `details.fields`.
- AC-0.7 [auto] Dado `FakeClock.set(2026-10-22T14:00:00.000Z)`, quando um service pede `clock.now()`, então recebe exatamente esse instante; e `advance(120000)` o move para 14:02:00.000Z.
- AC-0.8 [manual] Dado a web publicada na Vercel e a API no Render, quando abro `/`, então vejo "API: ok", "Banco: ok" e "Socket: conectado", sem erro de CORS no console.
- AC-0.9 [manual] Dado o select Tema em "Noite", quando recarrego a página, então o `<html data-theme="noite">` já está definido antes da primeira pintura (sem flash claro).
- AC-0.10 [manual] Dado "Sistema" e o SO em modo escuro, quando abro a página, então as cores são as do tema noite; trocar o SO para claro muda sem recarregar.
- AC-0.11 [manual] Dado `/kit`, quando navego só com teclado, então todo elemento interativo mostra o foco (outline 3px + halo) nos dois temas, e o "Pular para o conteúdo" é o primeiro foco.
- AC-0.12 [manual] Dado `prefers-reduced-motion: reduce`, quando abro `/kit`, então carimbos, pontos e placas aparecem no estado final, sem animação.
- AC-0.13 [manual] Dado `/kit` a 320px e a 390px e com zoom 200%, quando rolo, então não há rolagem horizontal da página (só dentro do DataTable).
- AC-0.14 [manual] Dado `NODE_ENV=production`, quando abro `/kit`, então recebo 404.
- AC-0.15 [auto] Dado um push no GitHub, quando o Actions roda, então lint, typecheck e testes passam com um Postgres de serviço.
- AC-0.16 [auto] Dado `formatBRL(3100000)` então `"R$ 31.000,00"`; `formatBRL(1000000000)` então `"R$ 10.000.000,00"`; `parseReais("31.000")` então `3100000`; entrada vazia ou não numérica então `null`.

## 13. Casos de borda
- `DIRECT_URL` ausente em dev local: cair para `DATABASE_URL` (Neon exige as duas em produção).
- API hibernada no Render (plano grátis): a página diagnóstica mostra "Consultando…" e depois ok; não tratar como erro antes de ~15 s (timeout do `apiClient` de leitura = 15 s no diagnóstico).
- `localStorage` indisponível (janela privada): tema segue o sistema; nada quebra.
- Socket que não conecta (WebSocket bloqueado): linha "Socket: desconectado" sem derrubar a página.
- Exposição do `/kit` em produção por engano: coberto por AC-0.14.

## 14. Testes exigidos (Vitest)
- `shared/money`: `formatBRL`, `parseReais`, limites 0, 1, `MAX_DEPOSIT_CENTS`, `MAX_DEPOSIT_CENTS+1` (validação é da S01), pontos de milhar.
- `api/env`: faltando variável, chave curta, ok.
- `api/errors`: envelope e `INTERNAL`.
- `api/clock`: `FakeClock`.
- `api/health`: com banco (integração, `DATABASE_URL_TEST`) e com banco derrubado (mock do prisma).
- `web`: função de aplicar tema (script inline testável como função pura) lendo chave válida/ausente/inválida.
- CI: workflow `.github/workflows/ci.yml` com serviço `postgres:16`, `npm ci`, `lint`, `typecheck`, `test`.

## 15. Retrofits e integrações
- S01 adiciona a primeira migração, valida o token do handshake do socket e preenche o Header.
- S02 troca `/` pela Vitrine e remove a página diagnóstica (manter `/health` na API).
- S04 troca `NoopPublisher` pela implementação com Socket.IO e adiciona salas.
- S09 revisa o `/kit` e a a11y global.

## 16. Conflitos resolvidos e perguntas abertas
- C6 (tema): DESIGN pede select nativo "Tema" e sistema por padrão; arquitetura pede chave manual em localStorage → unificado em 10.1; dark mode continua "opcional" no PRD, mas entra aqui por custo baixo (O5).
- DESIGN "cartão sempre ilustração, nunca foto" vs PRD (imagem real): vale PRD; tratado na S02 (CarPhoto).
- Aberta (sugestão): versões exatas de Node/Next/Prisma e hosts (Vercel, Render, Neon) **não foram verificadas na web**; confirmar no dia 1 e deixar o lockfile mandar. Sugestão: Node LTS ativo, Next.js e Prisma no major atual, `bcryptjs`, `jsonwebtoken`, `pino`, `helmet`, `express-rate-limit`, Vitest, Tailwind, TanStack Query.

## 17. Definition of Done
- [ ] Monorepo com workspaces; `npm run dev`, `build`, `lint`, `typecheck`, `test` na raiz.
- [ ] `.env.example` completo: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `AUDIT_HMAC_KEY`, `WEB_ORIGIN`, `FIPE_BASE_URL`, `FIPE_TOKEN?`, `WIKI_USER_AGENT`, `PORT`, `NEXT_PUBLIC_API_URL` (+ `DATABASE_URL_TEST`).
- [ ] `docker-compose.yml` com db, api (roda `prisma migrate deploy` no start) e web.
- [ ] CI verde no GitHub.
- [ ] Deploy mínimo no ar (AC-0.8) com `JWT_SECRET` e `AUDIT_HMAC_KEY` definidos em produção; URLs registradas no README.
- [ ] Tokens dos dois temas, fontes, tipografia, movimento e foco no código; `/kit` com todos os primitivos.
- [ ] README esqueleto (visão geral, stack, como rodar, link do deploy) e `progresso.md` atualizado.
