---
id: S09
titulo: Polimento, responsivo, seed final, README e entrega
depende_de: [S00, S01, S02, S03, S04, S05, S06, S07, S08]
cobre: [E13, AC13, AC14, AC15, D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, S7, S9, TST, O4, UX-A11Y, UX-RESP, UX-RECON, UX-VOICE]
parcial: [E12, S1, S2, S3, S4, S5, S6, S8, DEP, DKR, O3, O5, UX-THEME, L1, AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12]
fontes_de_origem: [PRD "Dados de teste", "Entrega", "Plano de 7 dias e critérios de aceite", "Gestão da API externa", EXPERIENCE "Accessibility Floor", "Responsive & Platform", "Estados globais", P12/P16/P22, DESIGN "Foco e contraste", "Tema", AD-6/AD-10/AD-12, "Ambientes e deploy mínimo"]
---

# S09 — Polimento, responsivo, seed final, README e entrega

## 1. Objetivo e demonstração

Última fatia: não cria produto novo. Fecha o que uma avaliação percorre: o seed completo, o link público funcionando, o README que permite rodar sem ajuda, a acessibilidade e o responsivo em todas as telas, os dois temas, os estados de erro/carregamento/404 e a prova ponta a ponta dos 15 critérios de aceite do PRD.

Roteiro de demonstração (quem avalia, só com o README e o link):

1. Abrir o link público da Vitrine: carrega e mostra os estados do seed (o Railway não hiberna, então não há servidor "dormindo").
2. Entrar como licitante de teste (e-mail/senha do README), dar um lance no lote ao vivo; em outra janela, entrar como o segundo licitante e ver o lance aparecer sem recarregar.
3. Entrar como leiloeiro, criar um lote (FIPE), ver no Painel, cancelar.
4. Abrir o comprovante e a auditoria do lote arrematado sem login.
5. Alternar claro/noite; abrir no celular (390px) e em zoom 200%.
6. Derrubar a FIPE e a Wikipedia (local, variáveis `FIPE_BASE_URL` e `WIKIPEDIA_BASE_URL` inválidas, API reiniciada para zerar o cache em memória): Vitrine, Sala, Auditoria e Comprovante seguem funcionando.
7. `docker compose up` numa máquina limpa e repetir o passo 2.

## 2. Fora desta fatia

| Item | Situação |
| --- | --- |
| Nova funcionalidade de produto | Não há. Qualquer lacuna achada aqui vira correção na fatia dona (ou entra em §16) |
| Assinatura Ed25519, múltiplas instâncias, e-mail, recuperação de senha | Fora de escopo do PRD |
| Playwright / E2E automatizado | Não adotado (decisão: Vitest + checklist manual) |
| Edição de lote agendado, lance automático, chat | Não fazer (PRD) |

## 3. Ponto de partida

Tudo das S00–S08 está no ar. Esta fatia usa: `prisma/seed.ts` e `fipe-fixture.json` (S01–S06), `FakeClock` (S00), `docker-compose.yml` e `.env.example` (S00), `/kit` (S00, só dev), todas as telas T1–T9, `ThemeSwitch`, `FeedbackState`, textos de §8 das fatias.

Invariantes que valem aqui:

- INV-1 Servidor é a fonte de verdade; sem atualização otimista.
- INV-3 Datas UTC; UI em America/Sao_Paulo; `new Date()` proibido em `apps/api/src` fora de `infra/clock.ts` (inclui o seed: usa `Clock`); escopo exato na decisão T6 do SPEC.md.
- INV-9 Prorrogação: `endsAt − now <= 2 min` ⇒ `endsAt = now + 2 min`.
- INV-10 Fechamento idempotente; varredura no boot.
- INV-12 Cadeia HMAC v1 depende de `AUDIT_HMAC_KEY` (trocar a chave invalida todos os lotes).
- INV-14 Telas públicas leem só o banco.
- INV-18 Voz do pátio, sem exclamação/emoji, plural correto.

## 4. Regras de negócio

| Id | Regra | Origem |
| --- | --- | --- |
| R-9.1 | O seed cria dados **só pelos services** da aplicação (cadastro, depósito, criar lote, lance, fechamento, cancelamento) com `FakeClock` para fabricar passado; nunca `INSERT` direto. Assim a cadeia HMAC nasce válida. Como o passado é fabricado com `FakeClock`, o service `createLot` aceita a opção `{ allowPast: true }` (a regra `startsAt ≥ agora − 60 s` e `fim − início ≥ 5 min` vive no zod/rota de `POST /lots`, não no service); **só o seed usa essa opção**, e a rota pública nunca a expõe. | PRD Seed (3 cuidados); AD-10 |
| R-9.2 | Itens do seed vêm de `prisma/fipe-fixture.json` e as imagens de arquivos locais do repositório (ou ausentes → ilustração padrão). O seed **não faz requisição de rede**. | PRD Seed; AD-12 |
| R-9.3 | Datas do seed são relativas ao momento da execução. O lote ao vivo dura 30 dias a partir de agora. | PRD Seed |
| R-9.4 | `npm run seed` é seguro de rodar no deploy: se já existem usuários, não faz nada e **sai com código 0** e a mensagem "seed ignorado: já existem usuários". Nunca apaga dados. Duas execuções simultâneas (dois processos, ou web e API acordando juntas) não se atropelam: o seed adquire `pg_advisory_lock` (chave fixa) antes de checar se há usuários e libera ao fim; o segundo processo espera, vê os usuários e sai com código 0. | AD (seed recusa) |
| R-9.12 | **Dono do seed final.** Esta fatia **reescreve** `prisma/seed.ts` (as S01 a S06 deixaram seeds provisórios, só para suas demonstrações): ordem de criação fixa 001→005 (§11), numeração sequencial 001 = arrematado … 005 = ao vivo. Os lotes provisórios criados nas fatias anteriores (por exemplo o ao vivo "Uno" da S02, criado com início há 1 h) são **descartados**, não preservados: o seed final é o único que existe em produção. | Revisão: S02 e S09 numeravam o primeiro lote de formas diferentes |
| R-9.5 | `npm run seed:demo` **cria um novo** lote ao vivo de demonstração (30 dias, lances de Ana e Bruno via service) sem tocar nos demais e, se o saldo disponível de Ana ou Bruno estiver abaixo do valor-base de §11, deposita a diferença pelo service (entra no extrato como depósito). | PRD Seed ("comando que recria o lote") |
| R-9.6 | Produção: `/kit` responde 404 (`notFound()`); página diagnóstica da S00 não existe mais; nenhum `console.log` de depuração; nenhum stub "em construção". | S00 |
| R-9.7 | Dois temas completos em todas as telas e estados; tema inicial = sistema; escolha manual persiste em `localStorage` e é aplicada antes da primeira pintura (sem flash). | O5; P22; C6 |
| R-9.8 | Todo estado de carregamento, vazio e erro usa `FeedbackState` com texto e, quando faz sentido, "Tentar novamente"; falha de rede mantém dado anterior marcado "DESATUALIZADO"; formulário nunca perde o que o usuário digitou. | UX-RECON; P16 |
| R-9.9 | Resiliência: com FIPE e/ou Wikipedia indisponíveis, Vitrine, Sala, Auditoria, Comprovante, Carteira, Meus arremates e Painel (lista) seguem funcionando; só `/catalog/*` e `POST /lots` degradam, com `503 EXTERNAL_UNAVAILABLE` e mensagem só na tela Criar lote. | PRD X1–X5; AD-12 |
| R-9.10 | O README é o único guia de execução. Quem segue só ele consegue rodar localmente e achar o deploy. | AC15; D1–D8 |
| R-9.11 | Segredos fora do código e do histórico do git; `.env.example` completo sem valores reais. | D3 |

## 5. Modelo de dados

Nenhuma tabela, coluna ou migração nova. O seed final **popula** as tabelas existentes.

## 6. Contratos REST

Nenhum contrato novo. Contratos verificados (sem mudar): `GET /health` → `{ok:true, db:true}`; `POST /auth/login`; `GET /lots`; `GET /lots/:id`; `GET /lots/:id/audit`; `GET /receipts/:token`; `POST /lots/:id/bids`.

## 7. Contratos Socket.IO

Nenhuma mudança. Verificados: `lot:join` (ack = snapshot), `bid:placed`, `lot:closed`, `lot:cancelled`, `showcase:lot`, `wallet:updated`.

## 8. Mensagens

Estados globais que esta fatia garante existirem de forma consistente (cada fatia criou os seus; aqui só se verifica e se cria o que faltar):

| Situação | Texto | Onde |
| --- | --- | --- |
| Carregando | "Carregando…" (região preservada, sem esqueleto animado obrigatório) | Toda tela com dados |
| Erro de carga | "Não deu para carregar agora." + botão "Tentar novamente" | Toda tela com dados |
| Dado anterior mantido | selo "DESATUALIZADO" | Telas com dados anteriores |
| Rota inexistente (404 do Next) | Título "Página não encontrada" + "Essa página não existe, ou já foi para a gaveta." + "Voltar à vitrine" (texto a revisar) | `not-found.tsx` global |
| Erro inesperado (error boundary) | "Algo travou no pátio." + "Tentar novamente" (texto a revisar) | `error.tsx` global |
| Lote inexistente | "Lote não encontrado" + "Voltar à vitrine" | Sala, Auditoria |
| Comprovante inexistente | "Comprovante não encontrado" + "Esse papel não existe, ou já foi para a gaveta." + "Voltar à vitrine" | `/c/[token]` |
| Conexão perdida | "Sem sinal com o pátio. Tentando reconectar." | Sala, Vitrine, Painel |
| Reconectado | "De volta ao pátio. Estado do lote atualizado." | Sala |
| FIPE fora do ar | "A tabela FIPE não respondeu." + "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou." + "Tentar de novo" | Só Criar lote |
| Sala encerrada sem lances | "Ninguém quis. Lote fechado sem vencedor." | Sala |
| Vitrine vazia | "O pátio está vazio. Nenhum lote publicado por enquanto." | Vitrine |
| Filtro vazio | "Pátio vazio. Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar." + "Limpar filtros" | Vitrine |

## 9. Telas e estados

Nenhuma tela nova. Esta seção são **checklists de verificação** executáveis, uma por tema.

### 9.1 Acessibilidade (WCAG 2.2 AA nos fluxos centrais)

Fluxos centrais: Acesso → Vitrine → Sala (dar lance) → Carteira (depositar) → Comprovante → Auditoria → Criar lote → Painel (cancelar).
Ferramentas: teclado puro; axe DevTools (meta: **0 violações críticas ou sérias** nos fluxos centrais, nos dois temas); leitor de tela (NVDA no Windows) nos passos da Sala; zoom 200%.

| # | Item | Telas | Como testar | Passa quando |
| --- | --- | --- | --- | --- |
| A1 | Foco visível em todo elemento interativo (contorno 3px `tinta`, afastamento 3px, halo `papel`) | Todas | Tab por toda a tela, nos dois temas | Nenhum elemento focado fica sem indicador. Inclui radios de papel no Acesso (cartão do bilhete mostra foco) e o campo de lance (caixa inteira) |
| A2 | Teclado completo | Todas | Fazer cada fluxo central sem mouse | Tudo alcançável; Enter no campo de lance envia; Esc fecha o diálogo de cancelamento; setas/Home/End nas abas do Acesso |
| A3 | Pular para o conteúdo | Todas | Primeiro Tab em cada rota | Link "Pular para o conteúdo" aparece e leva ao `main` |
| A4 | Landmarks | Todas | axe / árvore de acessibilidade | `header`, `nav` (aria-label diferente por papel), `main`, `section aria-labelledby`; `lang="pt-BR"` |
| A5 | Live regions sem duplicar | Sala | NVDA recebendo 3 lances de outro navegador | Cada mudança de situação (ganhando/superado/prorrogado/encerrado) anunciada **uma** vez; histórico não é live; cronômetro não anuncia por segundo, só "Últimos 2 minutos" e cada prorrogação; recusa por `role="alert"` |
| A6 | Anúncios de ações | Carteira, Meus arremates, Comprovante, Criar lote, Auditoria | NVDA | "Link copiado", depósito feito, estado da FIPE, "Verificando/Íntegro/Adulterado" são anunciados |
| A7 | Nomes acessíveis únicos em botões repetidos | Painel, Arremates, Vitrine | axe + árvore | "Cancelar lote 023, {carro}", "Ver comprovante do lote {NNN}", "Conferir na auditoria do lote {NNN}", "Copiar link do comprovante do lote {NNN}"; cartões da Vitrine com nome = título do lote; cronômetro dos cartões com rótulo |
| A8 | Rótulo e ajuda do campo | Lance, Depósito, Acesso, Criar lote | NVDA | Nome do campo de lance = "Seu lance"; "Mínimo aceito…" em `aria-describedby`; "Mínimo de 8 caracteres" fora do placeholder |
| A9 | Erros ligados ao campo | Acesso, Criar lote, Depósito, Sala | Provocar cada erro | `aria-invalid` + `aria-describedby` apontando para a mensagem; foco e valor digitado preservados |
| A10 | Abas do Acesso | Acesso | Teclado | `role=tablist/tab/tabpanel`, `aria-selected` + `aria-controls`, setas/Home/End, só a aba ativa no Tab |
| A11 | `prefers-reduced-motion` | Todas | Ativar no SO | Sem pulsos, flips, carimbo "bate", selo "+2 MIN" animado; todos os estados visíveis no final |
| A12 | Alvos de toque ≥ 44px | Todas | Inspecionar | Chip de saldo, "Auditar este lote", "Como funciona", "ver inteiro", atalhos de valor atendem |
| A13 | Cor nunca é o único sinal | Sala, Auditoria, Painel, Arremates | Escala de cinza / daltonismo | Ganhando/superado/íntegro/adulterado/urgente têm palavra + ícone ou carimbo |
| A14 | Contraste 4,5:1 (3:1 para texto grande e controles) | Todas, 2 temas | axe + inspeção | Inclui "ELO QUEBRADO", rótulos do cronômetro (`#8A8273` sobre `painel`), `ferrugem` noite sobre `papel` noite. "BRASIL" branco sobre faixa ocre é só marca decorativa |
| A15 | Tabelas | Extrato, Painel, Auditoria | axe | `caption`, `th scope="col"`; contêiner rolável com `tabindex=0`, `role=region`, `aria-label` |
| A16 | Rotação decorativa não quebra zoom/reflow | Comprovante, Sala, Vitrine | Zoom 200% | Sem sobreposição que esconda texto |
| A17 | Valores lidos como moeda | Sala, Carteira, Comprovante | NVDA | `aria-label` "trinta e um mil reais" nos contêineres de valor |

### 9.2 Responsivo (design fluido, sem breakpoints nomeados)

Testar em **320px, 390px, 1440px** e em **zoom 200%** de uma janela de 1280px (≈ 640 CSS px) e a 400% se o navegador permitir. Para cada tela:

| Tela | 320 / 390 | 1440 |
| --- | --- | --- |
| Vitrine | Cartões em 1 coluna; filtros quebram; cabeçalho quebra em linhas; "Como funciona" empilha | 3 cartões por linha |
| Acesso | Texto, depois formulário; abas legíveis | 2 colunas |
| Sala | Ficha do carro, **depois** painel de lance e histórico (ordem do DOM); placa e cronômetro quebram de linha | 2 colunas |
| Carteira | Equação em cartões empilhados; extrato rola em região rotulada | 3 cartões na linha |
| Meus arremates | Ingresso empilha; abas quebram | Ingresso com stub à esquerda |
| Comprovante | Recibo em coluna única legível, hash quebra em qualquer ponto | Largura 1200px |
| Painel | Resumo e cartões fluidos; tabela (760px) rola em região rotulada | Tabelas completas |
| Criar lote | Formulário e prévia empilhados, sem perder a sequência | Duas colunas |
| Auditoria | Veredito empilha; tabela (780px) rola em região rotulada; aside embaixo | Tabela + aside |

Passa quando, em todas: nenhuma rolagem horizontal da **página** (só tabelas, dentro de região focável); nenhum texto cortado; nenhum botão ou ação inalcançável; tabulação continua na ordem de leitura; nada fixo cobrindo formulário ou foco.

### 9.3 Dois temas

Para cada tela e cada estado relevante (Sala: ganhando, superado, prorrogado, últimos 2 min, encerrado vencedor/não vencedor/visitante/sem lances, cancelado, agendado, recusa; Auditoria: íntegro/adulterado; Comprovante; Painel com diálogo aberto):

- Claro e noite renderizam sem cor fora dos tokens, sem sombra borrada, sem texto ilegível.
- Trocar o tema pelo `ThemeSwitch` aplica na hora, persiste após recarregar e **não pisca** o tema errado (testar com "Disable cache" + CPU throttling e com `localStorage` = noite).
- Sem escolha manual, o tema acompanha `prefers-color-scheme` (testar mudando a preferência do SO com a aba aberta).
- Fixas (`faixaPlaca`, `rotuloRelogio`, `digitoPlaca`, `linhaCentralPlaca`) não mudam com o tema.

### 9.4 Estados globais por tela

Verificar cada linha: carregando, erro com "Tentar novamente", vazio, 404 quando aplicável, e que a falha não apaga o que o usuário digitou.

| Tela | Carregando | Erro | Vazio | 404 |
| --- | --- | --- | --- | --- |
| Vitrine | sim | sim | global e filtro | n/a |
| Sala | sim | sim (dado anterior "DESATUALIZADO") | ao vivo sem lances | lote inexistente |
| Carteira | sim | sim | extrato vazio "Nenhuma movimentação ainda" | n/a |
| Meus arremates | sim | sim | "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora." | n/a |
| Comprovante | sim | sim | n/a | token inexistente |
| Painel | sim | sim | seções vazias | n/a |
| Criar lote | "CONSULTANDO A FIPE…" | FIPE fora; imagem sem foto | n/a | n/a |
| Auditoria | "Refazendo a conta…" | sim | sem lances | lote inexistente |
| Rota inexistente | n/a | n/a | n/a | `not-found.tsx` |

## 10. Componentes criados

Nenhum componente novo, exceto `app/not-found.tsx` e `app/error.tsx` globais (usando `FeedbackState`). Correções de a11y/tema/estado vão no componente dono.

## 11. Seed final

Comando: `npm run seed -w apps/api` (raiz: `npm run seed`). Lê `prisma/fipe-fixture.json`. Executado no deploy e no `docker compose up` (primeiro start). **No Railway** (decisão 27/10/2026) o seed roda no comando de start da API, ao lado do `migrate deploy`: `npx prisma migrate deploy … && (npx tsx apps/api/prisma/seed.ts || echo seed-falhou-subindo-sem-ele) && node apps/api/dist/server.js`. É seguro porque o seed sai com código 0 quando já há usuários e é protegido por advisory lock (R-9.4); roda a cada start da API.

Este arquivo substitui qualquer seed anterior (R-9.12). Os lotes 001 a 003 são criados no passado com `FakeClock` + `createLot({ allowPast: true })`; 004 e 005 usam o relógio real e a validação normal.

**Usuários (sugestão de credenciais; a senha única é pública de propósito, é dado de teste):**

| Papel | Nome | E-mail | Senha | Saldo inicial (depósito) |
| --- | --- | --- | --- | --- |
| Leiloeiro | Seu João | `leiloeiro@lanceauto.test` | `lance1234` | n/a (carteira existe; recebe créditos) |
| Licitante | Ana | `ana@lanceauto.test` | `lance1234` | R$ 500.000,00 |
| Licitante | Bruno | `bruno@lanceauto.test` | `lance1234` | R$ 300.000,00 |

Os saldos já consideram que o lote arrematado debita a Ana: o seed deposita antes (R$ 500.000) e o saldo final é menor depois da liquidação (o que importa é sobrar saldo disponível para a avaliação dar lances).

**Lotes (numeração sequencial na ordem de criação; 5 lotes):**

| Nº | Estado | Como o seed monta | O que mostra |
| --- | --- | --- | --- |
| 001 | Encerrado, arrematado | `FakeClock` no passado: cria o lote (início há 3 dias, fim há 2 dias), 4–5 lances alternando Ana e Bruno (inclui 1 prorrogação, ou seja, 1 lance a menos de 2 min do fim), avança o relógio e roda a liquidação. Vencedora: Ana | Comprovante com token e link; Meus arremates da Ana "Arrematado"; auditoria Íntegra; Painel com resultado e "Total recebido" > 0 |
| 002 | Encerrado, sem lances | Cria no passado, fim no passado, liquidação sem lances | Carimbo "Sem lances"; auditoria "Sem lances, sem corrente para conferir." |
| 003 | Cancelado | Cria; Bruno dá 1–2 lances; leiloeiro cancela (`REFUND` ao líder, linha CANCEL) | Não aparece na Vitrine; Painel "Cancelados"; extrato do Bruno "Saldo liberado · lote cancelado"; auditoria com linha CANCEL |
| 004 | Agendado | Início em +2 dias, fim em +3 dias | Sala com abertura; sem formulário |
| 005 | Ao vivo | Início agora, fim em +30 dias, incremento do lote, 4–6 lances de Ana e Bruno (o último líder é **Bruno**, para que a Ana, ao entrar, veja "superado" e possa cobrir) | Lote para a avaliação dar lances na hora |

Valores sugeridos: lance inicial e incremento coerentes com a referência FIPE de cada item (ex.: inicial ≈ 60% da referência arredondado a R$ 500, incremento R$ 500 a R$ 1.000). `seed:demo` e o seed usam a mesma função `buildLiveDemoLot`.

**`npm run seed:demo`:** cria um **novo** lote ao vivo (30 dias) com lances de Ana e Bruno pelos services e recompõe saldo (R-9.5): se `disponível < R$ 100.000`, deposita para chegar a R$ 100.000 (valor-base sugerido). Imprime o número e a URL do lote. Não toca nos outros lotes.

**Datas:** sempre relativas a `clock.now()`. Os horários do passado vêm do `FakeClock`; o último passo do seed volta ao relógio real.

## 12. Critérios de aceite

**Seed**

- AC-9.1 [auto] Dado banco vazio, quando `npm run seed`, então existem 1 leiloeiro, 2 licitantes com `Wallet` e extrato com depósito, 5 lotes nos estados 001–005 e os números de §11. (AC14 / S1–S6)
- AC-9.2 [auto] Dado o seed rodado, quando audito cada lote (`GET /lots/:id/audit`), então todos `OK`. (S9)
- AC-9.3 [auto] Dado o seed rodado, então não houve nenhuma requisição de rede (mock de `fetch`/`http` falha o teste se chamado) e nenhuma linha foi inserida por SQL direto (`Bid` só existe via service; verificado porque todas as cadeias são válidas). (S8, S9)
- AC-9.4 [auto] Dado o seed rodado, quando conferir saldos, então `total − committed = disponível` e `Σ ledger` bate com `Wallet` para os 3 usuários; o lote 001 tem um `Receipt`, um `SALE_DEBIT` da Ana e um `SALE_CREDIT` do leiloeiro com o mesmo valor; o lote 003 tem `REFUND` e `committed` do Bruno sem o valor do lote 003. (S4, S6)
- AC-9.5 [auto] Dado o seed já rodado, quando `npm run seed` de novo, então nada muda, a saída traz "seed ignorado: já existem usuários" e o código de saída é 0. (R-9.4)
- AC-9.6 [auto] Dado o seed rodado, quando `npm run seed:demo`, então surge o lote 006 ao vivo com `endsAt ≈ agora + 30 dias`, com lances, auditoria `OK`, e os lotes 001–005 permanecem iguais; rodar duas vezes cria 006 e 007. (S7)
- AC-9.7 [auto] Dado Ana com disponível R$ 20.000,00, quando `seed:demo`, então um depósito de R$ 80.000,00 aparece no extrato dela antes dos lances (R-9.5).
- AC-9.8 [auto] Dado o seed disparado duas vezes ao mesmo tempo (`Promise.all` de dois processos filhos ou de duas chamadas à função `runSeed` com conexões distintas) em banco vazio, então o segundo espera o `pg_advisory_lock`, encontra os usuários e sai com código 0 e "seed ignorado: já existem usuários"; no fim há exatamente 3 usuários e 5 lotes (sem duplicata, sem `EMAIL_TAKEN` vazando como erro). (R-9.4, borda)
- AC-9.9 [manual] Dado o deploy, então a Vitrine do link público mostra 1 lote ao vivo (005), 1 agendado (004) e 1 encerrado arrematado + 1 sem lances (001, 002) e não mostra o 003.

**Resiliência da API externa (AC13 / R-9.9)**

- AC-9.10 [auto] Dado `FIPE_BASE_URL` apontando para porta fechada e Wikipedia indisponível, quando chamo `GET /lots`, `GET /lots/:id`, `GET /lots/:id/audit`, `GET /receipts/:token`, `GET /items/:id/image`, então todas respondem 200 com dados do banco. (X2)
- AC-9.11 [auto] Dado a FIPE fora, quando `GET /catalog/brands` sem cache, então 503 `EXTERNAL_UNAVAILABLE` `{source:'FIPE'}` após no máximo 2 tentativas com timeout 4 s cada; com cache vencido, serve o cache. (X4, X5)
- AC-9.12 [auto] Dado a Wikipedia fora e a FIPE ok, quando `POST /lots` sem `imageUrl`, então o lote é criado, sem imagem (`imageData` nulo) e a Sala mostra a ilustração padrão. (X3)
- AC-9.13 [manual] Dado a FIPE **e a Wikipedia** fora (local ou Docker Compose, com `FIPE_BASE_URL` e `WIKIPEDIA_BASE_URL` inválidas e a API **reiniciada** para zerar o cache em memória da S02), quando percorro Vitrine, Sala, Auditoria, Comprovante, Carteira, Meus arremates e Painel, então tudo funciona; só a tela Criar lote mostra "A tabela FIPE não respondeu." com formulário preservado e "Agendar lote" desabilitado. (E12)
- AC-9.14 [manual] Dado o mesmo cenário, quando clico "Tentar de novo" depois de restaurar a variável e reiniciar a API, então os selects voltam a funcionar sem recarregar a página.

**Estados globais, 404 e temas**

- AC-9.15 [manual] Dado cada linha de §9.4, então o estado existe e usa `FeedbackState` com o texto de §8.
- AC-9.16 [manual] Dado `/lotes/00000000-0000-0000-0000-000000000000`, `/c/token-que-nao-existe`, `/lotes/x/auditoria` e `/rota-qualquer`, então cada uma mostra a mensagem de 404 correspondente e "Voltar à vitrine".
- AC-9.17 [manual] Dado a API parada, quando abro a Vitrine, então "Não deu para carregar agora." + "Tentar novamente"; ao subir a API e clicar, carrega.
- AC-9.18 [manual] Dado `localStorage.theme = 'noite'`, quando recarrego com throttling, então a primeira pintura já é noite. (O5)
- AC-9.19 [manual] Dado os checklists §9.1, §9.2, §9.3, então todos os itens passam e axe não reporta violação crítica/séria nos fluxos centrais nos dois temas. (UX-A11Y, UX-RESP, UX-THEME)
- AC-9.20 [manual] Dado `/kit` em produção, então 404; dado a Vitrine publicada, não existe página diagnóstica nem stub "em construção" em nenhuma rota.
- AC-9.21 [manual] Dado varredura textual nos textos de interface, então não há exclamação nem emoji, plural correto ("1 lance"/"2 lances") e valores/horários/hashes em Plex Mono. (UX-VOICE)

**Hibernação e inicialização**

- AC-9.22 [manual] **(Railway, 27/10/2026)** Dado que a API do Railway não hiberna, quando um deploy ou reinício derruba o processo, então a Sala mostra "Sem sinal com o pátio. Tentando reconectar.", o socket reconecta sozinho e a Sala volta com "De volta ao pátio"; o README descreve o comportamento e cita o ping externo só como opção para outras hospedagens.
- AC-9.23 [manual] Dado um lote cujo `endsAt` passou enquanto a API dormia, quando a API acorda, então a varredura de boot liquida o lote (uma vez; `settledAt` preenchido; comprovante criado; saldos certos), sem lances duplicados. (AD-6)

**Verificação ponta a ponta dos critérios do PRD**

- AC-9.24 [manual] Dado §15 (procedimento AC1–AC15), então **AC11** passa em ambiente local ou Docker Compose (nunca no banco de produção) e **os outros 14** passam no **link público**, anotados com data, ambiente e resultado no `progresso.md`. AC13 também é local/Compose (precisa derrubar as APIs externas); no link público basta conferir que Vitrine, Sala, Auditoria e Comprovante carregam sem chamar FIPE/Wikipedia.
- AC-9.25 [manual] Dado uma pessoa que não conhece o projeto e uma máquina com Docker, quando segue só o README, então `docker compose up` sobe db, api e web, o seed roda e ela consegue entrar como Ana e dar um lance. (AC15 / D5)
- AC-9.26 [manual] Dado o README, então cada item D1–D8 de §14 está presente (checklist marcada). (D1–D8)

## 13. Casos de borda e concorrência

- **Troca de `AUDIT_HMAC_KEY` ou `JWT_SECRET` em produção:** trocar a chave HMAC invalida todas as cadeias já gravadas (aparecem como adulteradas) e o `seed:demo` não conserta lotes antigos; trocar `JWT_SECRET` desloga todos. Definir as duas **uma vez, antes do primeiro seed**, e documentar no README (D8).
- **Seed em deploy repetido:** o release (ou o start da API, ver §11) roda `npm run seed` a cada deploy/acordada; R-9.4 (checagem de usuários + advisory lock) garante que é inofensivo.
- **Seed durante tráfego:** só roda no release ou manualmente; o lote 005 tem 30 dias.
- **Relógio:** o seed usa `FakeClock` para o passado; ao terminar, nenhum service fica com o relógio falso (o `Clock` é injetado só no escopo do seed).
- **Fuso:** Render roda em UTC; as datas do seed e da UI não dependem do fuso do processo (UI converte para America/Sao_Paulo).
- **Deploy da web antes da API (ou o contrário):** `WEB_ORIGIN` na API deve ser **exatamente** a origem da web (CORS e Socket.IO); `NEXT_PUBLIC_API_URL` na web aponta para a API. Origem errada = web "no ar" sem dados.
- **WebSocket bloqueado na rede do avaliador:** o Socket.IO cai para long-polling; a Sala segue funcionando pelo snapshot HTTP ao reconectar (INV-1).
- **Lance concorrente na verificação do AC5:** só o teste automatizado (§14) vale como evidência; clique simultâneo manual não é determinístico.
- **Docker em máquina limpa:** o primeiro `up` demora (build); a API só aceita tráfego depois de `prisma migrate deploy`; o seed roda uma vez.

## 14. Testes exigidos

Suite completa verde no CI e localmente (`npm test` na raiz) antes do deploy final:

1. Seed (AC-9.1 a AC-9.8) como teste de integração com `DATABASE_URL_TEST`.
2. Resiliência (AC-9.10 a AC-9.12) com `FIPE_BASE_URL` inválida / servidor falso respondendo erro/timeout.
3. Regressão das regras de ouro já cobertas nas fatias: lances (R1–R5, M1–M8), 2 lances simultâneos, prorrogação, liquidação única, cancelamento com estorno, adulteração direto no banco. Esta fatia só confere que **todos rodam no CI** e lista a cobertura no `progresso.md` (O4/TST).
4. Teste de varredura de privacidade (S08) rodando sobre o banco **semeado**.
5. `npm run build` de `web` e `api` sem erro; `npm run lint` e `typecheck` limpos.
6. Smoke de `docker compose config` válido (CI) e `GET /health` após `up` (manual).

## 15. Retrofits e integrações — procedimento manual de verificação AC1–AC15

Executar no **link público**. Contas: leiloeiro `leiloeiro@lanceauto.test`, Ana, Bruno (senha `lance1234`). Usar 3 perfis de navegador (ou janelas anônimas) logados ao mesmo tempo. Anotar passa/falha e data.

| AC | Passo a passo | Resultado esperado |
| --- | --- | --- |
| AC1 | (a) Ana abre a Sala do lote **004** (agendado) e tenta dar lance por API (`curl` com o token dela) ou, se o formulário aparecer, pelo campo. (b) Leiloeiro cria um lote que começa em 1 min; antes de abrir, Ana tenta lance. (c) Aguardar o fim de um lote de 5 min e tentar de novo. (d) Leiloeiro cancela um lote ao vivo qualquer; Ana tenta dar lance nele (`curl`, pois a Sala já mostra "Cancelado" sem formulário) | (a/b) `LOT_NOT_STARTED` "O lote abre {dia}, {dd/mm}, às {HH}h. Até lá o martelo fica na gaveta."; (c) `LOT_ENDED` "Martelo batido às {hh:mm}. Este lote não aceita mais lances."; (d) `LOT_CANCELLED` (texto da S06 §8) |
| AC2 | No lote **005** (inicial/atual conhecidos), Ana dá lance abaixo de atual+incremento. Em um lote novo sem lances, lance abaixo do inicial | `BELOW_MINIMUM` "Seu lance precisa ser de pelo menos R$ {mínimo},00." com borda do campo em `ferrugem`; o valor digitado permanece |
| AC3 | Bruno (líder do 005) tenta cobrir o próprio lance com valor ≥ mínimo | `ALREADY_WINNING` "Você já está na frente. Cobrir o próprio lance só gasta saldo." |
| AC4 | (a) Ana (disponível conhecido) dá lance acima do disponível. (b) Ana dá um lance válido no 005 e **assume a liderança** (Bruno era o líder); depois Bruno cobre o lance de Ana e a carteira de Ana é conferida | `INSUFFICIENT_BALANCE` "Saldo insuficiente: você tem R$ X,00 disponíveis." + link "Depositar na carteira →". Ao ser superada, o chip de saldo da Ana sobe na hora (sem recarregar) e o extrato mostra a liberação |
| AC5 | **Só pelo teste automatizado** (`npm test -w apps/api -- bids.concurrency`): o clique simultâneo manual não é reproduzível de forma determinística e não conta como evidência. Anotar no `progresso.md` o resultado do teste | Um único líder; o outro recebe `BELOW_MINIMUM` `OUTDATED`; `total−committed` de cada um coerente com o extrato |
| AC6 | Leiloeiro cria lote de **5 min** (mínimo), aberto. Aos ~1 min 30 s do fim, Ana dá um lance; observar os três navegadores | O relógio de **todos** salta para `hora do lance + 2 min`; selo "+2 MIN" e o parágrafo "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às hh:mm:ss. Ninguém leva no susto." |
| AC7 | Ana e Bruno na Sala do 005; Ana dá lance | O lance, a placa, o contador e o histórico de Bruno atualizam **sem recarregar**; um terceiro navegador (visitante) também |
| AC8 | No lote de 5 min do AC6, deixar fechar com lances | Em até ~5–10 s: "Martelo batido…", carimbo Arrematado; o valor sai do total da vencedora, entra no total do leiloeiro (Painel: Total recebido sobe); um comprovante existe (um só, mesmo recarregando a página várias vezes) |
| AC9 | Leiloeiro cria lote de 5 min e ninguém dá lance; esperar fechar | Carimbo "Sem lances"; "Ninguém quis. Lote fechado sem vencedor."; sem comprovante; nenhum saldo mexe |
| AC10 | (a) Leiloeiro cancela lote sem lances: some da Vitrine. (b) Cancela lote **com** lances (Bruno líder): diálogo informa lances e estorno | (a) some da Vitrine em todos os navegadores; (b) Bruno recebe o estorno (chip sobe, extrato "Saldo liberado · lote cancelado"), a Sala mostra Cancelado, a auditoria mostra a linha CANCEL |
| AC11 | **Somente em ambiente local ou Docker Compose.** Seguir o SQL do README (`docker compose exec db psql …`: desativar `bid_no_update_delete`, alterar um valor, reativar); abrir a auditoria | "Adulterado" apontando a linha; depois remover as últimas linhas de outro lote: "selo do lote não confere". (Não executar contra o banco de produção do avaliador.) |
| AC12 | Abrir comprovante e auditoria sem login e inspecionar a aba Network/JSON | Apenas pseudônimos "Licitante XXXX"; nenhum nome, e-mail ou id de usuário |
| AC13 | **Local ou Compose.** Cenário de AC-9.13 (FIPE e Wikipedia derrubadas por variável, API reiniciada) | Tudo funciona; só Criar lote reclama |
| AC14 | Após o seed, listar usuários e lotes | 1 leiloeiro, 2 licitantes, lote ao vivo com lances (005) |
| AC15 | Pessoa de fora segue só o README em máquina limpa e abre o link público | Roda local e o link público funciona |

Retrofits finais (limpeza):

| Item | Ação |
| --- | --- |
| `/kit` | `notFound()` em produção (R-9.6). Pode permanecer em dev |
| Stubs "em construção" (`/painel` da S01 etc.) | Verificar que não restam |
| TODOs/`console.log`/código morto | Remover |
| Header | Conferir nav final por papel: Visitante (Vitrine, Entrar, Criar conta); Licitante (Vitrine · Carteira · Meus arremates, chip de saldo, "VOCÊ · Licitante", Sair, Tema); Leiloeiro (Meus lotes · Criar lote · Vitrine, "VOCÊ · Leiloeiro", Sair, Tema) |
| Links de auditoria/comprovante | Todos apontam para o lote certo (nenhum fixo no lote 018) |

### README — conteúdo mínimo por item (D1–D8)

O README fica na raiz, em pt-BR, com este índice. Cada item abaixo é obrigatório.

| Item | Seção do README | Conteúdo mínimo |
| --- | --- | --- |
| D1 | Visão geral | O que é o LanceAuto; link do deploy (web) e da API; **usuários de teste** (tabela de §11 com e-mail e senha); roteiro de 5 passos para testar |
| D2 | Stack e decisões | Next.js+React+TS, Express, Socket.IO, PostgreSQL+Prisma, monorepo npm workspaces; decisões: prorrogação = lance + 2 min, posição = maior lance de cada licitante, cancelamento com lances faz estorno, sem edição de lote agendado, depósito máx R$ 10 mi, imagem Wikipedia editável, dinheiro em centavos, datas em UTC, pseudônimo por lote, JWT em `localStorage`, monólito modular com um processo; hosts (Vercel, Render, Neon) |
| D3 | Pré-requisitos e variáveis | Node LTS, npm, Docker (opcional), PostgreSQL 16+; tabela de variáveis (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `AUDIT_HMAC_KEY`, `WEB_ORIGIN`, `FIPE_BASE_URL`, `FIPE_TOKEN?`, `WIKI_USER_AGENT`, `WIKIPEDIA_BASE_URL`, `PORT`, `NEXT_PUBLIC_API_URL`, `AUTH_RATE_LIMIT_MAX`, `RATE_LIMIT_DISABLED`, `DATABASE_URL_TEST`) com para que serve e como gerar segredos (ex.: `openssl rand -hex 32`); `.env.example` completo |
| D4 | Banco | Criar o banco, `npx prisma migrate deploy`, `npm run seed`, `npm run seed:demo`; o que o seed cria; aviso de não trocar `AUDIT_HMAC_KEY` depois |
| D5 | Como rodar | Local: `npm install`, `npm run dev` (api e web); Docker: `docker compose up`; portas; como abrir; como parar/limpar volumes |
| D6 | Testes | `npm test`; testes de integração exigem `DATABASE_URL_TEST`; o que cada suite cobre (regras de lance, 2 lances simultâneos, saldo, liquidação, cancelamento com estorno, adulteração direto no banco, resiliência) |
| D7 | Anti-adulteração | Texto de `slice-08` §15 (copiar) |
| D8 | Comportamentos inesperados e limitações | Lista abaixo |

D8 — lista mínima:

1. **Prorrogação:** novo fim = horário do lance + 2 min (interpretação adotada do enunciado), sem teto de prorrogações.
2. **Hospedagem sem hibernação (Railway):** a API roda como processo contínuo; um deploy ou reinício derruba os sockets por alguns segundos e os navegadores reconectam sozinhos; se a API ficar parada, o timer de fechamento para e a varredura de boot liquida o atraso. Ping externo (UptimeRobot e semelhantes) só é citado, para hospedagens que dormem.
3. **Limite da FIPE:** 500 requisições/dia sem token (1.000 com token gratuito); por isso o cache de 24 h; se o cache esvaziar e a FIPE cair, o Criar lote mostra erro e o resto do app segue.
4. **Carros sem imagem:** nem todo modelo tem artigo/foto na Wikipedia; o nome da FIPE é simplificado para buscar; sem foto usa ilustração padrão; imagens sob licença Creative Commons com crédito.
5. **Auditoria:** limitações do texto de D7 (quem tem a chave, backup antigo e completo, troca de `AUDIT_HMAC_KEY`).
6. **Apuração:** o fechamento roda a cada 5 s, então entre `00:00` e o resultado pode haver alguns segundos de "Apurando o resultado…".
7. **Pseudônimo:** 4 caracteres; colisão rara entre licitantes do mesmo lote.
8. **Uma instância da API:** Socket.IO sem adaptador; escalar exigiria Redis.
9. **Autenticação:** sem recuperação de senha (por escolha); JWT de 7 dias em `localStorage`; um papel por conta.
10. **Saldo simulado:** sem pagamento real; depósito máximo R$ 10.000.000,00 por operação.
11. **Valores:** UI em reais inteiros; internamente centavos. Horários exibidos em Brasília; gravados em UTC.
12. **Lote agendado não pode ser editado**, só cancelado.
13. **Segredos:** trocar `AUDIT_HMAC_KEY` invalida os históricos; trocar `JWT_SECRET` desloga todos.
14. **Rede restrita:** se WebSocket for bloqueado, o Socket.IO usa long-polling.
15. **Limites de requisição:** login/cadastro (30/min por IP), lances (30/min por usuário) e auditoria (60/min por IP). Atrás do proxy do Render o IP vem de `X-Forwarded-For` (`trust proxy` = 1); numa rede corporativa com IP compartilhado, o avaliador pode, raramente, receber "muitas requisições" e deve esperar um minuto.
16. **Limites da auditoria:** o dono de um lance (`bidderId`) e a contabilidade (saldos, extrato) ficam fora do hash; ver o texto de D7.

### Deploy final (checklist)

| # | Item |
| --- | --- |
| 1 | Hosts e versões confirmados e lockfile commitado (a arquitetura marcou Vercel/Render/Neon e versões como `[ASSUMPTION]`) |
| 2 | Railway (Postgres): `DATABASE_URL` e `DIRECT_URL` iguais, pela rede privada (sem pooler) |
| 3 | Railway (API): variáveis completas; `WEB_ORIGIN` = origem exata do web; comando de start = `prisma migrate deploy` + seed tolerante a falha + `node dist/server.js` (seed idempotente com advisory lock, R-9.4); `trust proxy` = 1 ativo (T1) |
| 4 | Railway (web): `NEXT_PUBLIC_API_URL` = URL pública da API |
| 5 | `JWT_SECRET` e `AUDIT_HMAC_KEY` fortes definidos **antes** do primeiro seed e anotados em local seguro |
| 6 | Migrações aplicadas; seed executado; `GET /health` → `{ok:true, db:true}` |
| 7 | Smoke pelo **link público**: login como Ana/Bruno/leiloeiro, lance, Sala ao vivo com 2 navegadores, comprovante, auditoria, Criar lote com FIPE real |
| 8 | CORS e WebSocket confirmados pelo console do navegador (sem erro) |
| 9 | `seed:demo` provado em banco descartável; em produção só com aval do Felipe (documentado no README como "rode se o lote ao vivo expirar") |
| 10 | Verificar AC1–AC15 (§15) neste ambiente e anotar |

## 16. Conflitos resolvidos e perguntas abertas

Conflitos resolvidos:

| Conflito | Resolução |
| --- | --- |
| PRD "dark mode: se der tempo" × tokens dos dois temas desde a S00 | Dark mode entregue (custo baixo, tokens prontos); não bloqueia a entrega se algo falhar, mas AC-9.18/9.19 o exigem para considerar a fatia pronta |
| Arquitetura "seed recusa se houver usuários" × release que roda a cada deploy | Seed sai com código 0 e mensagem (R-9.4) |
| PRD "comando que recria o lote de demonstração" | `seed:demo` cria um novo lote ao vivo (não apaga o anterior), em linha com "sem destruir dados" |

Perguntas abertas (sugestão marcada; decisão é do usuário):

1. **Credenciais de teste.** Sugestão: `leiloeiro@lanceauto.test`, `ana@lanceauto.test`, `bruno@lanceauto.test`, senha única `lance1234`; saldos R$ 500.000 e R$ 300.000. Confirmar nomes, domínio e valores.
2. **Aviso de servidor acordando.** Sugestão: se a primeira chamada à API passar de 3 s, mostrar `FeedbackState` "Acordando o pátio…". Não está no design nem no PRD (o PRD só manda citar a hibernação no README). Fazer ou deixar só no README?
3. **Lote de demonstração com prazo curto.** Sugestão: `seed:demo --relampago` cria também um lote que fecha em 10 min para a avaliação ver a prorrogação e o fechamento sem esperar. Hoje o procedimento do AC6/AC8 usa Criar lote com 5 min.
4. **Ping externo** (UptimeRobot etc.) para evitar hibernação. O PRD/arquitetura dizem "opcional". Sugestão: citar no README, não configurar.
5. **Repositório público.** O repositório está privado (progresso.md). A entrega exige público; confirmar a data de virada e que nenhum segredo está no histórico.
6. **Valor-base de recomposição de saldo do `seed:demo`** (R$ 100.000 sugerido).
7. **Cartão Encerrado da Vitrine → auditoria direta ou Sala?** A S08 (AC-8.34) manda o cartão Encerrado direto para a auditoria; o PRD descreve Vitrine → Sala. Ver a pergunta 5 da S08 §16. **Pergunta para o usuário**; o roteiro de demonstração desta fatia vale nos dois casos (a Sala encerrada tem o link "Auditar este lote").

8. **Host do deploy (aviso).** O deploy migrou de Render + Vercel + Neon para o **Railway**. Esta fatia cita Render, Vercel e Neon (hibernação, release/pre-deploy command do Render, pooling do Neon, `WEB_ORIGIN` da Vercel) e, por isso, o item 2 da seção de limitações (hibernação), a pergunta 2 ("Acordando o pátio…") e a checklist de deploy precisam ser relidos contra o Railway: lá a API não hiberna e o seed pode entrar no start, ao lado do `migrate deploy`. Fatia não reescrita; decidir na S09.

Nota de propriedade (rastreabilidade): `O4`/`TST` têm dono nominal nesta fatia, mas os testes são escritos nas S01 a S08; aqui só se **verifica** que todos rodam no CI e se registra a cobertura. O mesmo vale para `T3` (dono S06, Sala já completa na S05) e `DEP` (dono S00): a S09 só confere o resultado final.

### Decisões do Felipe (27/10/2026) para as perguntas acima

| # | Decisão |
|---|---|
| 1 | Credenciais mantidas: `leiloeiro@`, `ana@`, `bruno@lanceauto.test`, senha `lance1234`; saldos R$ 500.000 e R$ 300.000 |
| 2 | **Não fazer** "Acordando o pátio…": o Railway não hiberna. D8 item 2, AC-9.22 e a checklist de deploy foram ajustados |
| 3 | **Não fazer** `seed:demo --relampago` |
| 4 | Ping externo só citado no README |
| 5 | O repositório não vira público por conta do build. Achado: o GitHub já o reporta como público; varredura inicial do histórico sem `.env`, chave privada ou padrão de segredo (resultado completo no diário) |
| 6 | Valor-base de recomposição do `seed:demo`: R$ 100.000 |
| 7 | Resolvida: o cartão Encerrado abre a Sala; a auditoria é o link "Auditar este lote" dentro dela |
| 8 | Releitura contra o Railway feita (§4, §11, §13, §15 e D8), sem Render, Vercel nem Neon |

## 17. Definition of Done

- [x] Todas as fatias S00–S08 entregues e com DoD marcado.
- [x] Seed final (001–005) reescrito por esta fatia (R-9.12), por services, sem rede, com `allowPast` só no seed e `pg_advisory_lock`; auditoria `OK` em todos; `seed:demo` funcionando; seed seguro em redeploy (onde roda no Render confirmado no dia 1). **Feito (27/10/2026).** No Railway o seed roda no start e, com usuários, não faz nada; a produção atual não foi recriada (decisão do Felipe pendente).
- [x] Checklists §9.1 (a11y), §9.2 (responsivo), §9.3 (temas), §9.4 (estados globais) passados e registrados; axe sem violações críticas/sérias nos fluxos centrais. **Feito no Chrome real headless** (152 combinações + teclado + axe, 0 crítica/séria); leitor de tela (NVDA) e aparelho real ficam com o Felipe.
- [x] 404/erro globais; `/kit` 404 em produção; sem stubs, TODOs ou `console.log`. **Feito.**
- [x] Resiliência com FIPE/Wikipedia fora comprovada (AC-9.10 a AC-9.14). **Feito** (testes AC-9.10 a 9.12; Chrome AC-9.13 e 9.14).
- [x] CI verde (lint, typecheck, test, build) e suíte completa local verde. **Feito** (`cd8b533`).
- [ ] README completo (D1–D8) e `.env.example` completo; Docker Compose testado por alguém de fora.
- [ ] Deploy final com migrações e seed; smoke e AC1–AC15 verificados no link público; resultados anotados no `progresso.md`.
- [ ] **Entrega (D9):** repositório **público** no GitHub (sem segredos no histórico); formulário da Verzel (https://elitedev.verzel.com.br/?elite-dev-2026-2) preenchido com: nome completo e e-mail; link do repositório; "Tem mais de um repositório?" = não (monorepo); link público do deploy; "Onde e como você usou IA".
- [ ] **Relato de IA (D10):** texto final montado a partir do registro do `progresso.md`: PRD e pesquisa de APIs com Claude (revisão e ajustes de Felipe); design com Claude Design; planejamento (UX, arquitetura, spec) e implementação com BMad e Claude Code; para cada etapa dizer o que foi revisado e o que mudou (**preencher com fatos reais; não inventar**). Estar pronto para explicar qualquer trecho do código.
- [x] Commits atômicos em pt-BR; `progresso.md` atualizado ao fim de cada etapa e `git push`.
