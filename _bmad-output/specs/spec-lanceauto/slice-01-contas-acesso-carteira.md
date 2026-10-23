---
id: S01
titulo: Contas, acesso e carteira
depende_de: [S00]
cobre: [E1, E5, R7, R9, PERM-V, PERM-B, PERM-A, T2, T4, AUTH, DM-User, DM-Wallet, DM-Ledger, S1]
parcial: [UX-A11Y, UX-RECON, E13, O4, TST, T1, R8]
fontes_de_origem: [PRD Papéis/Regras 7 e 9/Autenticação/Modelo de dados · AD-2,3,4,11 · Contratos de API · EXPERIENCE Acesso/Carteira/Navegação/P7,P8,P13,P15,P26 · DESIGN campo/chip-saldo/aba-filtro/Outros]
---
# S01 — Contas, acesso e carteira

## 1. Objetivo e demonstração
Cadastro e login com dois papéis, header por papel, saldo simulado: depositar e ver o extrato.

Roteiro:
1. Visitante abre `/`, clica em "Criar conta", escolhe "Licitante", cadastra-se e cai logado em `/` com o chip "DISPONÍVEL R$ 0,00" e "VOCÊ · Licitante".
2. Vai a Carteira (`/carteira`): Total R$ 0,00 − Comprometido R$ 0,00 = Disponível R$ 0,00; extrato vazio.
3. Clica em "R$ 50 mil" e "Depositar R$ 50.000,00": Total e Disponível viram R$ 50.000,00 e entra a linha "Depósito" no topo do extrato.
4. Digita 10.000.001 em "Outro valor": vê "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00." e o saldo não muda.
5. Clica em "Sair", volta a `/` como visitante; abre `/carteira` e é levado a `/entrar?next=/carteira`.
6. Entra com e-mail/senha errados e vê a mensagem de login; entra com os certos e volta a `/carteira`.
7. Cadastra um leiloeiro: é levado a `/painel` (stub), o header não tem chip de saldo; ao abrir `/carteira` é devolvido a `/painel` com aviso.
8. Logins semeados (leiloeiro + 2 licitantes com saldo) funcionam no deploy.

## 2. Fora desta fatia
| Item | Fatia |
|---|---|
| Vitrine real em `/`, itens "Meus lotes · Criar lote" na nav do leiloeiro, Painel real | S02 |
| `leadingLots` preenchido (sempre `[]` aqui), `HOLD`/`RELEASE` no extrato | S03 |
| `wallet:updated` por socket (atualizar chip e Carteira sem recarregar); o depósito emitir o evento | S04 |
| `SALE_DEBIT`/`SALE_CREDIT` | S05 |
| `REFUND` | S06 |
| Item "Meus arremates" na nav e links da lista "Travado onde você lidera" | S07 |
| Recuperação de senha, troca de papel, edição de perfil | Nunca (fora de escopo PRD) |

## 3. Ponto de partida
Da S00: monorepo, `env.ts`, `AppError` + envelope, `Clock`, `makeRateLimiter`, `Publisher`/`NoopPublisher`, Socket.IO sem salas, `shared` (`ErrorCode`, `money`, nomes de eventos), tokens/tema, primitivos (`Button`, `Field`, `RefusalMessage`, `FeedbackState`, `DataTable`, `FilterTabs`, `IdentityChip`, `Dialog`, `ThemeSwitch`, `Logo`, `SkipLink`, `PageShell`), `apiClient`, TanStack Query, cliente Socket.IO, Prisma sem modelos.

**Invariantes que valem aqui**
- INV-1 Servidor é fonte de verdade; sem atualização otimista (saldo só muda após a resposta).
- INV-2 Dinheiro em centavos (`BigInt` no banco, `number` nas bordas com assert ≤ `Number.MAX_SAFE_INTEGER`); UI em reais inteiros `R$ 31.000,00`; `MAX_DEPOSIT_CENTS = 1_000_000_000` por depósito.
- INV-3 Datas ISO UTC; UI em America/Sao_Paulo.
- INV-5 Depósito trava só a própria carteira (`SELECT … FOR UPDATE`).
- INV-6 `Wallet` é cache; cada mudança insere `LedgerEntry` na mesma tx; CHECK `committed >= 0` e `total >= committed`; disponível = total − comprometido, calculado, nunca gravado.
- INV-13 DTO público nunca contém userId/nome/e-mail (aqui só DTOs privados do próprio usuário).
- INV-15 Um papel por conta; autorização no back-end.
- INV-16 Envelope de erro `{error:{code,message,details?}}`.

## 4. Regras de negócio
- R-1.1 Cada conta tem exatamente um papel, `BIDDER` ou `AUCTIONEER`, escolhido no cadastro e imutável. (PRD Papéis · INV-15)
- R-1.2 E-mail é normalizado em minúsculas (`trim().toLowerCase()`) e único. (AD-11)
- R-1.3 Senha tem 8 a 72 caracteres (72 = limite do bcrypt); armazenada só como hash `bcryptjs` custo 10. Sem recuperação de senha. (AD-11 · PRD fora de escopo)
- R-1.4 Toda conta (licitante e leiloeiro) nasce com `Wallet` zerada, criada na mesma transação do `User`. (AD-4 · `POST /auth/register`)
- R-1.5 Cadastro autentica na hora: devolve token (o usuário não precisa logar de novo).
- R-1.6 JWT HS256 assinado com `JWT_SECRET`, validade 7 dias, claims `sub` (id) e `role`; sem refresh; logout = descartar o token no cliente. (AD-11)
- R-1.7 Depósito simulado soma ao saldo total (R9): `totalCents += amountCents`, 1 ≤ amountCents ≤ `MAX_DEPOSIT_CENTS` (R$ 1,00 a R$ 10.000.000,00 **por depósito**; sem teto de saldo acumulado). Só `BIDDER` deposita. (PRD R9 · decisão do usuário)
- R-1.8 Disponível = total − comprometido (R7), sempre calculado no servidor e devolvido pronto (`availableCents`).
- R-1.9 O depósito trava a própria carteira, atualiza `Wallet`, insere `LedgerEntry(kind=DEPOSIT, amountCents, lotId=null, totalAfter, committedAfter)` na mesma tx. (AD-2/AD-4)
- R-1.10 Extrato = `LedgerEntry` do usuário em ordem decrescente de criação; 50 por página; mais antigos por cursor. (Contratos)
- R-1.11 Rotas protegidas exigem token válido (`UNAUTHENTICATED` 401 sem ele); rotas por papel usam `requireRole`. Papel errado em API → `ROLE_NOT_ALLOWED` 403.
- R-1.12 Handshake do Socket.IO: se `auth.token` válido, o socket entra na sala `user:{id}`; token ausente ou inválido **não derruba** a conexão (segue anônimo). (AD-11)
- R-1.13 Rate-limit em `/auth/*`: 30 requisições por minuto por IP → `RATE_LIMITED` 429 (valor é sugestão, ajustável por env; não pode atrapalhar avaliador que loga várias vezes).
- R-1.14 Login com e-mail inexistente e com senha errada respondem igual (`INVALID_CREDENTIALS`), e o tempo de resposta é equivalente (comparar contra hash dummy quando o usuário não existe).

## 5. Modelo de dados
Primeira migração real (`prisma migrate dev --name contas_e_carteira`). Enums com **todos** os valores desde já (evita `ALTER TYPE` depois).
```prisma
enum Role       { AUCTIONEER BIDDER }
enum LedgerKind { DEPOSIT HOLD RELEASE REFUND SALE_DEBIT SALE_CREDIT }

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now()) @db.Timestamp(3)
  wallet       Wallet?
}

model Wallet {
  userId         String   @id
  totalCents     BigInt   @default(0)
  committedCents BigInt   @default(0)
  updatedAt      DateTime @updatedAt @db.Timestamp(3)
  user           User     @relation(fields: [userId], references: [id])
}

model LedgerEntry {
  id             String     @id @default(uuid())
  userId         String
  kind           LedgerKind
  amountCents    BigInt
  lotId          String?    // sem FK: a tabela Lot só existe na S02 e o ledger é histórico imutável
  totalAfter     BigInt
  committedAfter BigInt
  createdAt      DateTime   @default(now()) @db.Timestamp(3)
  @@index([userId, createdAt])
}
```
SQL manual na migração (Prisma não expressa CHECK):
```sql
ALTER TABLE "Wallet" ADD CONSTRAINT "wallet_committed_nonneg" CHECK ("committedCents" >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT "wallet_total_gte_committed" CHECK ("totalCents" >= "committedCents");
```
Não criar ainda: Item, Lot, Bid, Receipt. `LedgerEntry` é append-only por convenção de código (sem UPDATE/DELETE em nenhum service); não exige trigger nesta fatia.
Mappers do repositório convertem `BigInt → number` com assert `≤ Number.MAX_SAFE_INTEGER`.

## 6. Contratos REST
DTOs em `packages/shared` (zod de entrada + tipos de saída): 
`UserDto = { id: string, name: string, email: string, role: "BIDDER"|"AUCTIONEER" }`
`WalletDto = { totalCents: number, committedCents: number, availableCents: number }`
`LedgerEntryDto = { id, kind: LedgerKind, amountCents, lotId: string|null, lotNumber: number|null, totalAfterCents, committedAfterCents, createdAt }` (`lotNumber` é sempre `null` até a S02; depois o service faz o join)

| Rota | Papel | Corpo → resposta | Erros |
|---|---|---|---|
| `POST /auth/register` | público | `{ name, email, password, role }` → `201 { token, user: UserDto }`. `name` 1–120 chars após trim; `email` válido; `password` 8–72; `role` ∈ `BIDDER`\|`AUCTIONEER`. Cria User + Wallet numa tx. | `VALIDATION` 400 `{fields:{name?,email?,password?,role?}}` · `EMAIL_TAKEN` 409 · `RATE_LIMITED` 429 |
| `POST /auth/login` | público | `{ email, password }` → `200 { token, user: UserDto }` | `VALIDATION` 400 · `INVALID_CREDENTIALS` 401 · `RATE_LIMITED` 429 |
| `GET /me` | logado | `200 { user: UserDto, wallet: WalletDto }` | `UNAUTHENTICATED` 401 |
| `GET /wallet?cursor=` | logado (qualquer papel) | `200 { totalCents, committedCents, availableCents, entries: LedgerEntryDto[] (≤50, mais novos primeiro), nextCursor: string\|null, leadingLots: [] }` | `UNAUTHENTICATED` 401 |
| `POST /wallet/deposits` | `BIDDER` | `{ amountCents }` (inteiro 1…1_000_000_000) → `201 { wallet: WalletDto, entry: LedgerEntryDto }` | `VALIDATION` 400 `{fields:{amountCents:"Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00."}}` · `ROLE_NOT_ALLOWED` 403 · `UNAUTHENTICATED` 401 |

Notas:
- `leadingLots` tem o tipo `{ lotId: string, number: number, title: string, committedCents: number }[]`; esta fatia sempre devolve `[]`; a S03 preenche.
- `cursor` é opaco (base64url de `createdAt|id` do último item); ordenação `createdAt DESC, id DESC`.
- Token ausente, malformado ou expirado → `UNAUTHENTICATED` 401. `Authorization: Bearer <jwt>`.
- Respostas de saldo não levam `serverTime` (não são estado de lote).
- `amountCents` não inteiro (ex. 10.5), string, 0, negativo, ou > 1_000_000_000 → `VALIDATION` com a mesma mensagem do campo `amountCents`.

## 7. Contratos Socket.IO
Nenhum evento novo. Muda só o handshake: se `socket.handshake.auth.token` for um JWT válido, `socket.join("user:" + sub)`; senão segue anônimo, sem erro. O cliente web passa a enviar `auth: { token }` e **reconecta com o novo token** ao logar/deslogar (`socket.disconnect().connect()`).

## 8. Mensagens
Textos marcados (rev.) são "texto a revisar": propostos aqui por falta de texto no PRD/design.

| Código / campo | HTTP | Texto pt-BR | Onde aparece |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | "E-mail e senha não batem. Confira o que está anotado; recuperar senha não é uma opção aqui." | RefusalMessage acima do botão de login; bordas dos dois campos em `ferrugem` |
| `EMAIL_TAKEN` | 409 | "Esse e-mail já está cadastrado. Entre na aba “Entrar”." (rev.) | Mensagem do campo e-mail do cadastro |
| `VALIDATION` · name vazio | 400 | "Informe seu nome." (rev.) | Campo Nome |
| `VALIDATION` · name > 120 | 400 | "O nome pode ter até 120 caracteres." (rev.) | Campo Nome |
| `VALIDATION` · email vazio | 400 | "Informe seu e-mail." (rev.) | Campo E-mail (cadastro e login) |
| `VALIDATION` · email inválido | 400 | "Esse e-mail não parece um e-mail." (rev.) | Campo E-mail |
| `VALIDATION` · password vazia | 400 | "Informe uma senha." (cadastro) / "Informe sua senha." (login) (rev.) | Campo Senha |
| `VALIDATION` · password < 8 | 400 | "A senha precisa de pelo menos 8 caracteres." | Campo Senha |
| `VALIDATION` · password > 72 | 400 | "A senha pode ter até 72 caracteres." (rev.) | Campo Senha |
| `VALIDATION` · role ausente | 400 | "Escolha licitante ou leiloeiro." (rev.) | Grupo de papel |
| `VALIDATION` · amountCents | 400 | "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00." | RefusalMessage da Carteira (e `fields.amountCents`) |
| `ROLE_NOT_ALLOWED` (depósito) | 403 | "Só licitantes depositam saldo simulado." (rev.) | Resposta de API (a UI do leiloeiro não mostra depósito) |
| `UNAUTHENTICATED` | 401 | "Entre para continuar." (rev.) | Resposta de API; UI redireciona a `/entrar?next=` |
| `RATE_LIMITED` | 429 | "Calma, uma coisa de cada vez. Tente de novo em instantes." | RefusalMessage do formulário |
| Falha de rede no envio | — | "Não deu para falar com o servidor. Confira a conexão e tente de novo." (rev.) | RefusalMessage do formulário; campos preservados |
| Papel errado em tela | — | "Essa tela é de {licitante\|leiloeiro}. Você entrou como {papel}." (rev.) | Aviso (FeedbackState neutro, dispensável) no destino do redirecionamento |
| Botão enviando | — | "Criando conta…" / "Entrando…" | Botão primário inerte |
| Depósito feito (live region) | — | "Depósito de R$ {X} feito. Disponível agora: R$ {Y}." (rev.) | `role="status"` invisível |
| Extrato vazio | — | "Nenhuma movimentação ainda." | FeedbackState vazio |
| Nada comprometido | — | "Nada travado. Você não lidera nenhum lote agora." (rev.) | Bloco "Comprometido" |

## 9. Telas e estados

### 9.1 Acesso — `/entrar` (T2) · visitante
Query `?next=` (caminho interno apenas: começa com `/` e não com `//`; qualquer outro valor é ignorado). Se já logado, redireciona a `homeFor(role)`.

**Estrutura (desktop ≥ ~1000px: duas colunas; mobile: texto primeiro, depois formulário).**
- Coluna de texto: título de página `t-display-titulo` caixa-alta (ex. "Quem dá mais, leva." sugerido), `t-body-lead` curto, nota: "Seu nome nunca aparece em público. Em cada lote você vira um Licitante diferente, tipo Licitante C3E8." (rev.)
- Cartão do formulário: fundo `papel`, borda 3px `linha`, sombra `8px 8px 0`, padding 24px, com **abas** "Criar conta" / "Entrar" (padrão de abas, ver 10.2). Aba aberta por padrão: "Criar conta"; link "Entrar" no header e `?aba=entrar` abrem a segunda.
- **Criar conta:** grupo "Eu sou" com dois bilhetes de papel (radio): Licitante (pré-selecionado) e Leiloeiro; campos Nome, E-mail, Senha (rótulo "Senha"; ajuda "Mínimo de 8 caracteres" em `aria-describedby`, também visível, nunca só placeholder); botão primário "Criar conta de licitante" / "Criar conta de leiloeiro" (muda com o papel); nota no rodapé do cartão: "Em cada lote você ganha um pseudônimo de 4 caracteres. É ele que aparece nos lances." (rev.)
- **Entrar:** campos E-mail e Senha; botão primário "Entrar no pátio".
- O papel escolhido **persiste ao trocar de aba**. O erro de login **não some** ao trocar de aba e voltar.

**Estados**
| Estado | Tratamento |
|---|---|
| Padrão | Aba "Criar conta", papel Licitante, campos vazios |
| Erro de campo (cadastro/login) | Mensagem textual abaixo do campo ligada por `aria-describedby`; `aria-invalid="true"`; borda 3px `ferrugem`; foco vai ao primeiro campo inválido; valores preservados (senha limpa após rejeição do servidor) |
| `EMAIL_TAKEN` | Erro no campo e-mail (texto da seção 8) |
| `INVALID_CREDENTIALS` | RefusalMessage acima do botão; bordas dos dois campos `ferrugem`; `aria-invalid` nos dois |
| Enviando | Botão primário inerte com "Criando conta…"/"Entrando…"; segundo envio ignorado |
| Falha de rede / 429 | RefusalMessage (textos da seção 8); campos preservados |
| Sucesso | Grava token, hidratar `me`, redireciona a `next` (se válido e permitido ao papel) ou a `homeFor(role)` |

Validação do cliente espelha a do servidor (mesmos textos); o servidor é a autoridade (`VALIDATION` volta e é exibida por campo).

### 9.2 Guardas de rota e `homeFor`
`homeFor(role)`: `BIDDER → "/"`, `AUCTIONEER → "/painel"`. `/painel` existe nesta fatia como **stub** protegido (só `AUCTIONEER`) com `PageShell` e `FeedbackState` "Painel chega na próxima fatia." — a S02 o substitui.

| Situação | Comportamento |
|---|---|
| Visitante abre rota privada (`/carteira`, futuros `/arremates`, `/painel`, `/painel/criar-lote`) | Redireciona a `/entrar?next=<caminho>` |
| Logado com papel errado | Redireciona a `homeFor(seu papel)` com aviso "Essa tela é de {papel certo}. Você entrou como {papel}." |
| Token expirado/inválido (API devolve `UNAUTHENTICATED` com token enviado) | `apiClient` descarta o token, limpa o cache do TanStack Query e redireciona a `/entrar?next=` |
| Hidratação (lendo `localStorage` e chamando `GET /me`) | Rotas privadas mostram `FeedbackState` "Carregando…" — sem piscar redirect |
| Rotas públicas | Nunca redirecionam (`/`, futuras Sala, Comprovante, Auditoria) |

Token em `localStorage["lanceauto-token"]` (leitura/escrita em try/catch; se indisponível, a sessão vale só na aba). `apiClient` envia `Authorization: Bearer`.

### 9.3 Header (todas as telas, exceto Comprovante e Auditoria)
Landmark `header` com `nav` rotulado. Quebra em linhas no mobile (sem hambúrguer). Alvos ≥ 44px. Item ativo: sublinhado 3px `tinta` + `aria-current="page"`.

| Papel | Conteúdo |
|---|---|
| Visitante | Logo → `/`; botão secundário "Entrar" e primário "Criar conta" (ambos → `/entrar`; "Entrar" abre `?aba=entrar`); `ThemeSwitch` |
| Licitante | Logo; `nav aria-label="Principal"`: "Vitrine" (`/`) · "Carteira" (`/carteira`); **BalanceChip** "DISPONÍVEL R$ X" (link → `/carteira`); IdentityChip "VOCÊ · Licitante"; botão-link "Sair"; `ThemeSwitch` |
| Leiloeiro | Logo; `nav aria-label="Leiloeiro"`: "Vitrine" (`/`) (a S02 acrescenta "Meus lotes · Criar lote"); IdentityChip "VOCÊ · Leiloeiro"; "Sair"; sem chip de saldo; `ThemeSwitch` |

Variante `PublicHeader` (criada aqui, usada pelas S05 e S08): só Logo + legenda `t-mono-rotulo` em props ("PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN" / "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN"), igual para quem está logado.

"Sair": descarta o token, `queryClient.clear()`, reconecta o socket sem token, vai a `/`. O chip de identidade mostra **só** "VOCÊ" + papel (o pseudônimo muda por lote e nunca aparece no cabeçalho).

### 9.4 Carteira — `/carteira` (T4) · só `BIDDER`
Título de página `t-display-titulo` "Carteira". Dinheiro de mentira, emoção de verdade (subtítulo `t-body` sugerido).

**Equação:** três cartões em linha (quebram no mobile) com glifos "−" e "=" decorativos (`aria-hidden`): **Total** · **Comprometido** · **Disponível**. Cada cartão: rótulo `t-mono-rotulo`, valor Plex Mono grande; Disponível com borda 5px; valores `aria-label` como moeda ("R$ 50.000,00"). Bloco **Comprometido** abaixo: "Travado onde você lidera: {lista de lotes com link}. Volta se alguém cobrir." — com `leadingLots` vazio mostra "Nada travado. Você não lidera nenhum lote agora." (rev.).

**Depositar:** valores rápidos em grade de 3 colunas — "R$ 10 mil", "R$ 50 mil", "R$ 100 mil" (`aria-pressed`; selecionado: fundo `ocre`, texto `sobreOcre`, sombra `4px 4px 0`) — e campo "Outro valor" (Plex Mono 24px, prefixo "R$", sufixo ",00", máscara de dígitos com milhar "."). Digitar em "Outro valor" desmarca o rápido; clicar num rápido limpa o campo. Botão primário "Depositar R$ {valor}" (sem valor válido mostra "Depositar" e **não age** em silêncio — veja o estado "Valor inválido"). Esta é a única ação ocre da tela.

**Extrato:** `DataTable` (min-width 560px, `aria-label="Extrato da carteira"`), colunas **Quando** (dd/mm HH:mm, Brasília) · **Movimento** · **Lote** (link `/lotes/{lotId}` ou "—") · **Valor** · **Disponível após** (= totalAfter − committedAfter). Rótulos de movimento (Big Shoulders caixa-alta):
| kind | Rótulo | Valor |
|---|---|---|
| DEPOSIT | Depósito | `+ R$ X` |
| HOLD | Saldo travado · lance | `R$ X` com nota "TOTAL NÃO MUDA" |
| RELEASE | Saldo liberado · lance superado | `R$ X` com nota "VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA" |
| REFUND | Estorno · lote cancelado | `R$ X` com nota "VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA" |
| SALE_DEBIT | Arremate | `− R$ X` |
| SALE_CREDIT | Venda | `+ R$ X` |
(Notas em `t-mono-rotulo-pequeno`. "Estorno" aparece **só** para REFUND; "superado" é RELEASE. Apenas DEPOSIT existe nesta fatia; a tabela já cobre os outros.) "Ver mais" (botão secundário) carrega `nextCursor`.

| Estado | Tratamento |
|---|---|
| Carregando | FeedbackState carregando nos blocos (equação e extrato mantêm o espaço) |
| Padrão | Equação + depósito + extrato |
| Extrato vazio | FeedbackState vazio "Nenhuma movimentação ainda." ; equação com zeros |
| Valor inválido (vazio, ≤ 0, não numérico) | RefusalMessage "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00." colada ao botão; campo com `aria-invalid`; valor preservado; saldo não muda |
| Acima do limite (> R$ 10.000.000,00) | Mesma RefusalMessage e comportamento |
| Enviando | Botão inerte "Depositando…" (rev.); duplo clique ignorado |
| Depósito feito | Após a resposta: Total e Disponível "viram" (placa flip, `la-vira`), entra linha nova no topo do extrato (`la-entra` + `la-marca`), campo limpo, live region anuncia "Depósito de R$ X feito. Disponível agora: R$ Y." |
| Erro de rede/servidor | RefusalMessage "Não deu para falar com o servidor. Confira a conexão e tente de novo."; valor preservado; **não** reenviar automaticamente |
| Erro de carga do extrato | FeedbackState erro + "Tentar novamente"; saldos anteriores mantidos marcados como desatualizados |
| Reduced motion | Valores e linha nova aparecem direto no estado final |
| Atualização em tempo real | Fora desta fatia (S04); aqui o saldo atualiza pela resposta do depósito e ao focar a aba/voltar à tela (refetch) |

Mobile: cartões empilham, grade de rápidos continua em 3 colunas (reflow com `minmax`), tabela rola dentro do contêiner focável.

### 9.5 Vitrine provisória (`/`)
Continua a página diagnóstica da S00, agora dentro do novo Header. A S02 a substitui.

## 10. Componentes criados

### 10.1 BalanceChip (chip-saldo)
Link para `/carteira`. Texto "DISPONÍVEL R$ X,00" Plex Mono 13px, fundo `papel`, borda 3px `linha`, raio 0, padding `8px 12px`, alvo ≥ 44px. Lê `["wallet"]` do TanStack Query (alimentado por `GET /me`/`GET /wallet`); atualiza por `setQueryData` (S04 ligará `wallet:updated`). Rótulo acessível "Saldo disponível R$ X,00, ir para a carteira". Só aparece para `BIDDER`.

### 10.2 Abas do Acesso (componente próprio — **não** é FilterTabs)
`role="tablist"` + dois `role="tab"` com `aria-selected` **e** `aria-controls`; `role="tabpanel"` com `aria-labelledby`; setas ←/→ trocam, `Home`/`End` vão à primeira/última; só a aba ativa na ordem de tabulação. Visual: aba ativa `papel`/`tinta`, inativa `suave`/`tinta2`, `top:3px` para encaixar na borda do cartão (borda 3px `linha`).

### 10.3 Bilhetes de papel (escolha de papel)
Dois `radio` visualmente escondidos (não `display:none`) dentro de um `fieldset` com `legend` "Eu sou". Selecionado: fundo `ocre`, texto `sobreOcre`, `filter: drop-shadow(5px 5px 0 var(--c-sombra))`; não selecionado: fundo `papel`. O **foco do radio aparece no bilhete** (foco global: contorno 3px `tinta` + halo `papel`). Cada bilhete tem título `t-cartaz-subtitulo` ("LICITANTE" / "LEILOEIRO") e uma linha `t-body-nota` ("Dá lances e guarda saldo." / "Monta lotes e recebe as vendas." — rev.).

### 10.4 Header, HeaderMinimal e `AuthProvider`
`AuthProvider` expõe `{ user, status: "loading"|"anon"|"auth", login, register, logout }`; `RequireAuth({role?})` envolve as páginas privadas. `homeFor(role)` em `shared`/`web`. `PublicHeader` conforme 9.3.

### 10.5 Campo de valor com máscara (Carteira; reusado em S03/S02)
Composto prefixo "R$" (Plex Mono 600 18px) + input `inputmode="numeric"` (Plex Mono, 24px aqui) + sufixo fixo ",00". Ao digitar ou colar: só dígitos, separador de milhar "." reaplicado a cada tecla, cursor preservado. Valor exposto ao form em reais inteiros (`parseReais`) → `amountCents = reais × 100`. Rótulo visível; ajuda em `aria-describedby`.

## 11. Seed desta fatia
`npm run seed` (recusa se já houver usuários; mensagem clara no console). Cria **pelos services da aplicação** (nunca SQL direto):
| Papel | Nome | E-mail | Senha | Depósitos |
|---|---|---|---|---|
| AUCTIONEER | João Pátio | `leiloeiro@lanceauto.test` | `lance1234` | — |
| BIDDER | Ana Souza | `ana@lanceauto.test` | `lance1234` | R$ 500.000,00 (um depósito) |
| BIDDER | Bruno Lima | `bruno@lanceauto.test` | `lance1234` | R$ 300.000,00 (um depósito) |
E-mails/senhas/saldos são **sugestão**; o README (S09) lista os definitivos. Saldos grandes o bastante para a S03 semear lances. Cada depósito gera `LedgerEntry` DEPOSIT.

## 12. Critérios de aceite
**Cadastro e login**
- AC-1.1 [auto] Dado e-mail livre, quando `POST /auth/register {name:"Ana Souza", email:" ANA@Lanceauto.test ", password:"lance1234", role:"BIDDER"}`, então `201`, `user.email == "ana@lanceauto.test"`, token válido e existe `Wallet(0,0)` com um único `User`.
- AC-1.2 [auto] Dado o e-mail já cadastrado (mesmo com caixa diferente), quando registro de novo, então `409 EMAIL_TAKEN` e nenhum novo `User`/`Wallet`.
- AC-1.3 [auto] Dado dois `register` simultâneos com o mesmo e-mail (`Promise.all`), então exatamente um `201` e um `409 EMAIL_TAKEN`; nunca um `User` sem `Wallet`.
- AC-1.4 [auto] Dado `password:"1234567"` (7), quando registro, então `400 VALIDATION` com `fields.password == "A senha precisa de pelo menos 8 caracteres."`.
- AC-1.5 [auto] Dado `role` ausente ou `"ADMIN"`, quando registro, então `400 VALIDATION` com `fields.role`.
- AC-1.6 [auto] Dado `name` vazio/só espaços, `email:"x"`, quando registro, então `400 VALIDATION` com `fields.name` e `fields.email` juntos.
- AC-1.7 [auto] Dado credenciais corretas, quando `POST /auth/login`, então `200` com token cujo `exp − iat == 7 dias` e claims `sub` e `role`.
- AC-1.8 [auto] Dado senha errada **ou** e-mail inexistente, quando login, então ambos `401 INVALID_CREDENTIALS` com a mesma mensagem.
- AC-1.9 [auto] Dado 31 chamadas a `/auth/login` em 1 minuto do mesmo IP, então a 31ª recebe `429 RATE_LIMITED`.
- AC-1.10 [auto] Dado token expirado/forjado/ausente, quando `GET /me`, então `401 UNAUTHENTICATED`.
- AC-1.11 [auto] Dado a senha gravada, então `passwordHash` ≠ senha e `bcrypt.compare` confere; nenhuma resposta da API contém `passwordHash`.

**Carteira e depósito**
- AC-1.12 [auto] Dado licitante com carteira R$ 0, quando `POST /wallet/deposits {amountCents:5000000}`, então `201`, `wallet = {total:5000000, committed:0, available:5000000}` e um `LedgerEntry` DEPOSIT com `totalAfter=5000000, committedAfter=0`.
- AC-1.13 [auto] Dado `amountCents:1_000_000_000`, então `201` (limite incluso). Dado `1_000_000_001`, `0`, `-100`, `10.5`, `"100"`, ausente, então `400 VALIDATION` com `fields.amountCents == "Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00."` e saldo inalterado.
- AC-1.14 [auto] Dado leiloeiro autenticado, quando deposita, então `403 ROLE_NOT_ALLOWED` e nada gravado.
- AC-1.15 [auto] Dado sem token, quando deposita, então `401 UNAUTHENTICATED`.
- AC-1.16 [auto] Dado 20 depósitos de R$ 1.000,00 simultâneos (`Promise.all`) na mesma carteira, então total final R$ 20.000,00, 20 linhas DEPOSIT e `totalAfter` forma a sequência 100000…2000000 sem repetição nem salto (carteira travada).
- AC-1.17 [auto] Dado `Wallet` com `committed=0, total=0`, quando um `UPDATE` tentaria deixar `total < committed` ou `committed < 0`, então o banco rejeita pelo CHECK.
- AC-1.18 [auto] Dado 60 lançamentos, quando `GET /wallet`, então 50 entradas mais novas primeiro e `nextCursor` não nulo; com `?cursor=` vêm as 10 restantes e `nextCursor == null`; sem repetir nem pular nenhuma.
- AC-1.19 [auto] Dado `GET /wallet`, então `leadingLots == []` e `availableCents == totalCents − committedCents`.
- AC-1.20 [auto] Dado leiloeiro autenticado, quando `GET /wallet`, então `200` com zeros (carteira existe para todos).

**Telas**
- AC-1.21 [manual] Dado visitante na aba "Criar conta", quando escolho "Leiloeiro" e troco para "Entrar" e volto, então o papel continua "Leiloeiro" e o botão diz "Criar conta de leiloeiro".
- AC-1.22 [manual] Dado login com senha errada, quando envio, então vejo "E-mail e senha não batem. Confira o que está anotado; recuperar senha não é uma opção aqui.", as bordas dos dois campos em `ferrugem`, `aria-invalid="true"` neles, e a mensagem permanece se troco de aba e volto.
- AC-1.23 [manual] Dado cadastro com e-mail repetido, quando envio, então o erro aparece no campo e-mail, o foco vai a ele, e Nome/E-mail continuam preenchidos (senha limpa).
- AC-1.24 [manual] Dado visitante, quando abro `/carteira`, então vou a `/entrar?next=/carteira`; após logar como licitante, aterrisso em `/carteira`.
- AC-1.25 [manual] Dado `?next=https://evil.com` ou `?next=//evil.com`, quando logo, então sou levado a `homeFor(role)` (valor ignorado).
- AC-1.26 [manual] Dado leiloeiro logado, quando abro `/carteira`, então sou levado a `/painel` com o aviso "Essa tela é de licitante. Você entrou como leiloeiro." e o header não mostra chip de saldo.
- AC-1.27 [manual] Dado licitante logado, quando abro `/painel`, então volto a `/` com aviso equivalente.
- AC-1.28 [manual] Dado licitante logado, quando clico em "Sair", então o token some do `localStorage`, vejo o header de visitante em `/`, e `/carteira` exige login de novo.
- AC-1.29 [manual] Dado "Outro valor" = 10.000.001 e clico em Depositar, então vejo a RefusalMessage com o texto exato e o saldo não muda; com 10.000.000 o depósito é aceito.
- AC-1.30 [manual] Dado depósito de R$ 50.000,00 concluído, então Total e Disponível mostram R$ 50.000,00, a primeira linha do extrato é "Depósito + R$ 50.000,00" e o chip do header mostra "DISPONÍVEL R$ 50.000,00" sem recarregar a página.
- AC-1.31 [manual] Dado token expirado no `localStorage`, quando abro `/carteira`, então sou levado a `/entrar?next=/carteira` sem tela quebrada.
- AC-1.32 [manual] Dado só teclado, então abas do Acesso navegam por ←/→/Home/End, o foco do bilhete de papel é visível, e Enter envia o formulário.
- AC-1.33 [manual] Dado 320px de largura e zoom 200%, então header quebra em linhas, formulário e Carteira não geram rolagem horizontal da página (só o extrato rola dentro do contêiner).
- AC-1.34 [manual] Dado os temas Claro e Noite, então todas as telas desta fatia mantêm contraste e bordas conforme os tokens da S00.
- AC-1.35 [auto] Dado socket com token válido, quando conecta, então está na sala `user:{id}`; com token inválido ou ausente, conecta sem sala de usuário e sem erro.
- AC-1.36 [manual] Dado o deploy público, quando entro com `ana@lanceauto.test` / `lance1234`, então a Carteira mostra R$ 500.000,00 e o extrato tem um Depósito.

## 13. Casos de borda e concorrência
- E-mail com espaços/maiúsculas/acentos: só `trim().toLowerCase()`; não remove acentos.
- Senha com 72 bytes multibyte (UTF-8 excede 72 bytes): rejeitar quando `Buffer.byteLength(password) > 72` com a mensagem de máximo (evita truncamento silencioso do bcrypt).
- Depósito exato de R$ 10.000.000,00 passa; +1 centavo falha; vários depósitos acumulam além de R$ 10 mi sem erro (limite é por depósito).
- Dois depósitos simultâneos na mesma carteira: serializados pelo `FOR UPDATE`; sem perda de atualização.
- Registro concorrente do mesmo e-mail: a violação de unicidade do Postgres vira `EMAIL_TAKEN`; a tx faz rollback (sem User órfão).
- Total acima de `Number.MAX_SAFE_INTEGER` ao mapear: assert falha → `INTERNAL` (cenário irreal, mas o assert existe).
- `localStorage` bloqueado: login vale na aba; recarregar desloga.
- Duplo clique em "Depositar": só um depósito (botão inerte + o segundo clique ignorado no cliente; não há chave de idempotência no servidor).
- Reconexão do socket ao logar/deslogar: o socket anônimo antigo não fica na sala `user:*` do usuário anterior.
- Leiloeiro tem carteira (recebe créditos na S05) mas não deposita nem a vê no header.

## 14. Testes exigidos
Vitest, integração contra Postgres real (`DATABASE_URL_TEST`), com limpeza entre testes.
- `auth.service`: register ok/normalização/EMAIL_TAKEN/validação por campo/rollback; login ok/errado/inexistente (tempo equivalente: asserção frouxa de que ambos chamam `bcrypt.compare`).
- `wallet.service`: depósito ok, limites 1 / 1_000_000_000 / +1 / 0 / negativo / fracionário, role, concorrência (AC-1.16), CHECKs do banco (AC-1.17), paginação (AC-1.18).
- `http`: `GET /me`, 401 de token ruim/expirado (JWT gerado com `exp` passado), rate-limit, `RATE_LIMITED`.
- `socket`: handshake com token válido/inválido (AC-1.35).
- `shared/zod`: schemas de entrada e mensagens por campo.
- `web` (lógica pura): máscara de valor (digitar/colar/cursor), `parseReais`/`formatBRL`, sanitização do `next`, `homeFor`.

## 15. Retrofits e integrações
- Muda código da S00: `apiClient` passa a anexar o token e tratar 401; cliente Socket.IO passa a enviar o token e reconectar ao logar/deslogar; `Layout` ganha o `AuthProvider` e o Header; `seed.ts` deixa de ser vazio.
- Deixa pronto para: S02 (nav do leiloeiro e Painel substituindo o stub; Vitrine em `/`), S03 (preencher `leadingLots`; `HOLD`/`RELEASE`), S04 (ligar `wallet:updated` ao `["wallet"]` e emitir no depósito), S05 (`PublicHeader`), S07 (links da lista "Travado onde você lidera" e item "Meus arremates").
- `LedgerEntryDto.lotNumber`: a S02 adiciona o join com `Lot` (hoje `null`).

## 16. Conflitos resolvidos e perguntas abertas
- C-papel-errado: arquitetura (AD-11) manda papel errado ir à home do próprio papel; a triagem sugeria um aviso com link. Resolvido: redireciona (arquitetura vence) **e** mostra aviso dispensável no destino (compatível com as duas).
- Pseudônimo no cadastro: o design dizia que o pseudônimo nasce com a conta; decisão do usuário: por lote. Textos reescritos na seção 9.1 (C7).
- Depósito por `ROLE_NOT_ALLOWED`: o código existente no PRD é para lance; reaproveitado com mensagem própria porque a arquitetura lista só `requireRole` → `ROLE_NOT_ALLOWED`/`FORBIDDEN` (sem código novo). Sugestão aceita por precedência; mudar para `FORBIDDEN` é trivial.
- Aberta (sugestão): limites do nome (120), rate-limit (30/min/IP) e a seed de saldos (R$ 500 mil e R$ 300 mil) não estão nas fontes; seguem como sugestão acima.
- Aberta (sugestão): rótulo do extrato para HOLD ("Saldo travado · lance") não existe no design; proposto.
- Aberta: o PRD não define se o leiloeiro vê o extrato dele (`GET /wallet` responde, mas nenhuma tela o mostra). Mantido sem tela (EXPERIENCE: "o Painel é a única superfície").

## 17. Definition of Done
- [ ] Migração `contas_e_carteira` criada, com os 2 CHECKs, aplicada no Neon pelo deploy da API.
- [ ] Rotas de auth e carteira com testes verdes (unit + integração) e CI verde.
- [ ] Acesso, Header por papel, Sair, guardas de rota e Carteira conforme as seções 9.x nos dois temas.
- [ ] Seed rodado em produção (3 contas); credenciais anotadas para o README.
- [ ] Smoke no link público: AC-1.36, cadastro novo, depósito, logout, acesso a rota privada sem login.
- [ ] `progresso.md` atualizado; commits atômicos em português.
