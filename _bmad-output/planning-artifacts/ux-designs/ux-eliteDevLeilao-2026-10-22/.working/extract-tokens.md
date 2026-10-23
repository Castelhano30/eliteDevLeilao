# Extração de tokens e estados — LanceAuto "Manual de pátio" (Rev. 03 · Out/2026)

Fonte: `_bmad-output/planning-artifacts/design/project/` (`canvas.json`, `Main.dc.html`, wrappers). Valores copiados literalmente. O que o manual NÃO define está marcado como "não definido no manual".

## 1. Tokens

### 1.1 Cores (máx. 5 cores, tokens nos dois temas)

Tema claro `[data-tema="claro"]` — "De dia · papel"

| Nome | Token | Hex | Uso (literal) |
|---|---|---|---|
| Papel | `--papel` | `#F5EEDF` | Cartões, recibos, campos. |
| Grafite | `--tinta` | `#1E1C19` | Texto, bordas, sombras. |
| Ocre | `--acao` | `#E2A514` | Ação. Só ela pede clique. |
| Ferrugem | `--alerta` | `#A43C1E` | Superado, tempo acabando, adulterado. |
| Verde | `--ok` | `#2E6A3E` | Ganhando e íntegro. Mais nada. |

- Fundo da página `--fundo #E8DFCB`, superfícies em `--papel`. Texto secundário `--tinta-2 #5B5449`.

Tema noite `[data-tema="escuro"]` — "À noite · carvão"

| Nome | Token | Hex | Uso |
|---|---|---|---|
| Carvão | `--papel` | `#262420` | Superfícies à noite. |
| Giz | `--tinta` | `#ECE4D2` | Texto e bordas. |
| Ocre | `--acao` | `#E8AE22` | A mesma ação, um ponto mais acesa. |
| Ferrugem | `--alerta` | `#E36A43` | Clareada para ler no escuro. |
| Verde | `--ok` | `#74B585` | Ganhando e íntegro. |

- Fundo `--fundo #161513`. "O ocre não muda de turno: continua sendo a única cor que pede clique."
- Texto secundário no escuro usado no manual: `#B3AA99`. Borda do cartão noite `#CFC5B0`, sombra do cartão noite `#3A362F`.

Cores auxiliares usadas literalmente no manual (sem token nomeado):
- `#8A8273` — tracejados, rótulos discretos ("RESTAM"/"PRORROGADO"), borda de recibo.
- `#DDD3BC` — fundo de botão desabilitado (claro).
- `#141311` — fundo do display do cronômetro (fixo nos dois temas).
- `#F2B92B` — dígitos do cronômetro em tempo normal e prorrogado.
- `#FF6A3D` — dígitos/rótulo do cronômetro nos últimos 2 min.
- `#FFFFFF` — texto "BRASIL" da faixa da placa.
- `#5B5449` — `--tinta-2` (claro).

Não definido no manual: `--tinta-2` do tema noite como token (só aparece `#B3AA99` como texto secundário no cartão noite).

### 1.2 Tipografia (3 famílias)

Google Fonts: `Big Shoulders Display` (600;800;900), `IBM Plex Mono` (400;500;600), `Newsreader` (ital, opsz 6..72, 400;600; itálico 400).

| Papel | Família | Pesos | Regra literal |
|---|---|---|---|
| Cartaz | `'Big Shoulders Display', sans-serif` | 800–900 | "Títulos, números de seção, botões e carimbos. Sempre caixa-alta, entrelinha apertada." |
| Texto | `'Newsreader', Georgia, serif` | 400 / 600 / itálico | corpo e descrições |
| Recibo | `'IBM Plex Mono', monospace` | 400–600 | "Lote, R$, cronômetro, pseudônimo e hash. Tudo que alguém pode querer conferir depois." |

Escala usada no manual (tamanho / peso / line-height / tracking):
- h1 do manual: Big Shoulders 900, 150px, lh .82, uppercase, ls -.01em.
- h2 de seção: Big Shoulders 900, 56px, lh 1, uppercase.
- h3 de cartão: Big Shoulders 800, 32px, uppercase.
- Logo "LANCE·AUTO": Big Shoulders 800, 56px, lh 1, ls .1em.
- Exemplo de cartaz: 900, 72px, lh .88, uppercase.
- Nome da amostra de cor: 800, 20px, lh 1, uppercase.
- Botão primário: 900, 22px, ls .04em, uppercase. Botão secundário/desabilitado: 800, 20px, ls .04em, uppercase.
- Carimbo: 900, 26px, ls .08em, uppercase, lh 1.
- Placar de posição: 900, 30px, uppercase, lh 1; contador "1º de 5": Plex Mono 13px.
- Etiqueta de lote: número 900, 52px, lh .9; rótulo "LOTE" Plex Mono 11px, ls .14em.
- Selo "+2 MIN": 900, 18px.
- Newsreader: lead 21px lh 1.4; parágrafo de exemplo 22px lh 1.45; notas 15px (cor `--tinta-2`); descrição de amostra 13px lh 1.3.
- Plex Mono: número de seção 14px; "Rev." 13px ls .12em uppercase; códigos 11–12px; recibo 17px lh 1.7; faixa BRASIL 12px peso 600 ls .5em lh 1; chips de licitante 14px.
- Cronômetro: Plex Mono 600, 40px, lh 1; rótulo 10px, ls .16em.
- Tamanhos observados: 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 22, 26, 30, 32, 40, 52, 56, 72, 150 px.

### 1.3 Raios
- Logo/placa: `border-radius:10px` externo; placa interna `0 0 6px 6px`.
- Cartões e botões: `border-radius:0`. Regra do cabeçalho: "canto 0–2px".
- Círculos (pontos, furo da etiqueta, picote): `50%`.
- Etiqueta de lote: cantos chanfrados via `clip-path` de 17–18px.

### 1.4 Bordas
- Regra: "Borda 3px". Cartões/botões/amostras: `3px solid` `--tinta`.
- Cabeçalho do manual: `border-bottom:4px solid`. Logo: `4px solid` + placa interna `2px solid`.
- Carimbos: `4px solid` + `outline:2px solid` com `outline-offset:3px` (Ao vivo, Arrematado, Íntegro, Adulterado); "Sem lances": `4px dashed #5B5449`, sem outline.
- Desabilitado: `3px dashed #5B5449`. Recusa: `2px dashed #A43C1E`. Recibo: `2px dashed #8A8273`. Divisor de seção: `2px dashed #8A8273`. Chips: `2px solid`.
- Colunas de "Tipos": `border-top:4px solid`.
- Noite: borda do cartão `3px solid #CFC5B0`.

### 1.5 Sombras (duras, sem blur)
- Regras: "sombra 6/6/0"; "nenhuma sombra borrada".
- Cartão claro `6px 6px 0 #1E1C19`; cartão noite `6px 6px 0 #3A362F`; logo `6px 6px 0 #1E1C19`.
- Botão `5px 5px 0 #1E1C19`. Pressionado: "anda 3px e a sombra encolhe para 2px". Desabilitado: sem sombra.

### 1.6 Espaçamento (valores usados; sem escala nomeada)
- Página: largura 1440px, padding `64px 72px 88px`, gap entre seções 64px.
- Gaps usados: 12, 14, 16, 18, 20, 24, 26/30, 32, 40, 48px. Padding de cartão 24px (`28px 24px 24px` nas peças). Botão: min-height 52px, padding `10px 26px 8px` (primário) e `10px 22px 8px`. Carimbo: `4px 12px 2px`.
- Escala numérica nomeada: não definida no manual.

### 1.7 Grid
- Página 1440px, `box-sizing:border-box`. Cartões em `repeat(3, minmax(0,1fr))` gap 32px (2 colunas em Tintas); amostras de cor `repeat(5, minmax(0,1fr))` gap 12px.
- Colunas/gutters formais: não definidos no manual.

### 1.8 Breakpoints
- Não definidos no manual; nenhum `@media` de largura nos arquivos lidos. Só viewports de board: desktop 1440px e celular 390px (seções 4 e 5).

### 1.9 Z-index
- Sem escala. Único uso no manual: cordão da etiqueta `z-index:2`. (Telas base usam `z-index:2` e `3` pontualmente.)

### 1.10 Motion
- `@keyframes la-pulsa{0%,100%{opacity:1}50%{opacity:.35}}` — ponto do "Ao vivo": `1.2s infinite`; cronômetro últimos 2 min: `1s infinite`.
- `@keyframes la-mais{0%{transform:translateY(10px) rotate(-6deg);opacity:0}12%{transform:translateY(0) rotate(-6deg);opacity:1}88%{opacity:1}100%{opacity:0}}` — aparição do "+2 MIN".
- Carimbo ao encerrar: "bate" — "entra grande e girado, encolhe e assenta em −6°" (keyframes `la-bate`, `la-entra`, `la-vira`, `la-marca` existem nas telas base; valores não lidos aqui).
- `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`.
- Botão pressionado: translada 3px, sombra 2px (duração não definida).
- Links: `a{color:#1E1C19}`, `a:hover{color:#A43C1E}`.

## 2. Componentes do manual

- **Logo / placa Mercosul vazada**: inline-flex coluna, fundo transparente, texto `--tinta`, `border:4px solid`, raio 10px, sombra `6px 6px 0`. Faixa superior `#E2A514` com "BRASIL" branco (Plex Mono 12px/600, ls .5em, padding `5px 10px 4px 16px`). Placa inferior: margin `0 4px 4px`, padding `8px 16px 5px`, `border:2px solid` sem borda superior, raio `0 0 6px 6px`, dois pontos 8x8px redondos nas laterais, texto "LANCE·AUTO" Big Shoulders 800 56px ls .1em. "Contorno e letras na cor do texto de cada tema."
- **Etiqueta de lote** ("amarrada no retrovisor"): fundo ocre `#E2A514` (lote ao vivo ou agendado) ou papel `#F5EEDF` (encerrado). Contorno 3px `#1E1C19` por `clip-path` chanfrado (18px externo / 17px interno), padding interno `10px 18px 8px 36px`, furo circular 10x10 com borda 3px `#1E1C19` e fundo `#E8DFCB` (left 10px). Rótulo "LOTE" Plex Mono 11px ls .14em; número Big Shoulders 900 52px lh .9. Rotações de exemplo -4° e +3°. Cordão SVG 60x70, 2 curvas, `stroke #1E1C19` 2.5px, `left:-22px; top:-26px; z-index:2`. "O cordão sempre sai do furo."
- **Carimbos / selos**: Big Shoulders 900 26px, ls .08em, uppercase, padding `4px 12px 2px`, lh 1. Variantes:
  - Ao vivo: `#A43C1E`, borda 4px + outline 2px offset 3px, rotação -5°, ponto 10px pulsante (`la-pulsa 1.2s`).
  - Arrematado: `#1E1C19`, 4px + outline, +3°.
  - Sem lances: `#5B5449`, borda 4px tracejada, sem outline, -2°.
  - Íntegro: `#2E6A3E`, 4px + outline, -7°.
  - Adulterado: `#A43C1E`, 4px + outline, +4°.
  - Faixa de rotação: −7° a +4°. Ao encerrar assenta em −6°.
- **Cronômetro (display de painel)**: fundo `#141311`, borda 3px, padding `10px 14px 12px`, gap 4px; rótulo Plex Mono 10px ls .16em; dígitos Plex Mono 600 40px lh 1; dígitos fantasma "88:88" (opacity .1) atrás ("LCD de bomba de gasolina"). Variantes:
  - Normal: rótulo "RESTAM" `#8A8273`, dígitos `#F2B92B`, borda `#1E1C19` (ex.: 12:08).
  - Últimos 2 min: borda `#A43C1E`, rótulo "ÚLTIMOS 2 MIN" e dígitos `#FF6A3D`, dígitos pulsam `la-pulsa 1s` (ex.: 01:47).
  - Prorrogado: rótulo "PRORROGADO" `#8A8273`, dígitos `#F2B92B` (ex.: 02:00), selo "+2 MIN" no canto (`right:-14px; top:-14px`, fundo `#E2A514`, texto `#1E1C19`, borda 3px, Big Shoulders 900 18px, padding `2px 8px 0`, rotação -6°).
- **Botões** (min-height 52px, raio 0, uppercase Big Shoulders, borda 3px):
  - Primário "Dar lance": fundo `#E2A514`, texto `#1E1C19`, sombra 5px 5px 0, 900 22px ls .04em, padding `10px 26px 8px`.
  - Secundário "Copiar link": fundo `#F5EEDF`, texto `#1E1C19`, sombra 5px, 800 20px, padding `10px 22px 8px`.
  - Desabilitado "Lote fechado": fundo `#DDD3BC`, texto `#5B5449`, `3px dashed #5B5449`, sem sombra, 800 20px.
  - Pressionado: anda 3px, sombra 2px.
- **Placar de posição**: faixa borda 3px `#1E1C19`, padding `12px 16px 10px`, texto `#F5EEDF`, Big Shoulders 900 30px uppercase + contador Plex Mono 13px. "Você está ganhando" fundo `#2E6A3E` ("1º de 5"); "Você foi superado" fundo `#A43C1E` ("2º de 5"). Chips de licitante: Plex Mono 14px, borda 2px, padding `3px 8px` ("LICITANTE 7F3A", "LICITANTE C3E8"); "VOCÊ" com fundo `#E2A514` e peso 600.
- **Recusas** ("sempre coladas ao botão"): caixa `2px dashed #A43C1E`, texto `#A43C1E`, padding `8px 10px`, 15px, lh 1.35, ícone SVG 18x18 (círculo cortado, stroke 2px). Mensagens literais:
  1. "Seu lance precisa ser de pelo menos R$ 31.000,00."
  2. "Saldo insuficiente: você tem R$ 47.500,00 disponíveis. Depositar na carteira →"
  3. "Você já está na frente. Cobrir o próprio lance só gasta saldo."
  4. "O lote abre sábado, 24/out, às 14h. Até lá o martelo fica na gaveta."
  5. "Martelo batido às 18:58. Este lote não aceita mais lances."
- **Recibo** (Plex Mono 17px, lh 1.7): fundo `#F5EEDF`, `2px dashed #8A8273`, padding `14px 16px`; linhas rótulo/valor: LOTE 018, LANCE R$ 31.000,00, PRAZO 04:59, LICITANTE 7F3A, HASH 9f2c…e81a.
- **Picote de canhoto**: altura 24px, fundo `#F5EEDF`, bordas laterais 3px; linha `2px dashed #8A8273` (left/right 20px, top 11px); dois semicírculos 24x24 nas laterais (fundo `#E8DFCB`, left/right -15px) com borda interna 3px.
- **Cartão**: fundo `--papel`, borda 3px `--tinta`, sombra 6px 6px 0, padding 24px.
- Inputs, tabela, cards de vitrine, navegação: NÃO descritos no manual (só existem nas telas base).

## 3. Regras de uso escritas no manual
- "Cinco cores, três fontes e nenhuma sombra borrada. O suficiente para vender um Opala sem parecer startup."
- "Máx. 5 cores · tokens nos dois temas."
- Ocre: "Ação. Só ela pede clique." Não muda de turno. "Só existe um botão ocre por tela."
- Verde: "Ganhando e íntegro. Mais nada." Ferrugem: superado, tempo acabando, adulterado.
- Cartaz: "Sempre caixa-alta, entrelinha apertada."
- Peças: "Borda 3px · sombra 6/6/0 · canto 0–2px."
- Etiqueta: ocre para ao vivo/agendado, papel para encerrado; cordão sempre sai do furo.
- Carimbos: rotação entre −7° e +4°; ao encerrar "bate" e assenta em −6°.
- Cronômetro: dígitos fantasma 88:88; abaixo de 2:00 vira ferrugem e pulsa.
- Recusas sempre coladas ao botão.
- Picote separa o que se destaca.
- Botão pressionado: 3px / sombra 2px.
- Logo: faixa `#E2A514` com BRASIL branco; contorno e letras na cor do texto de cada tema.
- `prefers-reduced-motion` desliga animações.
- Dados verificáveis (lote, R$, cronômetro, pseudônimo, hash) sempre em Plex Mono.

## 4. Índice do canvas (`canvas.json`, v3, título "LanceAuto")

w x h; "fill"=expand fill; I=interativo.

| Arquivo | Título | Tamanho | Pos x,y | Flags |
|---|---|---|---|---|
| Main.dc.html | Manual de pátio · tokens claro e noite | 1440x1900 | 0,0 | — |
| Vitrine.dc.html | 01 Vitrine · claro · busca e filtros funcionam | 1440x2300 | 0,2300 | fill, I |
| VitrineEscuro.dc.html | 01 Vitrine · noite | 1440x2300 | 1520,2300 | fill, I |
| VitrineMobile.dc.html | 01 Vitrine · celular | 390x4700 | 3040,2300 | I |
| Acesso.dc.html | 02 Criar conta · claro | 1440x1100 | 0,7400 | fill, I |
| AcessoLoginEscuro.dc.html | 02 Entrar · noite | 1440x1100 | 1520,7400 | fill, I |
| AcessoMobile.dc.html | 02 Criar conta · celular | 390x1800 | 3040,7400 | I |
| Sala.dc.html | 03 Sala · superado · experimente dar lances | 1440x1600 | 0,9600 | fill, I |
| SalaGanhando.dc.html | 03 Sala · ganhando | 1440x1600 | 1520,9600 | fill, I |
| SalaUltimos.dc.html | 03 Sala · últimos 2 minutos | 1440x1600 | 3040,9600 | fill, I |
| SalaProrrogado.dc.html | 03 Sala · prorrogado +2 min · noite | 1440x1600 | 4560,9600 | fill, I |
| SalaEncerrado.dc.html | 03 Sala · encerrado, você arrematou · noite | 1440x1600 | 0,11320 | fill, I |
| SalaRecusa.dc.html | 03 Sala · recusa por saldo | 1440x1600 | 1520,11320 | fill, I |
| SalaVisitante.dc.html | 03 Sala · visitante sem login | 1440x1600 | 3040,11320 | fill, I |
| SalaMobile.dc.html | 03 Sala · ganhando · celular noite | 390x3100 | 4560,11320 | I |
| Carteira.dc.html | 04 Carteira · claro | 1440x1400 | 0,14820 | fill, I |
| CarteiraMobile.dc.html | 04 Carteira · celular noite | 390x2400 | 1520,14820 | I |
| Arremates.dc.html | 05 Meus arremates · claro | 1440x1400 | 0,17620 | fill, I |
| ArrematesMobile.dc.html | 05 Meus arremates · celular noite | 390x2600 | 1520,17620 | I |
| Comprovante.dc.html | 06 Comprovante público · claro | 1440x1400 | 0,20620 | fill, I |
| ComprovanteEscuro.dc.html | 06 Comprovante público · noite | 1440x1400 | 1520,20620 | fill, I |
| ComprovanteMobile.dc.html | 06 Comprovante · celular | 390x1900 | 3040,20620 | I |
| Painel.dc.html | 07 Painel do leiloeiro · claro | 1440x1700 | 0,22920 | fill |
| PainelEscuro.dc.html | 07 Painel do leiloeiro · noite | 1440x1700 | 1520,22920 | fill |
| CriarLote.dc.html | 08 Criar lote · claro | 1440x1800 | 0,25020 | fill, I |
| CriarLoteErro.dc.html | 08 Criar lote · FIPE fora do ar · noite | 1440x1800 | 1520,25020 | fill, I |
| Auditoria.dc.html | 09 Auditoria · íntegro · claro | 1440x2000 | 0,27220 | fill, I |
| AuditoriaAdulterado.dc.html | 09 Auditoria · adulterado · claro | 1440x2000 | 1520,27220 | fill, I |
| AuditoriaMobile.dc.html | 09 Auditoria · adulterado · celular noite | 390x3300 | 3040,27220 | I |

Títulos de seção (notas `title1`): "LanceAuto · manual de pátio", "01 · Vitrine de lotes", "02 · Cadastro e login", "03 · Sala do lote ao vivo", "04 · Carteira do licitante", "05 · Meus arremates", "06 · Comprovante de arremate", "07 · Painel do leiloeiro", "08 · Criar lote", "09 · Auditoria pública".
Viewports implícitos: desktop 1440, celular 390.

## 5. Wrappers: tela base + props (definem os estados)

Props declarados nas telas base (`data-props`):
- Vitrine, Carteira, Arremates, Comprovante, Painel: `tema` (claro|escuro, default claro).
- Acesso: `tema`, `modo` (cadastro|entrar, default cadastro), `erro` (boolean, default false; só vale em modo entrar enquanto o usuário não trocou de modo).
- Sala: `tema`, `estado` (superado|ganhando|ultimos|prorrogado|encerrado|saldo|visitante, default superado).
- CriarLote: `tema`, `erroApi` (boolean, default false).
- Auditoria: `tema`, `veredito` (integro|adulterado, default integro).

Fundo do wrapper: claro `#E8DFCB`, noite `#161513`. Desktop: `width:100%; min-height:100vh`; celular: `width:390px; min-height:<h>; overflow:hidden`.

| Wrapper | Tela base | Props passados | Fundo | Preview |
|---|---|---|---|---|
| VitrineEscuro | Vitrine | tema=escuro | #161513 | 1440x2300 |
| VitrineMobile | Vitrine | tema=claro | #E8DFCB | 390x4700 |
| AcessoLoginEscuro | Acesso | tema=escuro, modo=entrar, erro=true | #161513 | 1440x1100 |
| AcessoMobile | Acesso | tema=claro, modo=cadastro | #E8DFCB | 390x1800 |
| SalaGanhando | Sala | tema=claro, estado=ganhando | #E8DFCB | 1440x1600 |
| SalaUltimos | Sala | tema=claro, estado=ultimos | #E8DFCB | 1440x1600 |
| SalaProrrogado | Sala | tema=escuro, estado=prorrogado | #161513 | 1440x1600 |
| SalaEncerrado | Sala | tema=escuro, estado=encerrado | #161513 | 1440x1600 |
| SalaRecusa | Sala | tema=claro, estado=saldo | #E8DFCB | 1440x1600 |
| SalaVisitante | Sala | tema=claro, estado=visitante | #E8DFCB | 1440x1600 |
| SalaMobile | Sala | tema=escuro, estado=ganhando | #161513 | 390x3100 |
| CarteiraMobile | Carteira | tema=escuro | #161513 | 390x2400 |
| ArrematesMobile | Arremates | tema=escuro | #161513 | 390x2600 |
| ComprovanteEscuro | Comprovante | tema=escuro | #161513 | 1440x1400 |
| ComprovanteMobile | Comprovante | tema=claro | #E8DFCB | 390x1900 |
| PainelEscuro | Painel | tema=escuro | #161513 | 1440x1700 |
| CriarLoteErro | CriarLote | tema=escuro, erro-api=true (prop `erroApi`) | #161513 | 1440x1800 |
| AuditoriaAdulterado | Auditoria | tema=claro, veredito=adulterado | #E8DFCB | 1440x2000 |
| AuditoriaMobile | Auditoria | tema=escuro, veredito=adulterado | #161513 | 390x3300 |

Telas base sem wrapper (estado default, tema claro): Vitrine, Acesso (cadastro), Sala (superado), Carteira, Arremates, Comprovante, Painel, CriarLote (sem erro), Auditoria (íntegro).

Estados da Sala: superado (default), ganhando, ultimos (últimos 2 min), prorrogado (+2 min), encerrado (você arrematou), saldo (recusa por saldo insuficiente), visitante (sem login).
Lacunas: sem versão celular de Painel e CriarLote; Carteira e Arremates desktop só em claro; Auditoria noite só em celular.
