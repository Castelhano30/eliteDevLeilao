---
name: LanceAuto
description: Sistema visual "Manual de pátio" (Rev. 03, out/2026) da casa de leilões de carros LanceAuto. Ficha de pátio neo-brutalista, cinco cores, três fontes, bordas de 3px e sombras duras sem blur, em dois temas (claro "papel" e noite "carvão").
status: draft
updated: 2026-10-22
colors:
  # Tema claro "De dia · papel". Chaves idênticas ao objeto PAL do design importado.
  claro:
    fundo: '#E8DFCB'
    papel: '#F5EEDF'
    suave: '#DDD3BC'
    pontos: '#C9BEA5'
    tinta: '#1E1C19'
    tinta2: '#5B5449'
    linha: '#1E1C19'
    sombra: '#1E1C19'
    tracejado: '#8A8273'
    ocre: '#E2A514'
    sobreOcre: '#1E1C19'
    ferrugem: '#A43C1E'
    verde: '#2E6A3E'
    sobreCor: '#F5EEDF'
    painel: '#141311'
    led: '#F2B92B'
    ledAlerta: '#FF6A3D'
    falha: 'rgba(164,60,30,.12)'
  # Tema noite "À noite · carvão". Mesmas chaves, valores do escuro.
  noite:
    fundo: '#161513'
    papel: '#262420'
    suave: '#2F2C27'
    pontos: '#3F3B34'
    tinta: '#ECE4D2'
    tinta2: '#B3AA99'
    linha: '#CFC5B0'
    sombra: '#3A362F'
    tracejado: '#6E675C'
    ocre: '#E8AE22'
    sobreOcre: '#161513'
    ferrugem: '#E36A43'
    verde: '#74B585'
    sobreCor: '#161513'
    painel: '#0B0B0A'
    led: '#F2B92B'
    ledAlerta: '#FF6A3D'
    falha: 'rgba(227,106,67,.16)'
  # Literais fixos do design, iguais nos dois temas (não acompanham o tema).
  fixas:
    faixaPlaca: '#E2A514'
    brasilTexto: '#FFFFFF'
    digitoPlaca: '#F5EEDF'
    linhaCentralPlaca: '#000000'
    rotuloRelogio: '#8A8273'
    rotuloNotaPainel: '#B3AA99'
typography:
  display:
    fontFamily: Big Shoulders Display
    fontWeight: '900'
    lineHeight: '1'
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.3'
  logo:
    fontFamily: Big Shoulders Display
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.1em
  logo-tela:
    fontFamily: Big Shoulders Display
    fontSize: 30px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.1em
  display-hero:
    fontFamily: Big Shoulders Display
    fontSize: clamp(68px, 11vw, 184px)
    fontWeight: '900'
    lineHeight: '0.8'
    letterSpacing: normal
  display-titulo:
    fontFamily: Big Shoulders Display
    fontSize: clamp(60px, 9vw, 132px)
    fontWeight: '900'
    lineHeight: '0.84'
  display-secao:
    fontFamily: Big Shoulders Display
    fontSize: clamp(46px, 6vw, 76px)
    fontWeight: '900'
    lineHeight: '1'
  cartaz-cartao:
    fontFamily: Big Shoulders Display
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1'
  cartaz-subtitulo:
    fontFamily: Big Shoulders Display
    fontSize: 26px
    fontWeight: '800'
    lineHeight: '1'
  botao-primario:
    fontFamily: Big Shoulders Display
    fontSize: 22px
    fontWeight: '900'
    lineHeight: '1'
    letterSpacing: 0.04em
  botao:
    fontFamily: Big Shoulders Display
    fontSize: 20px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.04em
  carimbo:
    fontFamily: Big Shoulders Display
    fontSize: 26px
    fontWeight: '900'
    lineHeight: '1'
    letterSpacing: 0.08em
  placar:
    fontFamily: Big Shoulders Display
    fontSize: 30px
    fontWeight: '900'
    lineHeight: '1'
  numero-lote:
    fontFamily: Big Shoulders Display
    fontSize: 52px
    fontWeight: '900'
    lineHeight: '0.9'
  body-lead:
    fontFamily: Newsreader
    fontSize: 21px
    fontWeight: '400'
    lineHeight: '1.4'
  body:
    fontFamily: Newsreader
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.45'
  body-nota:
    fontFamily: Newsreader
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.35'
  body-legenda:
    fontFamily: Newsreader
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.3'
  mono-recibo:
    fontFamily: IBM Plex Mono
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.7'
  mono-dado:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.3'
  mono-rotulo:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: '400'
    letterSpacing: 0.12em
  mono-rotulo-pequeno:
    fontFamily: IBM Plex Mono
    fontSize: 10px
    fontWeight: '400'
    letterSpacing: 0.16em
  cronometro:
    fontFamily: IBM Plex Mono
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  nenhum: 0px
  placa: 3px
  logo-interno: 6px
  logo-tela: 7px
  logo: 10px
  circulo: 50%
spacing:
  # Valores observados nas telas e no manual. NÃO é uma escala nomeada pelo design.
  '8': 8px
  '14': 14px
  '20': 20px
  '26': 26px
  '30': 30px
  '12': 12px
  '16': 16px
  '18': 18px
  '24': 24px
  '32': 32px
  '36': 36px
  '40': 40px
  '48': 48px
  gutter-lateral: clamp(16px, 4vw, 56px)
  container-max: 1320px
  container-comprovante: 1200px
  pagina-manual: 1440px
  celular: 390px
  cartao-padding: 24px
  alvo-minimo: 44px
  botao-altura: 52px
borders:
  padrao: 3px
  titulo: 4px
  destaque: 5px
  carimbo: 4px
  tracejada-divisoria: 2px
shadows:
  cartao: '6px 6px 0'
  botao: '5px 5px 0'
  botao-pressionado: '2px 2px 0'
  logo-e-pequenos: '4px 4px 0'
  imagem-e-painel: '8px 8px 0'
components:
  foco:
    contorno: '3px solid {colors.claro.tinta}'
    afastamento: 3px
    halo: '0 0 0 3px {colors.claro.papel}'
  dialogo-cancelamento:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta}'
    borda: '3px solid {colors.claro.linha}'
    sombra: '8px 8px 0 {colors.claro.sombra}'
    padding: '{spacing.24}'
    largura-max: 560px
    rounded: '{rounded.nenhum}'
    backdrop: 'rgba(30,28,25,.65)'
  estado-feedback:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta2}'
    borda: '3px dashed {colors.claro.tracejado}'
    padding: '{spacing.24}'
    erro: '{colors.claro.ferrugem}'
  foto-veiculo:
    background: '{colors.claro.suave}'
    ajuste: contain
    proporcao-sala: '16 / 9'
    altura-cartao: 200px
    credito: '{typography.body-legenda}'
  chip-identidade:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta}'
    borda: '2px solid {colors.claro.linha}'
    typography: '{typography.mono}'
    padding: '8px 12px'
  logo-placa:
    borda: '4px solid {colors.claro.tinta}'
    rounded: '{rounded.logo}'
    sombra: '6px 6px 0 {colors.claro.sombra}'
    faixa-fundo: '{colors.fixas.faixaPlaca}'
    faixa-texto: '{colors.fixas.brasilTexto}'
    typography: '{typography.logo}'
    placa-borda: '2px solid {colors.claro.tinta}'
    placa-rounded: '{rounded.logo-interno}'
  etiqueta-lote:
    background-ativo: '{colors.claro.ocre}'
    background-encerrado: '{colors.claro.papel}'
    contorno: '3px {colors.claro.tinta}'
    furo: '10px, borda 3px, fundo {colors.claro.fundo}'
    typography-numero: '{typography.numero-lote}'
    rotacao: '-4deg a +3deg'
  carimbo:
    typography: '{typography.carimbo}'
    borda: '4px solid + outline 2px offset 3px'
    padding: '4px 12px 2px'
    rounded: '{rounded.nenhum}'
    rotacao: '-7deg a +4deg'
  selo-ao-vivo:
    textColor: '{colors.claro.ferrugem}'
    typography: '{typography.carimbo}'
    borda: '4px solid + outline 2px offset 3px'
    rotacao: '-5deg'
    ponto: '10px, la-pulsa 1.2s infinite'
  cronometro:
    background: '{colors.claro.painel}'
    textColor: '{colors.claro.led}'
    textColor-alerta: '{colors.claro.ledAlerta}'
    borda: '3px solid {colors.claro.linha}'
    borda-alerta: '3px solid {colors.claro.ferrugem}'
    padding: '10px 14px 12px'
    typography: '{typography.cronometro}'
    rotulo: '{typography.mono-rotulo-pequeno}'
    rotulo-cor: '{colors.fixas.rotuloRelogio}'
  botao-primario:
    background: '{colors.claro.ocre}'
    textColor: '{colors.claro.sobreOcre}'
    typography: '{typography.botao-primario}'
    borda: '3px solid {colors.claro.tinta}'
    sombra: '5px 5px 0 {colors.claro.sombra}'
    rounded: '{rounded.nenhum}'
    min-height: 52px
    padding: '10px 26px 8px'
    pressionado: 'translate 3px, sombra 2px'
  botao-secundario:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta}'
    typography: '{typography.botao}'
    borda: '3px solid {colors.claro.tinta}'
    sombra: '5px 5px 0 {colors.claro.sombra}'
    rounded: '{rounded.nenhum}'
    min-height: 52px
    padding: '10px 22px 8px'
  botao-desabilitado:
    background: '{colors.claro.suave}'
    textColor: '{colors.claro.tinta2}'
    typography: '{typography.botao}'
    borda: '3px dashed {colors.claro.tinta2}'
    sombra: nenhuma
    rounded: '{rounded.nenhum}'
    min-height: 52px
  placa-lance:
    background: '{colors.claro.painel}'
    textColor: '{colors.fixas.digitoPlaca}'
    linha-central: '2px {colors.fixas.linhaCentralPlaca}'
    rounded: '{rounded.placa}'
    largura: 40px
    altura: 60px
    typography: 'IBM Plex Mono 600 40px'
    animacao: 'la-vira .5s, atraso .06s por dígito'
  placar-posicao:
    background-ganhando: '{colors.claro.verde}'
    background-superado: '{colors.claro.ferrugem}'
    textColor: '{colors.claro.sobreCor}'
    typography: '{typography.placar}'
    borda: '3px solid {colors.claro.tinta}'
    padding: '12px 16px 10px'
    contador: 'IBM Plex Mono 13px'
  faixa-status:
    background-ganhando: '{colors.claro.verde}'
    background-superado: '{colors.claro.ferrugem}'
    background-neutro: '{colors.claro.tinta}'
    textColor: '{colors.claro.sobreCor}'
    textColor-neutro: '{colors.claro.fundo}'
    typography: 'Big Shoulders Display 900 clamp(30px,..,42px) caixa-alta'
    subtitulo: 'IBM Plex Mono 13px'
  mensagem-recusa:
    background: transparent
    textColor: '{colors.claro.ferrugem}'
    borda: '2px dashed {colors.claro.ferrugem}'
    padding: '8px 10px'
    typography: '{typography.body-nota}'
    icone: 'SVG 18x18, círculo cortado, traço 2px'
    rounded: '{rounded.nenhum}'
  recibo:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta}'
    borda: '2px dashed {colors.claro.tracejado}'
    padding: '14px 16px'
    typography: '{typography.mono-recibo}'
    rotacao-comprovante: '-1deg'
    sombra-comprovante: 'drop-shadow 8px 8px 0'
  cartao-lote:
    background: '{colors.claro.papel}'
    borda: '3px solid {colors.claro.linha}'
    sombra: '6px 6px 0 {colors.claro.sombra}'
    rounded: '{rounded.nenhum}'
    imagem-altura: 200px
    typography-titulo: '{typography.display-hero}'
    titulo-tamanho: 32px
  cartao-canhoto:
    background: '{colors.claro.papel}'
    borda: '3px solid {colors.claro.linha}'
    sombra: '6px 6px 0 {colors.claro.sombra}'
    rounded: '{rounded.nenhum}'
    padding: '{spacing.cartao-padding}'
    numero: 'Big Shoulders Display 900 76px, preenchimento ocre, traço 3px'
    picote: 'altura 24px, linha 2px dashed {colors.claro.tracejado}'
  chip-saldo:
    background: '{colors.claro.papel}'
    textColor: '{colors.claro.tinta}'
    borda: '3px solid {colors.claro.linha}'
    typography: 'IBM Plex Mono 13px'
    rounded: '{rounded.nenhum}'
  campo:
    background: '{colors.claro.fundo}'
    textColor: '{colors.claro.tinta}'
    borda: '3px solid {colors.claro.linha}'
    borda-erro: '3px solid {colors.claro.ferrugem}'
    rounded: '{rounded.nenhum}'
    min-height: 50px
    typography: 'Newsreader 19px'
  tabela:
    background: '{colors.claro.papel}'
    borda: '3px solid {colors.claro.linha}'
    sombra: '6px 6px 0 {colors.claro.sombra}'
    separador-linha: '2px dashed {colors.claro.tracejado}'
    min-width: '560px a 780px, rolagem horizontal'
    rounded: '{rounded.nenhum}'
  aba-filtro:
    background: transparent
    background-ativa: '{colors.claro.tinta}'
    textColor: '{colors.claro.tinta}'
    textColor-ativa: '{colors.claro.fundo}'
    borda: '3px solid {colors.claro.linha}'
    min-height: 48px
    contador: 'IBM Plex Mono, 2 dígitos'
  picote:
    background: '{colors.claro.papel}'
    altura: 24px
    linha: '2px dashed {colors.claro.tracejado}'
    semicirculos: '24x24, fundo {colors.claro.fundo}'
  chip-licitante:
    borda: '2px solid {colors.claro.tinta}'
    typography: 'IBM Plex Mono 14px'
    padding: '3px 8px'
    marca-voce: 'fundo {colors.claro.ocre}, peso 600'
  selo-prorrogacao:
    background: '{colors.claro.ocre}'
    textColor: '{colors.claro.sobreOcre}'
    borda: '3px solid {colors.claro.tinta}'
    typography: 'Big Shoulders Display 900 18px (manual) / 22px (Sala)'
    rotacao: '-6deg'
    animacao: 'la-mais .6s'
  botao-atalho:
    borda: '2px solid {colors.claro.linha}'
    min-height: 44px
    typography: 'IBM Plex Mono 14px'
---

## Brand & Style

LanceAuto é uma casa de leilões de carros que se veste de **ficha de pátio**: papel de recibo, carimbo de borracha, etiqueta amarrada no retrovisor, placa Mercosul vazada e display de bomba de gasolina. A estética é neo-brutalista e artesanal ao mesmo tempo. Bordas grossas e sombras duras dão o peso de objeto físico. Os cantos ficam retos. A voz é bem-humorada e seca ("Quem dá mais, leva.", "Quem hesita, assiste.").

O manual do design (Rev. 03, out/2026) resume o sistema em uma frase: "Cinco cores, três fontes e nenhuma sombra borrada. O suficiente para vender um Opala sem parecer startup." As peças seguem a regra "Borda 3px · sombra 6/6/0 · canto 0–2px".

Os protótipos [design/project](design/project/) são a referência visual; o [PRD markdown](<PRD — Plataforma de Leilão de Carros (Teste Técnico).md>) é a fonte funcional. O PDF antigo não se aplica. Este documento e [EXPERIENCE.md](EXPERIENCE.md) prevalecem sobre mocks e importações em caso de conflito. As extensões mínimas abaixo aplicam a autorização do usuário de seguir as recomendações P1–P40 compatíveis com o PRD, preservando a estética registrada.

## Colors

O manual fala em no máximo cinco cores, com tokens nos dois temas. Os papéis abaixo são os do manual. Os demais tokens do objeto `PAL` (fundo, suave, pontos etc.) são superfícies e apoios que as telas usam.

**Como os dois temas estão modelados.** Os tokens usam as chaves exatas do objeto `PAL` do design (`fundo`, `papel`, `suave`, `pontos`, `tinta`, `tinta2`, `linha`, `sombra`, `tracejado`, `ocre`, `sobreOcre`, `ferrugem`, `verde`, `sobreCor`, `painel`, `led`, `ledAlerta`, `falha`) em dois grupos: `colors.claro.*` e `colors.noite.*`. Um terceiro grupo, `colors.fixas.*`, guarda literais que o design fixa nos dois temas. Os componentes no frontmatter referenciam o grupo `claro` por conveniência; **em todo componente, trocar de tema é trocar `colors.claro.<chave>` por `colors.noite.<chave>` com a mesma chave**. O formato da spec pede um objeto plano de cores; o agrupamento por tema foi escolhido porque preserva as chaves do `PAL` sem sufixos.

### Papéis das cinco cores

- **Ocre** (`ocre`: `#E2A514` claro, `#E8AE22` noite). Ação. "Só ela pede clique." Não muda de turno e continua sendo a única cor que convida ao clique. Só existe **um botão ocre por tela**. O texto sobre ocre usa `sobreOcre`. Também pinta a etiqueta de lote ao vivo ou agendado, o marcador "VOCÊ" nos chips e o fundo do selo "+2 MIN".
- **Grafite / Giz** (`tinta`: `#1E1C19` claro, `#ECE4D2` noite). Texto, bordas e sombras. `linha` e `sombra` acompanham: no noite a borda vira `#CFC5B0` e a sombra dura vira `#3A362F` (não é o giz puro, para não estourar no escuro). `tinta2` (`#5B5449` / `#B3AA99`) é o texto secundário.
- **Papel / Carvão** (`papel`: `#F5EEDF` / `#262420`). Superfície de cartões, recibos e campos de painel. `fundo` (`#E8DFCB` / `#161513`) é a página. `suave` (`#DDD3BC` / `#2F2C27`) é fundo de imagem, botão desabilitado e abas inativas. `pontos` (`#C9BEA5` / `#3F3B34`) é o pontilhado do fundo das imagens.
- **Ferrugem** (`ferrugem`: `#A43C1E` / `#E36A43`). Superado, tempo acabando, adulterado, erro e selo "Ao vivo". Clareada à noite para ler no escuro. `falha` é o tom translúcido da linha de auditoria que não confere.
- **Verde** (`verde`: `#2E6A3E` / `#74B585`). "Ganhando e íntegro. Mais nada." Proibido como decoração. O texto sobre verde usa `sobreCor` (`#F5EEDF` claro, `#161513` noite).

### Cores do cronômetro e das placas

`painel` (`#141311` claro, `#0B0B0A` noite) é o fundo do display do cronômetro e das placas de lance. `led` (`#F2B92B`) é o dígito normal e `ledAlerta` (`#FF6A3D`) é o dígito nos últimos 2 minutos; ambos são idênticos nos dois temas. No manual o display é `#141311` fixo nos dois temas; nas telas base o valor noite é `#0B0B0A`.

### Literais fixos (grupo `fixas`)

- `faixaPlaca` `#E2A514` com `brasilTexto` `#FFFFFF`: faixa "BRASIL" da logo, igual nos dois temas.
- `digitoPlaca` `#F5EEDF` e `linhaCentralPlaca` `#000`: dígitos e linha central das placas de lance.
- `rotuloRelogio` `#8A8273` e `rotuloNotaPainel` `#B3AA99`: rótulos discretos ("RESTAM", "PRORROGADO", "TEMPO RESTANTE") e nota do total no Painel. **Não acompanham o tema.** Ver contraste abaixo.

Evite: qualquer cor fora desta lista, gradientes, segundo botão ocre na mesma tela, verde fora de "ganhando/íntegro".

## Typography

Três famílias, cada uma com um trabalho. Fonte: Google Fonts (Big Shoulders Display 600/800/900; IBM Plex Mono 400/500/600; Newsreader itálico e normal, opsz 6..72, 400/600).

- **Cartaz: Big Shoulders Display** (`display`). "Títulos, números de seção, botões e carimbos. Sempre caixa-alta, entrelinha apertada." Pesos 800–900. Logo 800, títulos e carimbos 900.
- **Texto: Newsreader** (`body`), fallback Georgia, serif. Corpo, descrições, inputs de texto; o itálico serve a notas (ex.: "NOTA DO LEILOEIRO").
- **Recibo: IBM Plex Mono** (`mono`). "Lote, R$, cronômetro, pseudônimo e hash. Tudo que alguém pode querer conferir depois." Rótulos pequenos em caixa-alta com tracking de .10 a .16em.

### Escala

Os tamanhos abaixo são os observados no manual e nas telas. O manual usa valores fixos (h1 150px, h2 56px); as telas usam `clamp()` fluido. As telas valem para o produto; o manual vale como especificação das peças.

| Papel | Valor |
|---|---|
| h1 do manual | Big Shoulders 900, 150px, lh .82, caixa-alta, ls -.01em |
| h1 de tela | Vitrine `clamp(68px,11vw,184px)` lh .8; Sala `clamp(48px,7vw,104px)` lh .84; Acesso `clamp(64px,9vw,140px)`; internas `clamp(60px,9vw,132px)` |
| h2 de seção | manual 56px lh 1; Vitrine `clamp(46px,6vw,76px)` |
| h3 de cartão | Big Shoulders 800, 32px (títulos de cartão de lote 900) |
| Logo | manual 56px, 800, ls .1em; telas 28px (Sala) e 30px (demais) |
| Botão primário | 900, 22px, ls .04em (Sala: 30px, min-height 64) |
| Botão secundário / desabilitado | 800, 20px, ls .04em |
| Carimbo | 900, 26px, ls .08em (carimbo "Arrematado" na Sala: 52px) |
| Placar de posição | 900, 30px + contador Plex Mono 13px |
| Número da etiqueta | 900, 52px (telas: 34 a 64px) + "LOTE" Plex Mono 11px ls .14em |
| Lead | Newsreader 21px lh 1.4 |
| Parágrafo | Newsreader 17 a 22px lh 1.45 |
| Notas | Newsreader 15px, cor `tinta2` |
| Legenda | Newsreader 13px lh 1.3 |
| Recibo | Plex Mono 17px lh 1.7 |
| Cronômetro | Plex Mono 600, 40px (manual) / 58px (Sala) / 28px (cartão de lote); rótulo 10px ls .16em |
| Rótulos mono | 10 a 13px, caixa-alta, ls .10 a .16em |

Tamanhos px observados: 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 22, 26, 30, 32, 40, 52, 56, 72, 150.

**Regra de ouro:** dados que alguém pode querer conferir depois (lote, R$, cronômetro, pseudônimo, hash) ficam sempre em IBM Plex Mono. Cartaz em caixa-alta, sem exceção.

## Layout & Spacing

A escala operacional usa os valores observados no frontmatter, sem impor grid de colunas ou breakpoints novos. O reflow intrínseco do protótipo é o padrão também para Painel e Criar lote; 390px e 1440px são referências, não larguras fixas. Validar também 320px e zoom de 200%. Somente tabelas podem rolar horizontalmente dentro de região identificada e focável; formulário, cabeçalho e ações quebram linha sem overflow da página.

O que as telas mostram de fato:

- **Contêiner:** `max-width:1320px; margin:0 auto`, padding lateral `clamp(16px,4vw,56px)`. Comprovante: 1200px. A página do manual tem 1440px com padding `64px 72px 88px` e 64px entre seções.
- **Dois viewports de referência:** desktop 1440px e celular 390px. Não há breakpoints nomeados nem `@media` de largura em nenhum arquivo.
- **Responsivo sem media queries.** O reflow vem de `flex-wrap` com `flex: 1 1 <base>`, `clamp()` na tipografia e no padding, e `grid` com `auto-fit`/`auto-fill` e `minmax(min(100%, N), 1fr)`. Exemplos:
  - Cartões de lote: `repeat(auto-fill, minmax(min(100%,330px),1fr))`, gap 40/32 (3 colunas a 1440px, 1 a 390px).
  - "Como funciona": `repeat(auto-fit, minmax(min(100%,300px),1fr))`, gap 24.
  - Ficha do carro (`dl`): `repeat(auto-fit, minmax(min(100%,220px),1fr))`.
  - Sala: colunas `flex: 1 1 520px` e `flex: 1 1 440px` (máx. 560px), gap 36; no celular o painel de lance fica abaixo da ficha do carro, pela ordem do DOM.
  - Tabelas: `min-width` de 560 a 780px com rolagem horizontal no celular.
- **Celular = mesmo componente a 390px**, sem layout dedicado. Existem versões celular de Vitrine, Acesso, Sala, Carteira, Arremates, Comprovante e Auditoria (ver extensões abaixo).
- **Padding de peças:** cartão 24px (`28px 24px 24px` nas peças); botão `10px 26px 8px`; carimbo `4px 12px 2px`.
- **Alvos de toque:** botões de 44 a 64px, pílulas e selects de 48px, inputs de 50 a 56px. Chips de saldo e alguns links pequenos (12px) não têm altura mínima.
- **z-index:** sem escala. Só usos pontuais (`2` no cordão da etiqueta, `2`/`3` nas telas base).

## Elevation & Depth

A profundidade é **física e dura**: sombras sem blur, deslocadas, sempre na cor `sombra`. "Nenhuma sombra borrada."

- Cartão e peça: `6px 6px 0 {colors.claro.sombra}`; logo também `6px 6px 0`.
- Botão: `5px 5px 0`. **Pressionado:** o botão anda 3px e a sombra encolhe para 2px (duração não definida). Desabilitado: sem sombra.
- Variações nas telas: 4px (chips, logo das telas, botões pequenos), 5px (bilhetes selecionados), 8px (imagens, painel de lance, cartão de acesso).
- Noite: a sombra é `#3A362F` (não o giz), a borda `#CFC5B0`.
- Sobreposição também por rotação e recorte: etiquetas e carimbos giram, etiquetas têm cantos chanfrados via `clip-path`, e o picote separa partes de um recibo. Não há camadas tonais além de `fundo`, `papel` e `suave`.

## Shapes

Canto reto: "canto 0–2px". Cartões, botões, inputs e tabelas têm `border-radius: 0`.

- **Bordas.** Padrão 3px sólida em `linha`. Título de página e cabeçalhos: 4px. Cartões de destaque (Disponível na Carteira) e carimbo grande: 5px. Carimbos: 4px sólida mais `outline: 2px` com `outline-offset: 3px` (exceto "Sem lances": 4px tracejada, sem outline). Divisórias e chips: 2px.
- **Tracejado** significa "não é botão, é papel": divisor de seção `2px dashed tracejado`, recibo `2px dashed`, recusa `2px dashed ferrugem`, botão desabilitado `3px dashed tinta2`, estado vazio `3px dashed tracejado`.
- **Exceções de raio:** logo 10px externo (manual) ou 7px (telas), placa interna `0 0 6px 6px`, placas de lance 3px, círculos (`50%`) para pontos, furo da etiqueta e picote.
- **Rotação:** selos e carimbos entre -7° e +4°; ao encerrar o carimbo "bate" e assenta em -6°. Etiquetas de lote giram -4°/+3° (-2° em encerrados); o recibo do comprovante gira -1°.

## Components

Os valores abaixo são do manual (peças canônicas). Quando uma tela usa outro valor, a diferença está anotada. Itens que o manual não descreve (campos, tabelas, cartões de vitrine, navegação) vêm apenas das telas base.

### logo-placa
Placa Mercosul vazada, link para a Vitrine (`aria-label="LanceAuto, vitrine"`). Contorno `4px` em `tinta`, raio externo 10px, sombra 6px. Faixa superior `#E2A514` com "BRASIL" branco (Plex Mono 12px/600, ls .5em; nas telas 8px, ls .42em). Placa inferior com `margin: 0 4px 4px`, `padding: 8px 16px 5px`, borda 2px sem o lado de cima, raio `0 0 6px 6px`, dois pontos redondos de 8px nas laterais e "LANCE·AUTO" em Big Shoulders 800 56px, ls .1em. Contorno e letras seguem a cor de texto de cada tema; a faixa ocre e o branco são fixos.

### etiqueta-lote
Etiqueta "amarrada no retrovisor". Fundo ocre para lote ao vivo ou agendado, `papel` para encerrado. Contorno 3px via `clip-path` chanfrado (18px externo / 17px interno), padding `10px 18px 8px 36px`, furo circular 10×10 com borda 3px (fundo `fundo`, `left:10px`), rótulo "LOTE" Plex Mono 11px, número Big Shoulders 900 52px. Cordão SVG de 2 curvas, traço 2.5px, `left:-22px; top:-26px; z-index:2`. Regra: o cordão sempre sai do furo. Rotação de -4° a +3°.

### carimbo
Big Shoulders 900 26px, ls .08em, caixa-alta, padding `4px 12px 2px`, `lh 1`. Borda 4px sólida mais outline 2px offset 3px.

| Variante | Cor | Rotação |
|---|---|---|
| Ao vivo | `ferrugem` | -5° |
| Arrematado | `tinta` | +3° |
| Sem lances | `tinta2`, borda 4px tracejada, sem outline | -2° |
| Íntegro | `verde` | -7° |
| Adulterado | `ferrugem` | +4° |

Ao encerrar, entra grande e girado, encolhe e assenta em -6° (`la-bate`, .55–.6s, `cubic-bezier(.2,.8,.3,1)`).

### selo-ao-vivo
Carimbo "Ao vivo" em `ferrugem` com ponto de 10px que pulsa (`la-pulsa 1.2s infinite`). Rotação -5°. Aparece no título da Sala e no canto dos cartões de lote ao vivo; some quando o lote encerra.

### cronometro
"LCD de bomba de gasolina". Fundo `painel`, borda 3px, padding `10px 14px 12px`, gap 4px. Dígitos Plex Mono 600; dígitos fantasma "88:88" a `opacity .1` atrás do valor real.

| Variante | Rótulo | Dígitos | Borda |
|---|---|---|---|
| Normal | "RESTAM" `#8A8273` | `led` | `linha` |
| Últimos 2 min | "ÚLTIMOS 2 MIN" `ledAlerta` | `ledAlerta`, pulsam `la-pulsa 1s` | `ferrugem` |
| Prorrogado | "PRORROGADO" `#8A8273` | `led` | `linha`, mais `selo-prorrogacao` no canto (`right:-14px; top:-14px`) |
| Encerrado | "ENCERRADO" | "00:00" em `led`, sem animação | `linha` |

Na Sala o display tem 58px e `role="timer"` com `aria-label="Tempo restante mm:ss"`.

### botao-primario
"Dar lance". Fundo `ocre`, texto `sobreOcre`, borda 3px, sombra 5px, Big Shoulders 900 22px, `min-height: 52px`, padding `10px 26px 8px`, raio 0. Pressionado: translada 3px, sombra 2px. Só um por tela. Na Sala o botão "Dar lance" é maior (900 30px, `min-height: 64`, sombra 6px).

### botao-secundario
"Copiar link". Fundo `papel`, texto `tinta`, borda 3px, sombra 5px, Big Shoulders 800 20px, padding `10px 22px 8px`.

### botao-desabilitado
"Lote fechado". Fundo `suave`, texto `tinta2`, `3px dashed tinta2`, sem sombra, Big Shoulders 800 20px. Usar `disabled` e cursor padrão; o ponteiro clicável observado em CriarLote não é contrato.

### placa-lance
Cada dígito do lance atual é uma placa de painel flip: fundo `painel`, dígito `#F5EEDF` Plex Mono 600 40px, 40×60px, ponto de milhar de 16px de largura, raio 3px, linha central `#000` de 2px. O sufixo ",00" fica ao lado em Plex Mono 20px. A troca usa `la-vira` (rotateX 90°→0, .5s, atraso .06s por dígito). O container expõe `aria-label="Lance atual R$ ..."` e as placas são `aria-hidden`.

### placar-posicao
Faixa de posição do licitante. Borda 3px, padding `12px 16px 10px`, texto `sobreCor`/`#F5EEDF`, Big Shoulders 900 30px caixa-alta mais contador Plex Mono 13px. "Você está ganhando" em fundo `verde` ("1º de N"); "Você foi superado" em fundo `ferrugem` ("2º de N"). Acompanha `chip-licitante`: Plex Mono 14px, borda 2px, padding `3px 8px`; "VOCÊ" com fundo `ocre` e peso 600.

### faixa-status
Faixa de topo do painel de lance na Sala, `aria-live="polite"`. Título Big Shoulders 900 `clamp(30px,..,42px)` caixa-alta, subtítulo Plex Mono 13px. Fundo e texto por estado: ganhando `verde`/`sobreCor`; superado `ferrugem`/`sobreCor`; arrematou pelo usuário `verde`; martelo batido para outro e visitante `tinta`/`fundo`. Textos literais: "Você está ganhando", "Você foi superado", "Você arrematou", "Martelo batido", "Você está assistindo".

### mensagem-recusa
"Sempre colada ao botão." Caixa `2px dashed ferrugem`, texto `ferrugem`, padding `8px 10px`, Newsreader 15px lh 1.35, ícone SVG 18×18 (círculo cortado, traço 2px, `aria-hidden`), `role="alert"`. Cor, ícone e texto juntos: nunca só cor. Quando a recusa é de saldo, ganha o link "Depositar na carteira →" em `ferrugem` peso 600. Só "mínimo" e "saldo" pintam a borda do campo em `ferrugem`. Textos de recusa vêm do manual do design e do EXPERIENCE.md, não deste documento.

### recibo
Plex Mono 17px lh 1.7, fundo `papel`, `2px dashed #8A8273` (`tracejado`), padding `14px 16px`. Linhas rótulo/valor (LOTE, LANCE, PRAZO, LICITANTE, HASH). O comprovante público monta o recibo em cinco faixas sobrepostas (cabeçalho, picote, corpo, picote, rodapé com hash e código de barras decorativo), girado -1° com `drop-shadow(8px 8px 0)`.

### cartao-lote
Todo o cartão é um `<a>`. Fundo `papel`, borda 3px, sombra 6px, raio 0. Etiqueta de lote acima, `top:0; left:20px`, rotação -4° (vivo), 3° (agendado), -2° (encerrado). Imagem de 200px de altura (fundo `suave` com pontilhado `pontos` 8px; foto do snapshot com `object-fit: contain`, sem recortar o carro; ilustração SVG quando não houver foto ou ela falhar). Título Big Shoulders 900 32px, meta Plex Mono 13px ("ano · combustível · FIPE R$ X"), divisória tracejada e rodapé por variante:

- **Ao vivo:** `selo-ao-vivo` no canto, "LANCE ATUAL" + valor Plex Mono 600 22px + "N lances" e `cronometro` compacto (Plex Mono 28px).
- **Agendado:** selo "ABRE ..." (Plex Mono 12px, fundo `papel`, borda 3px), "LANCE INICIAL", caixa "ABERTURA" com dia (Big Shoulders 900 26px) e hora.
- **Encerrado:** ilustração a `opacity .55` com carimbo central de 184px de largura ("Arrematado" ou "Sem lances"), rodapé "RESULTADO".

### cartao-canhoto
Cartão "ingresso" com picote e stub. Usado em "Como funciona" (número gigante 76px em `ocre` com traço `-webkit-text-stroke: 3px linha`, título 26px, texto 17px, rodapé tracejado "CANHOTO / Nº 0X") e em "Meus arremates" (stub de 112px com "LOTE" + número 52px, separado por borda tracejada de 3px, bloco central, bloco de valores com borda esquerda tracejada de 2px). O `picote` tem 24px de altura, linha `2px dashed tracejado` (`left/right:20px; top:11px`) e dois semicírculos de 24×24 nas laterais, com fundo da página. "O picote separa o que se destaca."

### chip-saldo
Chip no cabeçalho do licitante: "DISPONÍVEL R$ X,00", link para a Carteira. Borda 3px `linha`, fundo `papel`, Plex Mono 13px. Ao lado, o chip de identidade mostra somente "VOCÊ · LICITANTE" ou "VOCÊ · LEILOEIRO", sem pseudônimo global. O pseudônimo pertence ao lote. O link do saldo tem alvo mínimo 44px e padding 8px 12px; o marcador VOCÊ usa ocre.

### campo
Campos de formulário (só nas telas, não no manual). Rótulo em Plex Mono 12px caixa-alta. Caixa com borda 3px `linha`, raio 0.
- **Cadastro/login:** `min-height: 50px`, Newsreader 19px, fundo `fundo`. Erro: `aria-invalid` e borda `ferrugem`.
- **Lance:** campo composto com prefixo "R$" (Plex Mono 600 18px), input numérico (Plex Mono 600 28px, `min-height: 56px`), sufixo fixo ",00". Atalhos `botao-atalho` ("+ R$ 500", "+ R$ 1.000", "+ R$ 5.000"; 44px, borda 2px, Plex Mono 14px).
- **Depósito:** valores rápidos em grade de 3 colunas (selecionado: fundo `ocre`, texto `sobreOcre`, sombra 4px; `aria-pressed`) e "outro valor" em Plex Mono 24px.
- **Selects e busca (Vitrine):** 48px de altura.
- Foco usa `{components.foco}`; placeholder usa `tinta2` e nunca substitui o rótulo; desabilitado usa `suave`/`tinta2` e sem sombra. Erro tem mensagem textual ligada ao campo.

### tabela
Tabelas de extrato (min-width 560px), painel do leiloeiro (760px) e auditoria (780px). Fundo `papel`, borda 3px, sombra 6px, rolagem horizontal no celular. Linhas separadas por `2px dashed tracejado`. `th scope="col"`. Rótulos de coluna em Plex Mono caixa-alta; valores em Plex Mono; tipo de movimento em Big Shoulders caixa-alta. Na auditoria, cada linha tem borda esquerda de 6px com a cor do veredito; linhas "NÃO CONFERE" ficam sobre `falha`; linhas "ELO QUEBRADO" a `opacity .62`. Cabeçalho Plex Mono 11px, peso 500, tracking .12em, cor `tinta2`, padding 12px 8px (20px nas extremidades), borda inferior 3px `linha`; células com padding 14px 8px (20px nas extremidades), altura automática. Ações preservam alvo mínimo 44px. Valores extraídos do Painel.

### aba-filtro
Botões `aria-pressed` em grupo. Vitrine: "Todos / Ao vivo / Agendados / Encerrados". Arremates: "Todos / Em disputa / Arrematados / Perdidos" com contador Plex Mono de 2 dígitos. Ativa: fundo `tinta`, texto `fundo`; inativa transparente. Altura de 48px. O nome "pill" do protótipo não altera `{rounded.nenhum}`: filtros têm canto reto.

### Outros
- **selo-prorrogacao** "+2 MIN": fundo `ocre`, texto `sobreOcre`, borda 3px, Big Shoulders 900 (18px no manual, 22px na Sala), padding `2px 8px 0`, rotação -6°, animação `la-mais`.
- **Abas de acesso** ("Criar conta" / "Entrar"): ativa `papel`/`tinta`, inativa `suave`/`tinta2`, `top:3px` para encaixar na borda do cartão.
- **Bilhetes de papel** (licitante/leiloeiro): selecionado `ocre`/`sobreOcre` com `drop-shadow(5px 5px 0)`; não selecionado `papel`.
- **Links:** `a { color: tinta }`, `a:hover { color: ferrugem }`.

### Movimento
Keyframes do design: `la-pulsa` (opacidade 1 → .35 → 1; 1.2s em pontos e selo, 1s em cronômetro de alerta, .7 a .8s em estados de consulta), `la-vira` (placa gira em rotateX 90° → 0, .5s), `la-bate` (carimbo, escala 2.6 → 1 com cubic-bezier(.2,.8,.3,1), .55–.6s), `la-mais` (selo "+2 MIN" sobe e fixa, .6s), `la-entra` (linha nova do histórico desce de -16px, .4s), `la-marca` (linha nova com flash ocre `rgba(226,165,20,.55)` → 0, 1.6–1.8s), `la-vira`/`la-entra` também no extrato. Todas desligadas por:

```css
@media (prefers-reduced-motion: reduce) { * { animation: none !important } }
```

O cronômetro e o estado dos lances não dependem de animação para comunicar nada.

### Extensões visuais aprovadas e cobertura

**Foco e contraste.** `{components.foco}` aplica-se a links, botões, campos e ao cartão do radio quando o input recebe `:focus-visible`. O halo de papel separa o contorno de superfícies escuras. Foco nunca é removido. Rótulos do relógio usam o literal `rotuloRelogio` sobre `painel`; texto BRASIL é parte decorativa da marca e o link mantém nome acessível LanceAuto. Textos de interface exigem contraste 4,5:1 (3:1 para texto grande); elementos de controle/foco, 3:1. Conferir combinações efetivamente renderizadas nos dois temas, sem transformar os dígitos fantasma em informação obrigatória.

Verificação numérica dos tokens: rótulo #8A8273 sobre painel #141311 = 4,88:1; papel #F5EEDF sobre verde #2E6A3E ou ferrugem #A43C1E = 5,60:1; ferrugem noite #E36A43 sobre papel noite #262420 = 4,73:1. BRASIL branco sobre faixa #E2A514 = 2,18:1: restrito à marca decorativa, nunca reutilizado em texto de interface. Esses cálculos não substituem inspeção do produto renderizado.

**Diálogo de cancelamento.** Peça de papel de até 560px, margem lateral mínima 16px, borda 3px, sombra dura 8px, padding 24px. Identifica lote, irreversibilidade e estorno do saldo comprometido do líder, se houver; sem expor nome ou e-mail. Duas ações que quebram linha: “Voltar” secundária e “Cancelar lote” ocre (única ação primária na camada ativa). O conteúdo sob o diálogo fica inerte. Comportamento de foco e confirmação em EXPERIENCE.md.

**Estados da Sala.** Preservar ficha, posição do painel e histórico. Agendado: etiqueta ocre, abertura e contagem para abrir, sem formulário. Cancelado: carimbo em `tinta2`, aviso e histórico, sem CTA de lance. Zero lances: “Lance inicial” e “Nenhum lance ainda”; licitante sem participação: “Você ainda não deu lance”, faixa neutra. Relógio zerado: “Apurando resultado…” e ação desabilitada até confirmação do servidor. Encerrado sem lances: carimbo tracejado “Sem lances”. Visitante em lote encerrado: “Voltar à vitrine”.

**Loading, vazio e falha.** Reutilizar `{components.estado-feedback}` com texto “Carregando…” e espaço da região preservado; sem skeleton animado obrigatório. Erro usa ferrugem mais texto, e “Tentar novamente” secundário. Falha de rede mantém dados anteriores identificados como desatualizados; sucesso genérico permanece neutro, nunca verde decorativo. Confirmações de formulário ocupam a mesma região de feedback; input com erro preserva o valor digitado. Usar feedback também para inexistente/sem acesso sem simular dados.

**Foto e crédito.** `{components.foto-veiculo}` estende o quadro existente: 200px no cartão; 16:9 na Sala/prévia, largura fluida e `contain`. Não recortar o carro, distorcer ou aplicar filtro de cor à foto. Crédito e licença ficam abaixo em legenda com links legíveis; em cartão inteiramente clicável, links de crédito ficam fora da âncora principal para não aninhar links. Ausência/falha usa SVG por carroceria e nota “Imagem ilustrativa”. A imagem armazenada no snapshot é a fonte; os mocks mostram enquadramento e fallback, sem inventar foto licenciada.

**Tema.** Seguir `prefers-color-scheme` por padrão. Se o seletor opcional for implementado, usar select nativo “Tema” com Sistema/Claro/Noite, altura 48px e tokens de campo, persistindo somente a escolha local. Sistema acompanha mudanças do SO; preferência manual prevalece. Os grupos `colors.claro`/`colors.noite` e valores PAL são exceção intencional de compatibilidade à spec plana de cores. Os literais fixos permanecem fixos.

**Variantes e mobile.** Logo de interface 28–30px/raio 7px; display da Sala 58px; selo de Sala 22px; `painel` noite #0B0B0A. Valores maiores do manual são amostras, não substituem variantes de tela. Painel reusa cards fluidos e tabela de 760px em região rolável; Criar lote empilha grupos e prévia sem mudar a sequência do formulário. Navegação quebra linha. Sem posicionamento fixo que cubra o formulário ou o foco. Não criar sidebar, menu hambúrguer ou fluxo mobile novo.

| Superfície | Referência visual preservada | Cobertura complementar |
|---|---|---|
| Vitrine | [Vitrine](design/project/Vitrine.dc.html), claro/noite/mobile | Foto e loading por tokens; spine-only |
| Acesso | [Acesso](design/project/Acesso.dc.html), cadastro/login/mobile | Erros, foco e loading por tokens; spine-only |
| Sala | [Sala](design/project/Sala.dc.html), variantes de posição/recusa/visitante/noite/mobile | Estados ausentes e quadro de imagem no mock complementar |
| Carteira | [Carteira](design/project/Carteira.dc.html), claro e mobile noite | Tema desktop noite e feedback por tokens; spine-only |
| Meus arremates | [Arremates](design/project/Arremates.dc.html), claro e mobile noite | Vazios, cancelados e desktop noite por contrato; spine-only |
| Comprovante | [Comprovante](design/project/Comprovante.dc.html), dois temas/mobile | Falha/inexistente por contrato; spine-only |
| Painel | [Painel](design/project/Painel.dc.html), claro/noite | Reflow mobile e diálogo no mock complementar |
| Criar lote | [CriarLote](design/project/CriarLote.dc.html), normal/FIPE indisponível | Reflow mobile e prévia no mock complementar |
| Auditoria | [Auditoria](design/project/Auditoria.dc.html), íntegro/adulterado/mobile noite | Desktop noite, sem lances e cancelamento por contrato; spine-only |

[Mock complementar local](ux-designs/ux-eliteDevLeilao-2026-10-22/mockups/estados-complementares.html): referência estática em quatro grupos, sem rede, com fallbacks de fontes do sistema. Cobre composição, não execução de transações. A cobertura spine-only segue a autorização geral para recomendações; nenhum estado depende de uma nova decisão visual.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Um único botão ocre por tela; ocre é a única cor que pede clique | Dois botões ocre, ou ocre decorativo fora de ação/etiqueta/"VOCÊ" |
| Verde só para "ganhando" e "íntegro" | Verde para sucesso genérico, confirmação ou decoração |
| Ferrugem para superado, tempo acabando, adulterado e erro | Ferrugem como cor de marca ou ênfase neutra |
| Bordas de 3px e sombras duras 6/6/0 (botão 5/5/0) em cor `sombra` | Qualquer sombra borrada, gradiente ou glow |
| Canto reto (0 a 2px) | Cantos arredondados, pílulas decorativas |
| Cartaz sempre em caixa-alta, entrelinha apertada, Big Shoulders 800–900 | Caixa mista em títulos, botões ou carimbos |
| Dados verificáveis (lote, R$, cronômetro, pseudônimo, hash) em IBM Plex Mono | Valores monetários ou hashes em Newsreader ou Big Shoulders |
| Carimbos rotacionados entre -7° e +4°, assentando em -6° ao encerrar | Carimbos retos ou rotações fora dessa faixa |
| Recusa colada ao botão, com cor, ícone e texto | Recusa só por cor, ou longe da ação que a causou |
| Cordão da etiqueta saindo do furo; picote para separar peças | Etiqueta sem furo, picote decorativo sem função |
| Respeitar `prefers-reduced-motion` | Animação essencial que não possa ser desligada |
| Reflow com `flex-wrap`, `clamp()` e `grid auto-fit` | Layout dependente de media queries de largura |
| Cinco cores, três fontes, nos dois temas | Cores novas fora do `PAL` e dos literais fixos listados |
