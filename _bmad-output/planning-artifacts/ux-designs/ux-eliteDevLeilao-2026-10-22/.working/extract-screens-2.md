# Extração de telas (lote 2) — LanceAuto

Fonte: `_bmad-output/planning-artifacts/design/project/{Carteira,Arremates,Comprovante,Painel,CriarLote,Auditoria}.dc.html` (lidos por inteiro).
Variantes lidas apenas no cabeçalho: `PainelEscuro`, `ComprovanteEscuro`, `CriarLoteErro`, `AuditoriaAdulterado`, `CarteiraMobile` (e por inferência `ArrematesMobile`, `ComprovanteMobile`, `AuditoriaMobile`). Todas são wrappers que importam o componente base via `<dc-import>` mudando props (`tema`, `erro-api`, `veredito`) e/ou fixando a largura em 390px (mobile) com fundo escuro `#161513`. Ou seja, mobile = o mesmo componente em 390px, sem layout dedicado; o responsivo vem de flex-wrap/clamp/grid auto-fit.

## 0. Elementos compartilhados (valem para as 6 telas)

**Props de cada componente:** `tema` (enum `claro` | `escuro`, default `claro`). Extras: `erroApi` (boolean, só CriarLote), `veredito` (enum `integro` | `adulterado`, só Auditoria). Preview 1440px de largura (alturas: 1400 Carteira/Arremates/Comprovante, 1700 Painel, 1800 CriarLote, 2000 Auditoria).

**Tokens (objeto PAL, passados como `c.*`):**

| token | claro | escuro |
|---|---|---|
| fundo | #E8DFCB | #161513 |
| papel | #F5EEDF | #262420 |
| suave | #DDD3BC | #2F2C27 |
| tinta | #1E1C19 | #ECE4D2 |
| tinta2 | #5B5449 | #B3AA99 |
| linha | #1E1C19 | #CFC5B0 |
| sombra | #1E1C19 | #3A362F |
| tracejado | #8A8273 | #6E675C |
| ocre | #E2A514 | #E8AE22 |
| sobreOcre | #1E1C19 | #161513 |
| ferrugem | #A43C1E | #E36A43 |
| verde | #2E6A3E | #74B585 |

Tokens extras por tela: `sobreCor` (#F5EEDF / #161513, definido em Arremates, não usado no markup); `painel` (#141311 / #0B0B0A), `led` (#F2B92B nos dois), `ledAlerta` (#FF6A3D nos dois) em Painel; `pontos` (#C9BEA5 / #3F3B34) em CriarLote; `falha` (rgba(164,60,30,.12) / rgba(227,106,67,.16)) em Auditoria.

**Tipografia (Google Fonts):** Big Shoulders Display (600/800/900) para títulos, números de lote, botões, abas, selos; IBM Plex Mono (400/500/600) para dados, rótulos em caixa-alta com `letter-spacing`, valores monetários, hashes; Newsreader (serif, 400/600/itálico) para texto corrido. Página: `lang="pt-BR"`.

**Valores literais não tokenizados (recorrentes):** selo da marca `#E2A514` com texto `#FFFFFF` (faixa "BRASIL", fonte 8px, letter-spacing .42em); no Painel `#8A8273` (rótulos de placar) e `#B3AA99` (nota do total) fixos, mesmo no escuro; larguras de borda 3px (padrão), 4px (divisor de título), 5px (card destaque Disponível, botão ocre), 6px (carimbo); sombras duras `4px/5px/6px/8px 4px 0 sombra` sem blur; `border-radius:0` em botões/inputs (exceto logo, 7px); tamanhos de fonte px literais; clamps do h1 `clamp(60px, 9vw, 132px)`; espaçamentos de container `padding:20px clamp(16px,4vw,56px) 64px`, `max-width:1320px` (Comprovante 1200px).

**Cabeçalho (todas):** logo "LANCE·AUTO" em placa (faixa ocre "BRASIL" + nome entre dois pontos; link p/ `Vitrine.dc.html`, `aria-label="LanceAuto, vitrine"`). Nav com `aria-current="page"` e sublinhado 3px no item ativo.
- Nav licitante (`aria-label="Principal"`): Vitrine · Carteira · Meus arremates.
- Nav leiloeiro (`aria-label="Leiloeiro"`): Meus lotes · Criar lote · Vitrine.
- Chip de identidade: pseudônimo + etiqueta ocre "VOCÊ" (licitante `C3E8`; leiloeiro `LEILOEIRO A01B`). Não há botão de login/logout/sair nem troca de papel em nenhuma das telas.
- Comprovante e Auditoria são públicas: cabeçalho só tem logo + legenda ("PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN" / "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN").

**Padrões visuais:** cards "papel" com borda 3px `linha` + sombra dura; linhas de tabela separadas por `2px dashed tracejado`; seções com título 40–48px + filete tracejado; selos/carimbos rotacionados (`rotate` de -8 a 4deg) com borda sólida/dupla/tracejada; "ingresso" (stub tracejado, picotes circulares).

**Animações (todas desligadas por `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`):** `la-vira` (flip rotateX 90→-12→0, .5s), `la-entra` (translateY -16px, .4s), `la-marca` (flash ocre rgba(226,165,20,.55)→0, 1.8s), `la-pulsa` (opacidade 1→.35, 0.7–1.2s), `la-bate` (carimbo: escala 2.6→.88→1.05→1, .6s com cubic-bezier(.2,.8,.3,1)).

**Persistência/rede:** nada. Tudo é estado local em memória + dados mock. Não há chamadas HTTP, nem WebSocket, nem timers de contagem reais.

---

## 1. Carteira (`Carteira.dc.html`)

**Propósito / usuário:** licitante vê saldo simulado, deposita dinheiro fictício e consulta o extrato. O saldo "Disponível" é o número que o botão "Dar lance" consulta (texto na tela).

**Estrutura (coluna única, gap 36px):**
1. Cabeçalho (logo + nav licitante + chip `C3E8 VOCÊ`; sem chip de saldo, diferente de Arremates).
2. Faixa de título: h1 "Carteira" (clamp 64–132px) + meta mono "LICITANTE C3E8 · QUI 22/OUT · 19:12" (data/hora fixas).
3. Equação do saldo (`section aria-label="Resumo do saldo"`, flex-wrap): [SALDO TOTAL] − [COMPROMETIDO] = [DISPONÍVEL PARA LANCES]; cada card `flex:1 1 240px`; operadores "−" e "=" 56px, `aria-hidden`. O card Disponível tem borda 5px (destaque), os outros 3px. Sombra 6px.
4. Linha inferior (flex-wrap, gap 36): coluna esquerda "Depositar" (`flex:1 1 360px; max-width:480px`) e direita "Extrato" (`flex:2 1 520px`). Em telas estreitas empilha.

**Card Depositar:** selo rotacionado (4deg, `ferrugem`, borda+outline) "Saldo simulado" no canto superior direito (aria-hidden). Cabeçalho "Depositar". Corpo: grupo de 3 botões de valor rápido (grid 3 colunas) com rótulo "R$" + "10 mil" / "50 mil" / "100 mil"; campo "OUTRO VALOR" (prefixo "R$", sufixo ",00", fonte mono 24px, `inputmode="numeric"`); botão ocre "Depositar R$ X,00"; parágrafo explicativo.

**Card Extrato:** cabeçalho "Extrato" + legenda "DEPÓSITOS · ARREMATES · ESTORNOS". Tabela (min-width 560px, scroll-x) com colunas QUANDO · MOVIMENTO · VALOR · SALDO TOTAL. Linha: tipo (Big Shoulders caixa-alta) + descrição (serif). Rodapé: "— fim do extrato · nada de juros, nada de tarifa —".

**Estados / variantes suportados pela lógica:**
- Tema claro/escuro (prop).
- Valor rápido selecionado (default 50.000): botão selecionado fica `ocre` com texto `sobreOcre` e sombra 4px; não selecionado: fundo `fundo`, sem sombra; `aria-pressed` "true"/"false". Ao digitar um valor no campo "Outro valor" (`valor !== null`) nenhum rápido aparece selecionado.
- Depositar com valor > 0: soma ao total; insere nova linha no topo do extrato (animações `la-entra` + `la-marca`), reinicia o campo para o valor rápido (`valor=null`), dispara o flip (`la-vira`) em Total e Disponível alternando dois `sc-if` (flipA/flipB) para reiniciar a animação (Disponível com delay .1s). Mini-relógio: minuto da linha nova começa em 13 (19:13) e incrementa a cada depósito (variável `min`; passa de 59 sem tratamento).
- Valor <= 0 ou não numérico: botão não faz nada (sem mensagem de erro, sem desabilitar); o rótulo do botão fica só "Depositar" (sem valor).
- Linhas de estorno mostram sub-rótulo "VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA".
- Não há: estado vazio de extrato, carregando, erro, paginação, limite máximo de depósito.

**Interações:** clique nos rápidos (`pick`), edição do campo (`onChange`, ou seja, só confirma ao sair do campo — não é onInput), clique em "Depositar". O texto digitado não é reformatado com ponto de milhar; só dígitos são aproveitados (`replace(/\D/g,'')`).

**Regras de negócio implícitas:**
- Disponível = Total − Comprometido (constante R$ 165.000,00, não muda com depósitos).
- Comprometido é o saldo travado onde o licitante lidera; "volta se alguém cobrir" (estorno).
- Total só cai em Arremate (lance vencedor encerrado); Estorno devolve ao Disponível sem alterar o Total. Total = depósitos − arremates.
- Dinheiro é fictício, depósito instantâneo, saque não existe, sem taxas/juros.
- Valores sempre inteiros em reais formatados `R$ 1.234,00` (milhar com ponto, centavos ",00" fixo).

**Textos literais de UI:** "LanceAuto, vitrine"; "Vitrine"; "Carteira"; "Meus arremates"; "C3E8"; "VOCÊ"; "Carteira"; "LICITANTE C3E8 · QUI 22/OUT · 19:12"; "SALDO TOTAL"; "Tudo que você depositou, menos o que já arrematou."; "COMPROMETIDO"; "R$ 165.000,00"; "Travado onde você lidera: Lote 019 · Hilux. Volta se alguém cobrir." (link "Lote 019 · Hilux" → Arremates); "DISPONÍVEL PARA LANCES"; "É este número que o botão “Dar lance” consulta."; "Saldo simulado"; "Depositar"; "Valores rápidos"; "R$"; "10 mil / 50 mil / 100 mil"; "OUTRO VALOR"; ",00"; "Depositar R$ 50.000,00"; "Nenhum banco foi incomodado. O dinheiro é de mentira, cai na hora e só vale aqui dentro. Saque não existe, assim como o carro."; "Extrato"; "DEPÓSITOS · ARREMATES · ESTORNOS"; "QUANDO / MOVIMENTO / VALOR / SALDO TOTAL"; "VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA"; "— fim do extrato · nada de juros, nada de tarifa —". Nova linha de depósito: tipo "Depósito", descrição "Saldo simulado, emoção real".

**Dados mock:** total inicial R$ 198.000,00; comprometido R$ 165.000,00; disponível R$ 33.000,00. Extrato (7 linhas, mais recente primeiro):
1. 22/out 19:00 Arremate "Lote 018 · Gol GTI 1996" − R$ 33.500,00 → 198.000,00
2. 22/out 18:49 Estorno "Superado no Lote 017 · Opala Diplomata" + R$ 52.500,00 → 231.500,00
3. 22/out 16:02 Depósito "Valor rápido" + R$ 100.000,00 → 231.500,00
4. 20/out 21:30 Depósito "Valor rápido" + R$ 50.000,00 → 131.500,00
5. 19/out 15:12 Arremate "Lote 011 · Fusca 1300 1972" − R$ 18.500,00 → 81.500,00
6. 19/out 14:40 Estorno "Superado no Lote 014 · Civic LXS" + R$ 46.000,00 → 100.000,00
7. 18/out 10:05 Depósito "Primeiro depósito. Bem-vindo ao pátio" + R$ 100.000,00 → 100.000,00
Aritmética do saldo total confere.

**Acessibilidade observada:** `section aria-label`, `aria-labelledby` nos cards, `th scope="col"`, `role="group"` + `aria-label="Valores rápidos"`, `aria-pressed`, `label` envolvendo o input, operadores e selo decorativos com `aria-hidden`, alvos >= 52–64px, reduced-motion. Faltas: não há feedback anunciado (aria-live) após depósito nem mensagem de valor inválido; o input não tem `id`/descrição do sufixo ",00".

**Inconsistências/extras:** Comprometido e link "Lote 019 · Hilux" fixos (não derivam da lista de arremates); texto só cita o Lote 019 mas o valor 165.000 = lance da Hilux. Prefixo "Estorno" nas linhas que representam lance superado com total "não muda" é uma regra de contabilidade implícita (travado -> disponível). Hora do mock (19:12) coerente com as demais telas (agora = 22/10/2026 19:12).

---

## 2. Meus arremates (`Arremates.dc.html`)

**Propósito / usuário:** licitante acompanha todos os lotes em que deu lance: em disputa (ganhando/superado), arrematados (vencidos) e perdidos. Atalhos para a sala, comprovante e auditoria.

**Estrutura (coluna única, gap 32):**
1. Cabeçalho: logo + nav licitante ("Meus arremates" ativo) + à direita dois chips: link "DISPONÍVEL R$ 33.000,00" (→ Carteira) e `C3E8 VOCÊ`.
2. Título: h1 "Meus arremates" (clamp 60–132) + subtítulo 19px; à direita grupo de abas-filtro (`role="group" aria-label="Filtrar por status"`).
3. Lista `<ul>` de cards-ingresso (gap 22px), sombra 6px. Cada card em flex-wrap: (a) stub 112px com "LOTE" + número 52px, separado por borda tracejada 3px; (b) bloco central (título 32px, selo de status rotacionado, meta mono, frase); (c) bloco de valores (2 pares rótulo/valor) + ações, com borda esquerda tracejada 2px. Em telas estreitas os blocos quebram em linhas.
4. Estado vazio (bloco com borda tracejada 3px).

**Abas / filtro:** Todos · Em disputa · Arremates (rótulo "Arrematados") · Perdidos, cada uma com contador mono de 2 dígitos (`padStart`). Aba ativa: fundo `tinta`, texto `fundo`, `aria-pressed="true"`; inativa transparente. Contagens no mock: Todos 06, Em disputa 02, Arrematados 02, Perdidos 02. "Em disputa" agrupa `ganhando` + `superado`.

**Variantes por status (selo / stub / ação):**
| status | selo (cor, borda, giro) | stub | ação |
|---|---|---|---|
| ganhando | "Ganhando", `verde`, solid, -3deg, ponto pulsante | fundo `suave` | link "Ir para a sala" (fundo `papel`) → `SalaGanhando.dc.html` |
| superado | "Superado", `ferrugem`, solid, 2deg, ponto pulsante | `suave` | link "Cobrir lance" (fundo `ocre`, destaque) → `Sala.dc.html` |
| arrematado | "Arrematado", `tinta`, **double**, -4deg | fundo `ocre`, texto `sobreOcre` | botão ocre "Ver comprovante" → `Comprovante.dc.html`; botão "Copiar link" → "Link copiado" por 2200ms; exibe o link `lanceauto.app/c/...` (quebra em qualquer ponto) |
| perdido | "Perdido", `tinta2`, **dashed**, 1deg | fundo `papel` | link mono "Conferir na auditoria" → `Auditoria.dc.html` |

Rótulos de valores variam: em disputa "SEU LANCE" + "POSIÇÃO" (ganhando, "1º de 4") ou "LANCE ATUAL" (superado); arrematado "ARREMATADO POR" + "LANCES"; perdido "SEU MAIOR LANCE" + "VENCEDOR". (Observação: o rótulo "ARREMATADO POR" mostra um valor em R$, não uma pessoa — ver inconsistências.)

**Estados:** filtro ativo (4); copiado (por lote, um único `copiado` global — copiar outro limpa o anterior); vazio (`itens.length === 0`); tema claro/escuro. Sem estado de carregando/erro. A cópia usa `navigator.clipboard.writeText('https://' + link)` em try/catch silencioso, e mostra "Link copiado" mesmo se a cópia falhar.

**Textos literais:** título "Meus arremates"; subtítulo "Tudo em que você levantou a mão. Inclusive o que não deu certo."; "DISPONÍVEL"; abas "Todos / Em disputa / Arrematados / Perdidos"; "LOTE"; "Ver comprovante"; "Copiar link"/"Link copiado"; "Ir para a sala"; "Cobrir lance"; "Conferir na auditoria"; vazio: "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora."; frases e metas listadas abaixo.

**Dados mock (ordem):**
1. 019 Hilux SRV 2.8 4x4 — "2018 · Diesel · FIPE R$ 189.400" — ganhando — "Ninguém cobriu ainda. Encerra às 19:28, faltam 16 minutos." — seu lance R$ 165.000,00, posição 1º de 4.
2. 024 Opala Comodoro 4.1 — "1979 · Gasolina · FIPE R$ 41.300" — superado — "Licitante B21C passou na frente às 19:09. Encerra às 19:40." — seu lance R$ 38.000,00, atual R$ 39.500,00.
3. 018 Gol GTI 2.0 — "1996 · Gasolina · FIPE R$ 31.200" — arrematado — "Martelo batido às 19:00 de hoje, depois de uma prorrogação." — R$ 33.500,00, 17 lances, `lanceauto.app/c/018-7Q2K`.
4. 017 Opala Diplomata 4.1 — "1988 · Gasolina · FIPE R$ 48.900" — perdido — "Licitante 7F3A levou por R$ 54.000,00. Seu saldo travado voltou." — seu maior R$ 52.500,00, vencedor R$ 54.000,00.
5. 011 Fusca 1300 — "1972 · Gasolina · FIPE R$ 23.600" — arrematado — "Arrematado em 19/out. Sem prorrogação, sem drama." — R$ 18.500,00, 8 lances, `lanceauto.app/c/011-B3MX`.
6. 014 Civic LXS 1.8 — "2012 · Flex · FIPE R$ 54.700" — perdido — "Licitante 7F3A levou por R$ 49.000,00. Foi por pouco. Não tão pouco." — seu maior R$ 46.000,00, vencedor R$ 49.000,00.

**Regras implícitas:** lance superado devolve o saldo travado; vencedor é debitado no martelo; lote tem prorrogação ("depois de uma prorrogação"); comprovante tem número público `NNN-XXXX` e link compartilhável; posição do licitante ("1º de 4" = 4 licitantes distintos).

**Acessibilidade:** `ul/li` semântico, `aria-pressed` nas abas, `aria-current` na nav, grupo rotulado, alvos >= 46px, ponto pulsante decorativo (sem `aria-hidden` explícito), status redundante em texto (não só cor). Faltam: `aria-live` para o "Link copiado"; botões "Copiar link"/links "Ver comprovante" não identificam o lote para leitores de tela (repetem nomes iguais).

**Inconsistências/extras:** (a) "Ver comprovante" aponta sempre para o mesmo `Comprovante.dc.html` (do lote 018), inclusive para o lote 011. (b) "Cobrir lance" leva a `Sala.dc.html` e "Ir para a sala" a `SalaGanhando.dc.html` (telas diferentes por estado). (c) Rótulo "ARREMATADO POR" ao lado de valor R$ está semanticamente trocado (deveria ser "Valor arrematado"). (d) Chip "DISPONÍVEL R$ 33.000,00" fixo, só nesta tela do licitante (Carteira não o mostra). (e) Hilux: lance R$ 165.000 contra FIPE R$ 189.400.

---

## 3. Comprovante de arremate (`Comprovante.dc.html`)

**Propósito / usuário:** página **pública** (sem login) com o recibo digital do arremate. Compartilhável pelo arrematante e conferível por qualquer pessoa. Sem dados pessoais (sem nome, CPF, e-mail, telefone), só pseudônimo.

**Estrutura:** container 1200px, gap 40. Cabeçalho (logo + "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN"). Dois blocos lado a lado (flex-wrap, `justify-content:center`, gap 48/64): 
- **Esquerda: recibo (`article aria-label="Comprovante de arremate do lote 018"`, `flex:0 1 540px`)**, girado -1deg com `drop-shadow(8px 8px 0 sombra)`. Cinco faixas sobrepostas: (1) cabeçalho centralizado "LANCEAUTO" / "CASA DE LEILÕES · PÁTIO VIRTUAL" / linha "================================" / h1 "Comprovante de arremate" / "Nº 018-7Q2K"; (2) picote (24px, linha tracejada e dois semicírculos que simulam o recorte); (3) corpo: lista `<dl>` de 7 linhas (pontilhada) + "VALOR ARREMATADO" R$ 33.500,00 (clamp 36–52px) + carimbo "Arrematado" (ferrugem, rotação -8deg, animado `la-bate` com delay .3s, posição absoluta direita/baixo); (4) segundo picote; (5) rodapé: "HASH FINAL DO HISTÓRICO · SHA-256", hash em `<code>` (caixa tracejada), código de barras decorativo, link "Verificar na auditoria →", legenda "- - - - - - - destaque aqui - - - - - - -".
- **Direita: `aside` (300–420px):** h2 "Papel que se defende sozinho."; parágrafo; botões "Copiar link" (ocre) e "Auditar lote" (link papel); link em `<code>` `lanceauto.app/c/018-7Q2K`; lista numerada de 3 passos.

**Linhas do recibo (dl):** LOTE 018 · CARRO Volkswagen Gol GTI 2.0 · ANO · COMB. 1996 · Gasolina · REF. FIPE R$ 31.200,00 · LANCES 17 (1 prorrogação) · MARTELO 22/10/2026 19:00:49 · ARREMATANTE Licitante C3E8.

**Hash:** `9f2c41d07ab36e58c1f0e2d94b7a6c3851e09fd2a4c7be16f3d58a20c947e81a` (64 hex = SHA-256), quebrado em duas metades de 32 com `<wbr>`. Código de barras: 44 barras geradas dos 44 primeiros caracteres do hash; largura = 1 + (n % 4) px; cor `tinta` se índice par **ou** dígito > 9, senão transparente. Puramente decorativo (`aria-hidden`).

**Estados:** tema claro/escuro (`ComprovanteEscuro`); botão copiar "Copiar link" → "Link copiado" (2200ms; copia `https://lanceauto.app/c/018-7Q2K`, try/catch silencioso). Apenas lote 018 (nada paramétrico); sem estado de erro/inexistente/carregando, sem variante "adulterado" (essa fica na Auditoria).

**Textos literais:** "PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN"; "LANCEAUTO"; "CASA DE LEILÕES · PÁTIO VIRTUAL"; "Comprovante de arremate"; "Nº 018-7Q2K"; "VALOR ARREMATADO"; "Arrematado" (carimbo, aria-label "Carimbo: arrematado"); "HASH FINAL DO HISTÓRICO · SHA-256"; "Verificar na auditoria →"; "- - - - - - - destaque aqui - - - - - - -"; "Papel que se defende sozinho."; "Este recibo não tem nome, CPF, e-mail nem telefone. Tem o pseudônimo de quem arrematou, o valor e o hash que amarra os 17 lances do lote. Mude uma vírgula no histórico e o hash deixa de bater."; "Copiar link"; "Link copiado"; "Auditar lote"; passos: "1. Abra a auditoria do lote 018." / "2. Compare o hash da última linha com o deste papel." / "3. Bateu? Ninguém mexeu em nada depois do martelo."

**Regras implícitas:** hash final = hash do último lance da cadeia (encadeada); comprovante é público e identificado por `Nº {lote}-{código 4 chars}`; privacidade por pseudônimo; "ref. FIPE" fica gravada; número de lances inclui prorrogações (anota quantas).

**Acessibilidade:** `article` com aria-label, `dl/dt/dd`, carimbo com aria-label, decorativos `aria-hidden`, reduced-motion. O recibo é girado -1deg (pode afetar legibilidade/zoom, não é problema de leitor de tela). Link "Verificar na auditoria →" usa seta no texto.

**Inconsistências/extras:** o rodapé tracejado "destaque aqui" sugere impressão/recorte, mas não há botão de imprimir/baixar PDF. Botão "Auditar lote" e link "Verificar na auditoria" são duplicados. Hash do mock aqui bate com o `FINAL` da Auditoria.

---

## 4. Painel do pátio (`Painel.dc.html`)

**Propósito / usuário:** **leiloeiro** (`LEILOEIRO A01B`) monitora seus lotes (ao vivo, agendados, encerrados), vê quanto já recebeu e cancela lotes ainda sem lance.

**Estrutura (coluna, gap 36):**
1. Cabeçalho (logo + nav leiloeiro com "Meus lotes" ativo + chip `LEILOEIRO A01B VOCÊ`).
2. Título: h1 "Painel do pátio" + subtítulo "Seus lotes, quem está brigando por eles e quanto já entrou." + CTA ocre grande "Criar lote" (ícone "+" SVG 20px, sombra 6px, min-height 60) → `CriarLote.dc.html`.
3. Resumo (`section aria-label="Resumo"`, flex-wrap, gap 16): card largo (`flex:2 1 340px`) "TOTAL RECEBIDO · 3 ARREMATES" com valor estilo display LED; 3 cards de placar (`flex:1 1 150px`). Fundo dos cards = `painel` (escuro quase preto) com borda `linha` e sombra 6px. **Efeito LED:** camada fantasma "R$ 888.888,88"/"88" a `opacity:.1` (segmentos apagados) + valor real sobreposto em `position:absolute`, cor `led` (#F2B92B); placar "AO VIVO" usa `ledAlerta` (#FF6A3D).
4. Seção "Ao vivo" (ponto ferrugem pulsante, filete tracejado, nota à direita "Lote com lance não se cancela. Regra da casa."): tabela (min-width 760, scroll-x) colunas LOTE · CARRO · LANCE ATUAL · LANCES · RESTAM · AÇÃO. LOTE em Big Shoulders 30px; CARRO título 21px caixa-alta + meta mono 12px; RESTAM em pílula LED (fantasma "88:88", fundo `painel`, cor `led`).
5. Seção "Agendados": mesma tabela com LANCE INICIAL, LANCES (sempre "00"), ABRE · FECHA, AÇÃO.
6. Seção "Encerrados": grid de cards `repeat(auto-fill, minmax(min(100%,290px),1fr))`, gap 20: número 38px + título, meta, filete, valor 22px, observação, link "Auditoria do lote" (→ Auditoria), selo rotacionado no canto superior direito.

**Estados/variantes:**
- Linha ao vivo **com lances** (`!vazio`): célula de ação mostra "Com lances · fica" (sem botão). **Sem lances** (`vazio:true`): botão "Cancelar" (borda e texto `ferrugem`, transparente).
- Agendados: sempre botão "Cancelar" (lote agendado não tem lances).
- Encerrados: selo "Arrematado" (`tinta`, solid, giros -6/4/-3deg) ou "Sem lances" (`tinta2`, dashed, 3deg); valor mostra "Fechado sem lances" quando não houve lance.
- Tema escuro: `PainelEscuro` (painel LED fica #0B0B0A).
- O botão "Cancelar" **não tem handler** (sem onClick, sem confirmação, sem estado de lote cancelado) — só visual. Não há estado vazio das seções, carregando ou erro. Contagem regressiva `RESTAM` é texto estático (não corre).

**Regras de negócio:** lote com pelo menos um lance não pode ser cancelado ("Regra da casa"); lote sem lances (vivo ou agendado) pode; "Total recebido" soma os arremates encerrados (33.500 + 54.000 + 49.000 = 136.500, confere); "Saldo simulado" também para o leiloeiro; observação de cada encerrado compara o preço final com a FIPE em % (acima/abaixo); lote fechado sem lances registra "lance inicial".

**Textos literais:** "Meus lotes"; "Criar lote"; "Vitrine"; "LEILOEIRO A01B"; "Painel do pátio"; "Seus lotes, quem está brigando por eles e quanto já entrou."; "TOTAL RECEBIDO · 3 ARREMATES"; "R$ 136.500,00"; "Saldo simulado. O pátio agradece mesmo assim."; "AO VIVO 03" / "AGENDADOS 02" / "ENCERRADOS 04"; "Ao vivo"; "Lote com lance não se cancela. Regra da casa."; cabeçalhos de tabela (acima); "Cancelar"; "Com lances · fica"; "Agendados"; "Encerrados"; "Auditoria do lote"; selos "Arrematado"/"Sem lances".

**Dados mock:**
- Ao vivo: 019 Hilux SRV 2.8 4x4 (2018 · Diesel · FIPE R$ 189.400) R$ 165.000,00, 12 lances, 16:12; 024 Opala Comodoro 4.1 (1979 · Gasolina · FIPE R$ 41.300) R$ 39.500,00, 15 lances, 28:04; 023 Uno Mille Way 1.0 (2010 · Flex · FIPE R$ 19.800) R$ 12.000,00, "00" lances, 47:30 (cancelável).
- Agendados: 020 Fusca 1300 (1974 · Gasolina · FIPE R$ 24.800) R$ 15.000,00, "Sáb 24/out 14:00 → 15:00"; 021 Corolla XEi 2.0 (2015 · Flex · FIPE R$ 76.300) R$ 58.000,00, "Dom 25/out 10:00 → 11:30".
- Encerrados: 018 Gol GTI 2.0 ("1996 · 17 lances · 1 prorrogação", R$ 33.500,00, "Licitante C3E8 levou. 7% acima da FIPE, e ainda dizem que ninguém liga para Gol quadrado."); 017 Opala Diplomata ("1988 · 26 lances", R$ 54.000,00, "Licitante 7F3A levou. 10% acima da FIPE."); 014 Civic LXS 1.8 ("2012 · 19 lances", R$ 49.000,00, "Licitante 7F3A levou. 10% abaixo da FIPE."); 016 Santana CL 1.8 ("1991 · 0 lances", "Fechado sem lances", "Lance inicial de R$ 12.000,00. Talvez na próxima, talvez nunca.").

**Acessibilidade:** `section aria-labelledby`, `th scope="col"`, `aria-current`, camada LED fantasma `aria-hidden` (leitor lê só o valor real), ponto pulsante decorativo, alvos >= 44px. Botões "Cancelar" não identificam o lote (aria-label ausente); contraste dos rótulos `#8A8273` sobre `painel` não verificado; tabela rola horizontalmente em mobile.

**Inconsistências/extras:** placar "ENCERRADOS 04" mas o card de encerrados do lote 016 não tem link de auditoria relevante (há link mesmo sem lances); todos os links "Auditoria do lote" apontam para a auditoria do 018. Lote 021 (Corolla, R$ 58.000, 25/out 10:00→11:30) coincide exatamente com os valores pré-preenchidos do formulário de "Novo lote 025". Painel não mostra o lote 022. Token `ledAlerta` só é usado no "AO VIVO"; o tempo restante baixo não usa alerta. Rótulos `#8A8273`/`#B3AA99` literais não acompanham o tema.

---

## 5. Criar lote (`CriarLote.dc.html`)

**Propósito / usuário:** **leiloeiro** cadastra e agenda um novo lote (nº 025), escolhendo o carro na Tabela FIPE, imagem e regras do leilão, com prévia ao vivo de como aparece na Vitrine.

**Estrutura:** cabeçalho (nav leiloeiro, "Criar lote" ativo). Título: migalha mono "PAINEL / CRIAR LOTE", h1 "Novo lote 025" (025 em `tinta2`) + texto "Escolha o carro na Tabela FIPE, ajuste as regras e solte no pátio." Corpo em duas colunas (flex-wrap, gap 36): 
- **Coluna do formulário (`flex:1 1 560px`)** com 3 seções-card numeradas (sombra 6px): **01 O carro**, **02 A imagem**, **03 As regras**.
- **Coluna lateral `aside` (`flex:1 1 380px; max-width:480px`):** rótulo "ASSIM ELE APARECE NA VITRINE", cartão de prévia, crédito da imagem, botão principal e link de voltar. Em telas estreitas a prévia desce para baixo do formulário (não é sticky).

**Seção 01 O carro:** indicador de status da FIPE no cabeçalho do card (ponto + texto mono). Três `select` em grid auto-fit (min 170px): "1 · MARCA", "2 · MODELO", "3 · ANO / COMBUSTÍVEL". Caixa de referência (borda tracejada, `fundo`): "REFERÊNCIA FIPE · OUT/2026" + preço em R$ (24px) + descrição "Marca · Modelo · Ano · Combustível". Cascata: trocar marca reseta modelo para o 1º da marca e ano para o 1º do modelo; trocar modelo reseta ano.

**Seção 02 A imagem:** campo "URL DA IMAGEM · SUGERIDA AUTOMATICAMENTE" (`type="url"`, mono 15px), campo "CRÉDITO DA IMAGEM" (texto), checkbox 24px (`accent-color: ocre`) "Sem foto. Usar a ilustração padrão do pátio." Marcar o checkbox desabilita o campo URL (opacidade .5).

**Seção 03 As regras:** grid auto-fit (min 230px): "TÍTULO DO LOTE" (largura total), "LANCE INICIAL · R$" e "INCREMENTO MÍNIMO · R$" (`inputmode=numeric`, mono 20px/600), "INÍCIO" e "FIM" (`datetime-local`, `color-scheme` claro/escuro conforme o tema), nota "Lance nos 2 minutos finais estica o fim em +2 min. Depois do primeiro lance, o lote não pode mais ser cancelado."

**Prévia (aside):** placa ocre do lote "025" pendurada no canto com fio (SVG) e inclinada -4deg; cartão com área de imagem de 220px (fundo pontilhado `pontos` sobre `suave` para foto; grade `suave` para ilustração padrão) com silhueta SVG do carro (4 modelos: sedan, hatch, fusca, picape, conforme o modelo) e selo canto superior direito; título (modelo, 30px), meta ("{ano} · {combustível} · FIPE R$ {valor}"), filete, "LANCE INICIAL R$ {inicial},00" e caixa "ABERTURA / Dom 25/out / 10:00". Embaixo "Imagem: {crédito}".

**Ação:** botão grande "Agendar lote 025", nota abaixo, link "Voltar ao painel sem salvar" (→ Painel). O botão **não tem handler** (sem submit, sem validação, sem confirmação, sem feedback de sucesso). Não há `<form>`.

**Estados e variantes:**
1. **Normal (FIPE conectada):** indicador "TABELA FIPE CONECTADA" (`verde`, sem animação); selects ativos; referência FIPE visível; prévia mostra silhueta e meta; selo da prévia "FOTO SUGERIDA"; botão ocre com sombra 6px; nota "Ele aparece em “Agendados” na hora e abre sozinho no horário marcado."
2. **Sem foto marcado:** selo "ILUSTRAÇÃO PADRÃO"; fundo da prévia com grade (linhas `suave` 1px, 16px), carro com corpo `papel` e traço 2.5; URL desabilitada.
3. **FIPE fora do ar (prop `erroApi`, estado `erro`; `CriarLoteErro` é essa variante no escuro):** indicador "FIPE FORA DO AR" (`ferrugem`, pulsando 1.2s); banner `role="alert"` (borda tracejada 3px `ferrugem`, ícone de janela com X, título "A tabela FIPE não respondeu.", texto "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou.", botão "Tentar de novo"); selects desabilitados com valor vazio, borda `tracejado`, opacidade .5; caixa de referência oculta; prévia sem silhueta: "Sem carro escolhido.<br>A FIPE está de folga."; selo "AGUARDANDO FIPE"; título da prévia "Carro a definir"; meta "— · — · FIPE —"; botão **desabilitado** visualmente (fundo `suave`, texto `tinta2`, borda dashed, sem sombra) com nota "Sem marca, modelo e ano não tem lote. O resto já está guardado." Os demais campos (imagem, regras) permanecem editáveis e preservados.
4. **Consultando (clicou em "Tentar de novo"):** botão vira "Consultando…" e fica inerte; indicador "CONSULTANDO A FIPE…" (`tinta2`, pulsa .8s); após 1500ms (timer simulado) o erro some e o formulário volta ao normal (a nova consulta sempre "dá certo" no mock). Marca/modelo/ano retomam o último valor no estado.
5. Tema claro/escuro.
- **Não implementado na lógica, apesar de esperado:** validação de campos (lance inicial, incremento, datas, título obrigatório), mensagens de erro por campo, estado de submissão/sucesso, FIPE "carregando" inicial. O único "erro" modelado é a FIPE.

**Interações:** selects de marca/modelo/ano (cascata), edição de campos via `onChange` (o handler lê `e.target.name`), toggle "Sem foto", "Tentar de novo". Valores numéricos são texto livre com máscara manual (ex. "58.000"); a prévia mostra `R$ {inicial},00` literal do que foi digitado.

**Regras de negócio implícitas:** o carro (marca/modelo/ano-combustível) vem exclusivamente da FIPE e é obrigatório; a referência FIPE (out/2026) é gravada com o lote; imagem sugerida automaticamente a partir do carro, com crédito/licença obrigatória na UI (placeholder literal `[AUTOR E LICENÇA]`), podendo ser trocada por ilustração padrão; lance inicial e incremento mínimo em reais inteiros; lote com janela início/fim; anti-sniping: lance nos 2 minutos finais estica o fim +2 min; lote agendado entra em "Agendados" imediatamente e abre sozinho no horário; lote com primeiro lance não pode ser cancelado; numeração sequencial (025).

**Textos literais de UI:** "PAINEL / CRIAR LOTE"; "Novo lote 025"; "Escolha o carro na Tabela FIPE, ajuste as regras e solte no pátio."; "01 O carro"; "02 A imagem"; "03 As regras"; "1 · MARCA / 2 · MODELO / 3 · ANO / COMBUSTÍVEL"; "REFERÊNCIA FIPE · OUT/2026"; "URL DA IMAGEM · SUGERIDA AUTOMATICAMENTE"; "CRÉDITO DA IMAGEM"; "Sem foto. Usar a ilustração padrão do pátio."; "TÍTULO DO LOTE"; "LANCE INICIAL · R$"; "INCREMENTO MÍNIMO · R$"; "INÍCIO"; "FIM"; nota das regras (acima); "ASSIM ELE APARECE NA VITRINE"; "Prévia do carro" (aria-label do SVG); "LANCE INICIAL"; "ABERTURA"; "Dom 25/out"; "10:00"; "Imagem: …"; "Agendar lote 025"; "Voltar ao painel sem salvar"; mensagens de erro/estado acima.

**Dados mock:** valores iniciais: Toyota · Corolla XEi 2.0 · 2015; URL `https://imagens.exemplo.com.br/fipe/corolla-xei-2015.jpg`; crédito "Foto sugerida pela busca · [AUTOR E LICENÇA]"; título "Corolla XEi 2.0 · único dono, revisões em dia"; inicial 58.000; incremento 1.000; início 2026-10-25T10:00; fim 2026-10-25T11:30. Catálogo FIPE mock (marca → modelo [silhueta] → ano/combustível/preço):
- Chevrolet: Opala Diplomata 4.1 [sedan] (1988 Gasolina 48.900; 1990 Gasolina 53.200; 1992 Gasolina 61.800); Opala Comodoro 4.1 [sedan] (1979 41.300; 1985 44.700); Chevette SL 1.6 [sedan] (1987 Gasolina 16.900; 1990 Álcool 15.400).
- Fiat: Uno Mille Way 1.0 [hatch] (2010 Flex 19.800; 2012 Flex 22.300); Uno Mille Fire 1.0 [hatch] (2004 Gasolina 14.200; 2006 Flex 15.900).
- Honda: Civic LXS 1.8 [sedan] (2012 Flex 54.700; 2013 Flex 58.100); Civic EXR 2.0 [sedan] (2014 Flex 67.800; 2016 Flex 79.400).
- Toyota: Corolla XEi 2.0 [sedan] (2014 Flex 71.900; 2015 Flex 76.300; 2016 Flex 82.100); Hilux SRV 2.8 4x4 [picape] (2017 Diesel 176.500; 2018 Diesel 189.400).
- Volkswagen: Gol GTI 2.0 [hatch] (1995 Gasolina 29.400; 1996 Gasolina 31.200); Fusca 1300 [fusca] (1972 Gasolina 23.600; 1974 Gasolina 24.800); Santana CL 1.8 [sedan] (1991 Gasolina 17.900).

**Acessibilidade:** `section aria-labelledby`, todos os campos com `<label>` envolvente, `role="alert"` no erro de FIPE, SVG da prévia com `role="img"` + aria-label, ícones decorativos `aria-hidden`, checkbox 24px com área clicável >= 44px, `color-scheme` nos datetime. Faltas: sem `required`/`aria-invalid`/mensagens por campo; o status da FIPE não é `aria-live`; botão desabilitado usa `disabled` real (bom) mas mantém cursor pointer; `select` com valor vazio no erro sem opção placeholder.

**Inconsistências/extras:** prévia "ABERTURA Dom 25/out 10:00" é fixa e não acompanha os campos Início/Fim; número do lote "025" fixo no título, placa e botão; título da prévia usa o modelo (não o campo "Título do lote"); ano e preço FIPE mudam com selects mas o campo "Lance inicial" não é validado contra a FIPE; o preview usa silhueta SVG e não a foto real do URL; exemplo duplica o Lote 021 do Painel; o texto "sugerida automaticamente" implica busca de imagem que não aparece na UI (nenhum botão/estado de busca ou de falha de busca da imagem).

---

## 6. Auditoria do lote 018 (`Auditoria.dc.html`)

**Propósito / usuário:** página **pública** (sem login) para qualquer pessoa verificar a integridade do histórico de lances de um lote encerrado: lista todos os lances com hash encadeado e mostra veredito Íntegro/Adulterado.

**Estrutura (coluna, gap 36):**
1. Cabeçalho (logo + "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN").
2. Faixa-herói (border-bottom 4px, flex-wrap): à esquerda placa do lote "018" (64px, inclinada -4deg, fio SVG), rótulo "AUDITORIA DO HISTÓRICO", h1 "Gol GTI 2.0 1996" (ano em `tinta2`) e linha mono "Arrematado por Licitante C3E8 · R$ 33.500,00 · 22/10/2026 19:00:49"; à direita bloco `aria-live="polite"` com o veredito (carimbo) + frase + botão "Verificar de novo".
3. Duas colunas (flex-wrap, gap 36): **tabela "Histórico completo"** (`flex:2 1 640px`) e `aside` "Como a gente confere" (`flex:1 1 320px`).

**Tabela:** cabeçalho com título 40px, filete e "17 LANCES · DO PRIMEIRO AO MARTELO". Tabela (min-width 780, scroll-x, sombra 6px, `<caption>` visualmente oculto "Histórico de lances do lote 018 com hash de cada linha"). Colunas Nº · LICITANTE · VALOR · HORÁRIO · HASH · CONFERE?. Cada linha: Nº com 2 dígitos e borda esquerda 6px (cor da falha); "Licitante XXXX"; valor; hora; hash abreviado `6 primeiros…4 últimos` com botão "ver inteiro"/"recolher" (`aria-expanded`); status. Rodapé: "Hash final esperado pelo comprovante: 9f2c…e81a" + link "Ver comprovante do lote" (→ Comprovante).

**Aside:** h2 "Como a gente confere"; parágrafo explicando a corrente; diagrama de 3 elos (caixas com nº, dado e hash ligadas por barras de 3px; `aria-hidden`) + "… até o martelo"; lista numerada de 3 passos; nota final.

**Estados / variantes:**
- **Íntegro (default):** carimbo "Íntegro" verde; frase "17 de 17 lances conferem e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo."; todas as linhas "CONFERE" (verde); diagrama mostra elos 01–03 em `linha` com hashes verdes (b7e2…41a0, 0c9d…f31e, 58aa…2b07).
- **Adulterado (`veredito="adulterado"`, variante `AuditoriaAdulterado`):** carimbo "Adulterado" (`ferrugem`); frase "8 de 17 lances conferem. A corrente quebra na linha 09, e o hash final não bate com o comprovante."; aparece banner `role="alert"` acima da tabela (borda `ferrugem`, ícone triângulo): "**Linha 09:** o lance gravado (R$ 27.500,00) não gera o hash guardado para ele, que corresponde a R$ 25.700,00. Alguém mexeu no valor depois do fato, e todos os elos seguintes herdam o problema."; linha 09 (índice 8): fundo `falha`, borda esquerda `ferrugem`, status "NÃO CONFERE"; linhas 10–17: status "ELO QUEBRADO" (`ferrugem`), `opacity:.62`; diagrama mostra elos 08 (ok, verde), 09 (ferrugem: "esperado 5d0e…, achou 77f1…") e 10 ("herda o erro").
- **Verificando** (clicar "Verificar de novo", 1400ms; ignorado se já verificando): carimbo e frase somem (e o banner de falha); aparece "Refazendo a conta, elo por elo…" com ponto ocre pulsante (.7s); todos os status viram "…" (`tinta2`); depois volta ao veredito (sempre o mesmo, é simulação).
- Linha **expandida** por linha (mapa `abertos`): hash completo de 64 caracteres (quebra em qualquer ponto), botão "recolher"; `aria-expanded` "true".
- Tema claro/escuro.
- Não há estado de lote inexistente, erro de rede ou hash final divergente isolado.

**Lógica de verificação (simulada):** hashes de linha gerados por `hex(seed)` (xorshift pseudo-aleatório, não é SHA-256 real); a última linha usa o `FINAL` do comprovante. Falha fixa na linha de índice 8 (09). A página não calcula nada de verdade.

**Textos literais:** "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN"; "LOTE 018"; "AUDITORIA DO HISTÓRICO"; "Gol GTI 2.0 1996"; "Arrematado por Licitante C3E8 · R$ 33.500,00 · 22/10/2026 19:00:49"; "Íntegro"/"Adulterado"; frases acima; "Refazendo a conta, elo por elo…"; "Verificar de novo"; "Histórico completo"; "17 LANCES · DO PRIMEIRO AO MARTELO"; colunas; "ver inteiro"/"recolher"; "CONFERE"/"NÃO CONFERE"/"ELO QUEBRADO"/"…"; "Hash final esperado pelo comprovante: 9f2c…e81a"; "Ver comprovante do lote"; "Como a gente confere"; "Cada lance vira um carimbo digital, o hash. Esse carimbo é feito com os dados do lance e com o carimbo do lance anterior. Fica uma corrente: mexa num elo e todos os de baixo deixam de bater."; "… até o martelo"; passos: "1. Refazemos o hash de cada linha com os dados que estão na tabela." / "2. Comparamos com o hash guardado na hora do lance." / "3. Tudo bate e o último é igual ao do comprovante? Íntegro. Qualquer diferença? Adulterado, e mostramos onde."; "Você não precisa confiar na gente. Precisa só de uma calculadora de SHA-256 e paciência."

**Dados mock (17 lances, horário · licitante · valor):** 18:12:40 04DE 22.000 · 18:14:02 7F3A 22.500 · 18:16:55 B21C 23.000 · 18:19:21 C3E8 24.000 · 18:21:04 04DE 24.500 · 18:24:37 7F3A 25.500 · 18:27:12 C3E8 26.000 · 18:29:50 04DE 26.500 · 18:31:18 B21C 27.500 · 18:33:41 C3E8 28.000 · 18:36:12 9A6F 29.000 · 18:38:47 B21C 29.500 · 18:40:33 C3E8 30.000 · 18:42:10 9A6F 30.500 · 18:57:02 C3E8 31.000 · 18:58:11 9A6F 32.000 · 18:58:49 C3E8 33.500 (todos em R$ ,00). Hash final `9f2c41d07ab36e58c1f0e2d94b7a6c3851e09fd2a4c7be16f3d58a20c947e81a`.

**Regras implícitas:** hash de cada lance = f(dados do lance + hash anterior) (encadeamento, "blockchain-like"); verificação reconstrói todos os hashes e compara com o armazenado e o último com o do comprovante; incremento mínimo variável (500–1.000); prorrogação (último lance 18:58:49 com martelo 19:00:49, +2 min); adulteração invalida a linha alterada e todas as seguintes; páginas de auditoria e comprovante são públicas e mostram apenas pseudônimos.

**Acessibilidade:** `aria-live="polite"` no veredito, `role="status"` no carimbo, `role="alert"` no banner de falha, `caption` oculto, `th scope="col"`, botão de expandir com `aria-expanded` (sem `aria-controls`), diagrama `aria-hidden`, status por texto além de cor, reduced-motion. Linhas "ELO QUEBRADO" a 62% de opacidade podem reduzir contraste.

**Inconsistências/extras:** (a) no modo adulterado a linha 17 continua exibindo o hash `FINAL` (igual ao do comprovante) apesar de a frase dizer que "o hash final não bate com o comprovante". (b) O banner cita "R$ 25.700,00" como valor original da linha 09, que não aparece em outro lugar. (c) Mock com lance de 18:42:10 e próximo às 18:57:02 (lacuna de ~15 min) e janela de prorrogação coerente com o martelo 19:00:49. (d) Mesma auditoria do 018 é o destino de todos os links (Painel, Arremates "Conferir na auditoria" de lotes perdidos 017/014). (e) Cabeçalho do lote é fixo (não paramétrico). (f) "Verificar de novo" sempre retorna o mesmo resultado (animação pura).

---

## Resumo de inconsistências transversais

- Todas as telas são protótipos de interface estáticos: sem navegação real entre papéis, sem login/logout, sem relógio em tempo real, sem integração.
- Dados cruzados coerentes: saldo 198.000/comprometido 165.000/disponível 33.000 (Carteira, Arremates); lance 019 R$ 165.000 (Carteira, Arremates, Painel); lote 018: 17 lances, R$ 33.500, 19:00:49, hash 9f2c…e81a (Arremates, Painel, Comprovante, Auditoria, Carteira).
- Funcionalidades visíveis sem lógica: botões "Cancelar" (Painel), "Agendar lote 025" (CriarLote), validações de formulário, depósito sem erro de valor inválido, impressão/baixar do comprovante.
