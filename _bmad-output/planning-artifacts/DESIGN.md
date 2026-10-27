---
name: LanceAuto
description: Sistema visual "Azul de leilão" (Rev. 04, out/2026) da casa de leilões de carros LanceAuto. Moderno e sóbrio, com cantos arredondados, bordas finas e sombras suaves, em Manrope. Paleta azul (#0033A0, #174BC2, #001E63, #E8EFFF) em dois temas, claro e noite. Substitui o "Manual de pátio" (Rev. 03, neo-brutalista).
status: draft
revision: '04'
updated: 2026-10-27
referencia-aprovada: cabeçalho (escopo .cabecalho em apps/web/src/app/globals.css)
colors:
  # Tema claro. As chaves são os nomes dos tokens do código (--c-<chave>, em kebab-case). Nenhum nome existente foi renomeado.
  claro:
    fundo: '#F7F9FF'            # página (igual ao fundo do cabeçalho)
    papel: '#FFFFFF'            # superfície: cartões, campos, tabelas, diálogos
    suave: '#E8EFFF'            # azul suave: áreas informativas, linha de cabeçalho de tabela, fundo de foto
    pontos: '#D3DCF0'           # contorno decorativo de foto e miniaturas
    borda: '#D3DCF0'            # NOVO. Fio decorativo de cartão, divisor e linha de tabela
    tracejado: '#AEBBD6'        # só no picote do comprovante e do canhoto
    tinta: '#0F1B33'
    tinta2: '#4B5870'
    linha: '#6F83AD'            # borda de CONTROLE (campo, atalho, filtro inativo): 3:1 mínimo
    sombra: '#001E63'           # cor-base das sombras (usada com transparência)
    ocre: '#0033A0'             # NOME PRESERVADO. Guarda o azul principal: fundo do botão primário
    ocreHover: '#174BC2'        # NOVO. Hover do primário (azul interativo)
    ocreTexto: '#0033A0'        # link e texto de destaque
    sobreOcre: '#FFFFFF'
    selecionado: '#E8EFFF'      # NOVO. Fundo de item ativo ou selecionado
    foco: '#174BC2'             # NOVO. Anel de foco
    destaque: '#0033A0'         # NOVO. Indicador ativo (sublinhado de menu, borda de avatar)
    ferrugem: '#B42318'         # NOME PRESERVADO. Erro, superado, adulterado, cancelado
    falha: 'rgba(180, 35, 24, 0.09)'
    verde: '#1E7A46'            # NOME PRESERVADO. Ganhando e íntegro
    verdeSuave: '#E7F5EC'       # NOVO
    alerta: '#8A4B00'           # NOVO. Urgência e aviso (âmbar)
    alertaSuave: '#FFF3DC'      # NOVO
    sobreAlerta: '#FFFFFF'      # NOVO
    sobreCor: '#FFFFFF'         # texto sobre verde e sobre ferrugem
    painel: '#0B1530'           # display do cronômetro e das placas de lance
    led: '#F2B92B'
    ledAlerta: '#FF6A3D'
  noite:
    fundo: '#0F1216'
    papel: '#151A21'
    suave: '#1C2330'
    pontos: '#2A3341'
    borda: '#313A47'
    tracejado: '#4A5568'
    tinta: '#F3F5F8'
    tinta2: '#9BA7B8'
    linha: '#6F7C90'
    sombra: '#000000'
    ocre: '#174BC2'             # no noite o fundo do primário é o azul interativo (o #0033A0 não aparece sobre #151A21)
    ocreHover: '#2459D6'
    ocreTexto: '#6B93FF'        # token de apoio do texto azul no escuro
    sobreOcre: '#FFFFFF'
    selecionado: '#001E63'      # azul profundo
    foco: '#8AAAFF'
    destaque: '#3D6DFF'
    ferrugem: '#FF8A7A'
    falha: 'rgba(255, 138, 122, 0.14)'
    verde: '#5FD08A'
    verdeSuave: '#12271B'
    alerta: '#F2B65A'
    alertaSuave: '#2B2010'
    sobreAlerta: '#0F1216'
    sobreCor: '#0F1216'
    painel: '#070B14'
    led: '#F2B92B'
    ledAlerta: '#FF6A3D'
  # Literais fixos, iguais nos dois temas.
  fixas:
    azul: '#0033A0'
    azulInterativo: '#174BC2'
    azulProfundo: '#001E63'
    azulSuave: '#E8EFFF'
    faixaPlaca: '#0033A0'
    brasilTexto: '#FFFFFF'
    digitoPlaca: '#F3F5F8'
    linhaCentralPlaca: '#000000'
    rotuloRelogio: '#9FB0CF'
    rotuloNotaPainel: '#9FB0CF'
    logoPlacaNoCabecalhoClaro: '#14181F'
    logoPlacaNoNoite: '#F5EEDF'
typography:
  familia: Manrope (única; variável --font-manrope)
  pesos: '400, 500, 600, 700, 800'
  numeros: 'font-variant-numeric: tabular-nums em valores em R$, cronômetro, contadores, lance e hash'
  display-hero: { fontSize: 'clamp(48px, 8vw, 112px)', fontWeight: '800', lineHeight: '0.95', transform: uppercase }
  display-titulo: { fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: '800', lineHeight: '0.98', transform: uppercase }
  display-secao: { fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: '800', lineHeight: '1', transform: uppercase }
  cartaz-cartao: { fontSize: 26px, fontWeight: '700', lineHeight: '1', transform: uppercase }
  placar: { fontSize: 30px, fontWeight: '800', lineHeight: '1', transform: uppercase }
  numero-lote: { fontSize: 52px, fontWeight: '800', lineHeight: '1' }
  botao-primario: { fontSize: 16px, fontWeight: '600', lineHeight: '1', letterSpacing: '0', transform: none }
  botao: { fontSize: 15px, fontWeight: '600', lineHeight: '1', letterSpacing: '0', transform: none }
  botao-compacto: { fontSize: 14px, fontWeight: '600', lineHeight: '1', transform: none }
  selo: { fontSize: 12px, fontWeight: '700', lineHeight: '1', letterSpacing: '0.06em', transform: uppercase }
  rotulo: { fontSize: 12px, fontWeight: '700', letterSpacing: '0.08em', transform: uppercase }
  body-lead: { fontSize: 18px, fontWeight: '400', lineHeight: '1.4' }
  body: { fontSize: 16px, fontWeight: '400', lineHeight: '1.45' }
  body-nota: { fontSize: 15px, fontWeight: '500', lineHeight: '1.35' }
  body-legenda: { fontSize: 13px, fontWeight: '500', lineHeight: '1.3' }
  dado: { fontSize: 14px, fontWeight: '500', lineHeight: '1.3' }
  cronometro: { fontSize: 40px, fontWeight: '700', lineHeight: '1' }
rounded:
  chip: 6px          # rounded-md: selos pequenos, itens de menu
  controle: 8px      # rounded-lg: botões, campos, filtros (igual aos botões do cabeçalho)
  cartao: 12px       # rounded-xl: cartões, tabelas, avisos, cronômetro
  painel: 16px       # rounded-2xl: diálogos, painel de lance, cartão "Disponível"
  pilula: 9999px     # rounded-full: selos, filtros, botões de ícone, avatar
  # Preservados (logo e círculos): placa 3px, logo-interno 6px, logo-tela 7px, logo 10px, circulo 50%
spacing:
  base: 4px
  escala: '4, 8, 12, 16, 20, 24, 32, 40, 48, 64'
  cartao-padding: '20px (16px abaixo de 640px)'
  gutter-lateral: 'clamp(16px, 4vw, 56px)'
  container-max: 1320px
  container-comprovante: 1200px
  alvo-minimo: 44px
  controle-altura: '44px (padrão) | 40px (compacto, só cabeçalho) | 56px (lance na Sala)'
borders:
  fio: 1px           # cartão, tabela, divisor, campo, botão secundário
  destaque: 2px      # campo com erro, linha ativa de menu, etiqueta do lote
  anel-foco: 3px
shadows:
  claro:
    nenhuma: none
    xs: '0 1px 2px rgba(0, 30, 99, 0.20)'                                      # botão primário
    cartao: '0 1px 2px rgba(0, 30, 99, 0.06), 0 4px 14px -8px rgba(0, 30, 99, 0.22)'
    elevada: '0 8px 24px -12px rgba(0, 30, 99, 0.40)'                           # hover de cartão, menu do perfil
    modal: '0 24px 48px -20px rgba(0, 30, 99, 0.45)'
  noite:
    # No escuro a elevação vem do tom da superfície e do fio, não da sombra. Sombra só em menu e diálogo.
    cartao: none
    elevada: '0 8px 24px -12px rgba(0, 0, 0, 0.60)'
    modal: '0 24px 48px -16px rgba(0, 0, 0, 0.70)'
---

## 1. Direção visual

**O que muda.** O "Manual de pátio" (papel, tinta, bordas de 3px, sombras duras, cantos retos, três fontes) sai. Entra a linguagem do cabeçalho aprovado: superfícies claras e limpas, **fios de 1px**, **cantos de 8 a 16px**, **sombras suaves e curtas**, hover e foco bem definidos, e o azul `#0033A0` como única cor de marca. O site inteiro passa a falar como os botões "Entrar" e "Criar conta": compactos, arredondados e com resposta ao toque.

**O que fica.**
- **Manrope** como única família. Tamanhos e hierarquia dos títulos não mudam.
- **O logo**: placa Mercosul com faixa azul. No cabeçalho aprovado a placa **inverte com a barra** (escura na barra clara, clara no tema noite). Decisão do Felipe, confirmada em 27/10.
- **A etiqueta do lote em faixa própria** no cartão, com furo, cordão e leve inclinação.
- **O cronômetro** com `tabular-nums` e `nowrap`, em display escuro de LED, e as placas de lance que viram.
- **O tom de leilão**: confiança e clareza no dia a dia, urgência só no último momento (âmbar e LED laranja).
- **Valores em reais inteiros**, dados que se conferem (lote, R$, hash) em algarismos tabulares, e textos canônicos intactos.

**Princípios.**
1. Azul é ação e marca; o resto é neutro azulado. Um botão primário por tela (ou por camada, no diálogo).
2. Cor nunca sozinha: todo estado tem texto e, quando cabe, ícone.
3. Calma por padrão, urgência por exceção. O âmbar e o LED laranja só aparecem quando o tempo acaba.
4. Superfície primeiro, sombra depois. No claro a sombra é leve; no noite quem eleva é o tom da superfície.

## 2. Tokens

### 2.1 Onde cada cor da paleta entra

| Paleta | Claro | Noite |
|---|---|---|
| **#0033A0** Azul principal | Fundo do botão primário, link, texto de destaque, faixa do logo, borda do botão secundário, valor de saldo, cartão "Disponível" | **Não** vira texto nem borda (1,65:1 sobre `papel`). Fica na faixa do logo, no estado pressionado do primário e no avatar. Texto azul usa `ocreTexto` `#6B93FF` |
| **#174BC2** Azul interativo | Hover do primário, anel de foco, controle ativo | **Fundo do botão primário** (`ocre`), com `#2459D6` no hover |
| **#001E63** Azul profundo | Pressionado do primário, cor-base das sombras | **Fundo de item selecionado** (`selecionado`), cartão "Disponível", avatar |
| **#E8EFFF** Azul suave | `suave` e `selecionado`: filtro ativo, badge informativo, cabeçalho de tabela, fundo de foto, hover do secundário | Não é usado. O equivalente é `suave` `#1C2330` (neutro) e `selecionado` `#001E63` |

### 2.2 Tokens semânticos

| Papel | Token (`--c-*`, Tailwind) | Claro | Noite |
|---|---|---|---|
| Fundo da página | `fundo` | `#F7F9FF` | `#0F1216` |
| Superfície | `papel` | `#FFFFFF` | `#151A21` |
| Superfície suave / informativa | `suave` | `#E8EFFF` | `#1C2330` |
| Borda decorativa | `borda` (novo) | `#D3DCF0` | `#313A47` |
| Borda de controle | `linha` | `#6F83AD` | `#6F7C90` |
| Texto | `tinta` | `#0F1B33` | `#F3F5F8` |
| Texto secundário | `tinta2` | `#4B5870` | `#9BA7B8` |
| Primário (fundo de botão) | `ocre` | `#0033A0` | `#174BC2` |
| Texto sobre o primário | `sobreOcre` | `#FFFFFF` | `#FFFFFF` |
| Link e texto azul | `ocreTexto` | `#0033A0` | `#6B93FF` |
| Hover do primário | `ocreHover` (novo) | `#174BC2` | `#2459D6` |
| Selecionado | `selecionado` (novo) | `#E8EFFF` | `#001E63` |
| Foco | `foco` (novo) | `#174BC2` | `#8AAAFF` |
| Indicador ativo | `destaque` (novo) | `#0033A0` | `#3D6DFF` |
| Erro | `ferrugem` / `falha` | `#B42318` / 9% | `#FF8A7A` / 14% |
| Sucesso (ganhando, íntegro) | `verde` / `verdeSuave` (novo) | `#1E7A46` / `#E7F5EC` | `#5FD08A` / `#12271B` |
| Alerta e urgência | `alerta` / `alertaSuave` / `sobreAlerta` (novos) | `#8A4B00` / `#FFF3DC` / `#FFF` | `#F2B65A` / `#2B2010` / `#0F1216` |
| Texto sobre verde ou ferrugem | `sobreCor` | `#FFFFFF` | `#0F1216` |
| Display do cronômetro | `painel` | `#0B1530` | `#070B14` |

### 2.3 Cada token novo, justificado

| Token | Por que existe |
|---|---|
| `borda` | Antes `linha` fazia dois trabalhos: contorno de cartão e borda de controle. Contorno de cartão pode ser quase invisível (1,38:1, decorativo); borda de campo precisa de 3:1. Separar evita escurecer todos os cartões só para os campos passarem. |
| `linha` (valor novo) | Antes era `#8FA3CF`, com 2,53:1 sobre branco, abaixo do mínimo de 3:1 para identificar um campo. `#6F83AD` dá 3,80:1. |
| `ocreHover` | O hover do primário saiu do cabeçalho (`--h-cta-hover`) e vale para o site todo. No claro é o azul interativo da paleta; no noite, `#2459D6` (branco sobre ele: 6,04:1). |
| `selecionado` | A paleta pede `#E8EFFF` para filtros e áreas informativas e `#001E63` para destaque no escuro. Sem este token, `suave` teria de ser azul-marinho no noite, e foto e botão desabilitado ficariam pesados. |
| `foco` | O foco antigo usava `tinta` (preto ou branco). O anel azul tem a cara da marca e passa 3:1 em todas as superfícies (tabela 6). |
| `destaque` | Era `--h-azul` no cabeçalho: sublinhado do menu ativo e borda do avatar. No noite, `#3D6DFF` dá 4,02:1 sobre `papel`, bom para elementos gráficos, mas não para texto. |
| `verdeSuave` | Painéis de "ganhando" e "íntegro" precisam de fundo tintado, sem gritar. |
| `alerta`, `alertaSuave`, `sobreAlerta` | A paleta azul não tem cor de urgência. Âmbar escuro lê como "atenção" sem se confundir com o vermelho do erro. É a cor do estado "encerrando". |
| `falha` (valor novo) | Mantém o nome. Passa a tingir qualquer fundo de erro, não só a linha da auditoria. |
| `ferrugem`, `verde` (valores novos) | Nomes preservados. `ferrugem` sai do marrom-alaranjado para um vermelho frio (`#B42318`) que combina com o azul e passa 6,57:1. `verde` escurece um pouco para passar 5,35:1 com texto branco. |
| `painel`, `rotuloRelogio`, `rotuloNotaPainel`, `digitoPlaca` (valores novos) | O display deixa o preto-quente e vai para azul-quase-preto, coerente com o resto. O rótulo antigo `#8A8273` fechava 4,74:1; `#9FB0CF` fecha 8,23:1. |

**`ocre` guarda azul.** O nome está sob análise e **não foi renomeado**. Neste documento "primário" é o papel; `ocre`, `ocreHover` e `ocreTexto` são os nomes de código. Ver P5.

### 2.4 Promoção dos tokens do cabeçalho

Os tokens locais `--h-*` de `.cabecalho` ganham equivalentes globais. O cabeçalho continua com os mesmos valores.

| Hoje (só no cabeçalho) | Passa a ser |
|---|---|
| `--h-cta` | `--c-ocre` |
| `--h-cta-hover` | `--c-ocre-hover` |
| `--h-azul` | `--c-destaque` |
| `--h-botao-texto` | claro `--c-ocre-texto`; noite `--c-tinta` |
| `--h-botao-borda` | claro `--c-ocre`; noite `--c-linha` (`#6F7C90` no lugar de `#5A6678`: 4,13:1 no lugar de 3,00:1) |
| `--h-valor`, `--h-ativo-texto` | `--c-ocre-texto` (claro) e `--c-tinta` (noite) |
| `--h-divisor` | `--c-borda` |

### 2.5 Raios, bordas e espaçamento

- **Raios** (frontmatter `rounded`): botão, campo e filtro 8px; cartão, tabela, aviso e cronômetro 12px; diálogo, painel de lance e cartão "Disponível" 16px; selo, filtro-pílula, botão de ícone e avatar em pílula. Nada fica com raio 0, exceto o picote (ver 4.12).
- **Bordas**: fio de 1px em quase tudo. 2px só em campo com erro, etiqueta do lote e linha ativa do menu. O tracejado sai, e fica só no picote do comprovante e do canhoto.
- **Espaçamento**: base de 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Cartão 20px (16px no celular). Entre cartões da grade: 24px. Contêiner, gutter e `clamp()` continuam como estão. O reflow segue sem breakpoints novos.

### 2.6 Elevação

| Nível | Uso | Claro | Noite |
|---|---|---|---|
| 0 | Campo, linha de tabela, selo | só fio | só fio |
| 1 `cartao` | Cartão, tabela, aviso, painel | `shadows.claro.cartao` | superfície `papel` + fio `borda` |
| 2 `elevada` | Hover de cartão, menu do perfil, seletor | `shadows.claro.elevada` | superfície `suave` + fio + sombra preta |
| 3 `modal` | Diálogo | `shadows.claro.modal` | idem, mais forte |

Mapa para o Tailwind, **sem trocar os nomes**: `shadow-cartao` → nível 1; `shadow-painel` → nível 2; `shadow-botao` → `xs`; `shadow-botao-ativo` → nenhuma; `shadow-chip` → nenhuma. Chave nova: `shadow-modal`. Sem gradiente e sem brilho. A única exceção é o brilho azul do logo dentro do cabeçalho noite, que já está aprovado.

### 2.7 Movimento

Troca de cor, borda e sombra em 150ms `ease-out`. Pressionar leva o botão 1px para baixo. Cartão no hover sobe a sombra para o nível 2 em 200ms, sem mover o cartão. Os keyframes `la-pulsa`, `la-vira`, `la-bate`, `la-mais`, `la-entra` e `la-marca` continuam. `la-bate` assenta em no máximo -3° (antes -6°). Tudo desliga com `prefers-reduced-motion`, e nenhum estado depende de animação.

## 3. Tipografia

Só a Manrope. Os tamanhos dos títulos (`.t-display-*`, `.t-cartaz-*`, `.t-placar`, `.t-numero-lote`) e do corpo (`.t-body*`) ficam como estão no código. Três ajustes de acabamento:

1. **Botões em caixa normal**: 16px/600 (primário) e 15px/600 (secundário), como "Entrar" e "Criar conta" (14px/600, compacto). Caixa-alta fica para títulos, rótulos e selos.
2. **Selos** em 12px/700, caixa-alta, tracking .06em.
3. **Dados que se conferem** (R$, cronômetro, contadores, lance, hash) usam `tabular-nums`. Sem fonte monoespaçada, o alinhamento vem daí.

A regra de reais inteiros continua. A UI mostra `R$ 1.500`, nunca centavos.

## 4. Componentes

Convenção: "papel" = `papel`, "fio" = 1px `borda`. Classes entre crases são sugestão de Tailwind. Tudo vale para claro e noite, trocando só o token.

### 4.1 Botões

| Variante | Repouso | Hover | Pressionado |
|---|---|---|---|
| **Primário** | fundo `ocre`, texto `sobreOcre`, sem borda (noite: borda 1px `destaque`), `shadow xs` | fundo `ocreHover` | claro `#001E63`, noite `#0033A0`; desce 1px; sem sombra |
| **Secundário** | fundo transparente, borda 1px (claro `ocre`, noite `linha`), texto (claro `ocreTexto`, noite `tinta`) | fundo `suave`, borda `ocre`/`ocreTexto` | desce 1px |
| **Fantasma** | sem borda, texto `ocreTexto` | fundo `selecionado` | desce 1px |
| **Perigo (secundário)** | borda 1px e texto `ferrugem` | fundo `falha` | desce 1px |
| **Perigo (sólido)** | fundo `ferrugem`, texto `sobreCor` | `ferrugem` 90% | desce 1px |
| **Desabilitado** | fundo `suave`, borda `borda`, texto `tinta2`, sem sombra, `cursor: not-allowed` | sem mudança | sem mudança |
| **Carregando** | mantém a variante, largura fixa, spinner de 16px antes do texto de `loadingText`, `aria-busy`, `cursor: progress` | sem mudança | ignora clique |

- **Medidas**: padrão 44px de altura, `rounded-lg`, `px-5`. **Compacto** 40px (cabeçalho, tabelas), `px-4`, 14px. **Sala** ("Dar lance") 56px, `rounded-xl`, largura total, 18px/700. Com `pointer: coarse`, o compacto sobe para 44px (decidido).
- **Perigo sólido** só no passo final de confirmação (ex.: "Cancelar lote"). Ele ocupa o lugar do primário daquela camada, então a regra de um único primário continua valendo.
- **Foco**: ver 6.2. Anel `foco` de 3px com 2px de afastamento, em todas as variantes.
- **Links-botão** (`<a>`) usam as mesmas classes. O `!` nas cores continua necessário por causa da regra global `a { color }`.
- **Botão de atalho** ("+ R$ 500"): pílula de 44px, fio `linha`, texto `tinta`, `tabular-nums`. Selecionado: fundo `selecionado`, borda `ocre`/`ocreTexto`, `aria-pressed`.
- **Botão de ícone** (olho do saldo, tema): círculo de 44px, fio `linha`, fundo `papel`, hover `suave`. O ícone ativo do tema usa `ocre` e `sobreOcre`.

### 4.2 Links

Cor `ocreTexto`. Em texto corrido, **sempre sublinhado** (`underline-offset: 3px`), porque o azul sozinho não se distingue do texto. Em navegação e ações, sem sublinhado. O hover vai para `ocreHover` (claro) ou `tinta` (noite) com sublinhado. O `a:hover { ferrugem }` antigo sai: vermelho no hover parecia erro.

### 4.3 Campos de formulário

- **Caixa**: fundo `papel` (noite: `fundo`, para parecer rebaixado), borda 1px `linha`, `rounded-lg`, 48px de altura (mínimo 44px), texto 16px `tinta`. Evita zoom no iOS.
- **Rótulo** acima, 12px/700 caixa-alta `tinta2`. O placeholder usa `tinta2` e nunca substitui o rótulo.
- **Hover**: borda `tinta2`. **Foco**: borda `ocre`/`foco` mais anel de foco. **Desabilitado**: fundo `suave`, texto `tinta2`.
- **Erro**: borda `ferrugem` com 2px visuais (`box-shadow: 0 0 0 1px`), ícone de aviso, mensagem em `ferrugem` abaixo, ligada por `aria-describedby`. Cor, ícone e texto juntos.
- **Campo de lance**: caixa composta, `rounded-xl`, 56px. Prefixo "R$" e sufixo ",00" em `tinta2`; o valor em 24 a 28px/700 `tabular-nums`. Atalhos logo abaixo (4.1). Recusa colada ao botão (4.9).
- **Depósito**: valores rápidos em grade de 3, como botões de atalho; "outro valor" é um campo comum.
- **Selects e busca da Vitrine**: 48px, mesma caixa. Select nativo, com seta própria em `tinta2`.

### 4.4 Selos e badges

Pílula de 24 a 28px: ícone de 14px + texto 12px/700 caixa-alta, padding `4px 10px`, borda de 1px, `rounded-full`. Sem rotação, sem contorno duplo. Fundo tintado, texto e ícone na cor forte. O `Stamp` continua sendo o componente; muda a casca.

| Selo | Fundo | Texto e ícone | Borda | Ícone |
|---|---|---|---|---|
| Informativo / Agendado | `selecionado` | `ocreTexto` | `ocre` 30% | relógio |
| Ao vivo | `ocre` | `sobreOcre` | nenhuma | ponto que pulsa |
| Íntegro / Ganhando | `verdeSuave` | `verde` | `verde` 35% | check |
| Erro / Adulterado / Superado | `falha` | `ferrugem` | `ferrugem` 35% | alerta |
| Alerta / Encerrando | `alertaSuave` | `alerta` | `alerta` 40% | relógio com alerta |
| Neutro / Arrematado | `tinta` | `fundo` | nenhuma | martelo |
| Sem lances | transparente | `tinta2` | `linha` (tracejada) | traço |

**Badge de contagem** (filtros, listas): 20px de altura, mínimo 20px de largura, `rounded-full`, fundo `suave`, texto 12px/700 `tabular-nums`.

**Carimbo de resultado da Sala**: o único elemento "carimbado" que sobra. Cartão de `rounded-xl`, borda 2px na cor do estado, fundo tintado, texto 28 a 40px/800 caixa-alta, inclinação de -3°, animação `la-bate`. Sem inclinação com `prefers-reduced-motion`.

### 4.5 Etiqueta do lote

Fica em **faixa própria** no topo do cartão, fora da foto (alinhada à esquerda, com 16px de recuo). Preserva o recorte chanfrado, o furo, o cordão que sai do furo, "LOTE" pequeno e o número em 36px (compacto) ou 52px/800.

- **Aberto, encerrando e agendado**: preenchimento `ocre`, texto `sobreOcre`, contorno de 2px (claro `#001E63`, noite `ocreTexto`).
- **Encerrado e cancelado**: preenchimento `papel`, texto `tinta`, contorno 2px `linha`. Hoje o cancelado herda o tom azul; passa a usar o neutro.
- Inclinação -4° a +3° (-2° nos encerrados), furo com borda do contorno e fundo `fundo`, cordão `tinta` com traço de 2px. É decorativa e nunca é o único meio de saber o estado.

### 4.6 Cartão de lote

Cartão inteiro clicável (`<a>`): `papel`, fio `borda`, `rounded-xl`, `overflow: hidden`, nível 1. Estrutura:

1. **Faixa da etiqueta**: a etiqueta à esquerda e, à direita, o selo de estado ou o chip de abertura (agendado). Nada cobre a foto.
2. **Foto**: fundo `suave`, `object-fit: contain`, altura 200px, sem filtro nem recorte. Sem foto, SVG por carroceria com "Imagem ilustrativa".
3. **Corpo** (padding 16 a 20px): título em `cartaz-cartao` 26px; meta em 13px `tinta2` ("ano · combustível · FIPE R$ X"); divisor de fio; rodapé por estado.

- **Hover**: sombra no nível 2, borda `ocre` 40%. **Foco**: anel de foco no cartão inteiro.
- **Rodapé ao vivo**: "LANCE ATUAL" (rótulo), valor 20px/800 `tabular-nums`, "N lances" e cronômetro compacto (4.11).
- **Rodapé agendado**: valor inicial e caixa "ABERTURA" (`rounded-lg`, fundo `suave`, dia em 22px/800).
- **Rodapé encerrado**: "RESULTADO", valor e meta. O selo "Arrematado" ou "Sem lances" fica **na faixa da etiqueta**, não sobre a foto. A foto escurece 15% com overlay, sem opacidade no texto.
- **Cancelado**: foto com overlay, selo "Cancelado", título intacto e legível.

### 4.7 Filtros e abas

Pílulas (`rounded-full`, 40px; 44px com `pointer: coarse`), em grupo com `aria-pressed`. Inativa: fio `linha`, texto `tinta2`; hover: fundo `suave`, texto `tinta`. **Ativa**: fundo `selecionado`, texto `ocreTexto`, borda `ocre`, peso 700. O contador vira badge dentro da pílula. Abas de acesso ("Criar conta" e "Entrar") são um controle segmentado: trilho `suave` com `rounded-xl`, aba ativa `papel` com nível 1 e texto `ocreTexto`.

### 4.8 Tabelas e listas

- **Contêiner**: `papel`, fio `borda`, `rounded-xl`, nível 1, `overflow-x: auto` em região focável e identificada. `min-width` de 560 a 780px, como hoje.
- **Cabeçalho**: fundo `suave`, 12px/700 caixa-alta `tinta2`, tracking .06em, padding `12px 16px`. `th scope="col"`.
- **Linhas**: fio `borda` entre linhas, padding `14px 16px`, hover `suave` só se a linha for clicável. Números alinhados à direita, em `tabular-nums`. Ações com alvo de 44px.
- **Auditoria**: faixa de 4px à esquerda na cor do veredito **mais** coluna de texto com ícone ("CONFERE", "NÃO CONFERE", "ELO QUEBRADO"). "NÃO CONFERE" fica sobre `falha`. "ELO QUEBRADO" usa `suave` e texto `tinta2`, **sem `opacity`**, porque a opacidade de .62 derrubava o contraste.
- **Lista de lances (Sala)**: linhas de fio, valor em `tabular-nums`, chip do licitante em pílula de fio. "VOCÊ" usa `selecionado` + `ocreTexto` + peso 700. Linha nova entra com `la-entra` e `la-marca`.

### 4.9 Avisos, recusas e toasts

Todos são o mesmo bloco: `rounded-xl`, borda 1px, padding `12px 16px`, ícone de 20px à esquerda e texto em `tinta` (a cor forte fica no ícone e na borda).

| Tipo | Fundo | Borda e ícone | Papel ARIA |
|---|---|---|---|
| Informativo (inclui confirmação genérica) | `selecionado` | `ocre` / `ocreTexto` | `status` |
| Sucesso (só "ganhando" e "íntegro") | `verdeSuave` | `verde` | `status` |
| Alerta | `alertaSuave` | `alerta` | `status` |
| Erro | `falha` | `ferrugem` | `alert` |

- **Recusa do lance** (`RefusalMessage`): erro, colada ao botão, com ícone de círculo cortado, texto e, se for saldo, o link "Depositar na carteira →" em `ocreTexto` sublinhado. Só "mínimo" e "saldo" pintam a borda do campo.
- **Estado de feedback** (carregando, vazio, falha): bloco centrado com fio **sólido** `borda`, `rounded-xl`, `suave`. O tracejado sai. Erro usa o tipo erro com "Tentar novamente" secundário. Falha de rede mantém os dados antigos marcados como desatualizados.
- **Banner de conexão**: alerta, de largura total, abaixo do cabeçalho, sem cobrir conteúdo.
- **Toast**: o app não tem toast hoje. Se aparecer, é o mesmo bloco com nível 2, largura máxima 420px e `role="status"`. Posição e duração são de comportamento, e ficam no EXPERIENCE.md (P7).

### 4.10 Diálogos

`<dialog>` nativo: `papel`, fio `borda`, `rounded-2xl`, nível 3, largura máxima 560px, margem lateral mínima 16px, padding 24px. Título 20px/800; corpo 16px; ações alinhadas à direita e empilhadas no celular, com o primário (ou perigo sólido) por último. Fundo (`::backdrop`): `rgba(5, 12, 32, 0.60)`, sem blur. O conteúdo sob o diálogo fica inerte (comportamento no EXPERIENCE.md). O menu do perfil é um popover pequeno: `rounded-xl`, nível 2, itens de 44px com hover `suave`.

### 4.11 Sala de lances

**Estrutura.** Ficha do carro à esquerda, painel de lance à direita (abaixo no celular), como hoje. Painel: `papel`, fio, `rounded-2xl`, nível 1, padding 24px.

- **Lance atual**: placas flip (`placa-lance`) em `painel`, dígito `digitoPlaca` 40×60px, `rounded-md`, linha central de 2px, sufixo ",00" em 20px. `aria-label="Lance atual R$ …"`, placas `aria-hidden`. A troca usa `la-vira` com atraso de .06s por dígito.
- **Cronômetro**: ver abaixo.
- **Faixa de posição** (`placar-posicao`/`faixa-status`, `aria-live="polite"`): `rounded-xl`, padding `14px 16px`, ícone + título 18 a 22px/800 + contador. "Ganhando" e "Arrematou": `verde`/`sobreCor` (com ícone de check). "Superado": `ferrugem`/`sobreCor` (ícone de seta para baixo). Neutro (visitante, "Martelo batido", "Você está assistindo"): fundo `suave`, texto `tinta`, fio `borda`. Os textos literais não mudam.
- **Botão "Dar lance"**: primário de Sala (4.1). **Recusa** (4.9) logo abaixo.
- **Histórico**: lista da seção 4.8, mais recente no topo.
- **Selo "+2 MIN"**: pílula `ocre`/`sobreOcre` de 22px, `la-mais`, sobre o canto do cronômetro. Pendência conhecida: no cartão, ele cobre parte do rótulo. Passa a ficar **fora do rótulo**: ao lado do tempo, e não no canto (P8).
- **Estados**: agendado (etiqueta azul, abertura e contagem, sem formulário), cancelado (selo "Cancelado" + aviso + histórico, sem CTA), zero lances ("Lance inicial", "Nenhum lance ainda"), "Apurando resultado…" (alerta, ação desabilitada), encerrado (carimbo de resultado, 4.4).

**Cronômetro** (cartão e Sala): display `painel`, fio 1px `linha`, `rounded-xl`, padding `10px 14px`. Rótulo de 12px/700 caixa-alta em `rotuloRelogio`. Dígitos `led`, `tabular-nums`, `white-space: nowrap`, `font-weight: 700`, 24px no cartão e `clamp(32px, 10vw, 44px)` na Sala. Segmentos apagados ("88:88") a 10% de opacidade, só decoração. `role="timer"` e `aria-label="Tempo restante mm:ss"` (atualizado a cada 10s).

| Variante | Rótulo | Dígitos | Borda | Reforço sem cor |
|---|---|---|---|---|
| Normal | RESTAM / TEMPO RESTANTE | `led` | `linha` | rótulo |
| **Encerrando** (≤ 2 min) | ÚLTIMOS 2 MIN | `ledAlerta`, `la-pulsa` 1s | `alerta` 2px | rótulo + ícone de alerta |
| Prorrogado | PRORROGADO | `led` | `linha` | selo "+2 MIN" |
| Apurando | (rótulo da variante) | `led`, sem pulso | `alerta` | texto "Apurando…" |
| Encerrado | ENCERRADO | `led` ("00:00") | `linha` | rótulo |

Com `prefers-reduced-motion` o pulso desliga e o estado "encerrando" continua legível pelo rótulo, pelo ícone e pela borda.

### 4.12 Telas

- **Acesso (conta)**: cartão `rounded-2xl` com controle segmentado (4.7) e campos (4.3). Os bilhetes de perfil ("Licitante" e "Leiloeiro") são cartões selecionáveis `rounded-xl`: selecionado com borda `ocre`, fundo `selecionado` e ícone de check; não selecionado com `papel` e fio. Contas de teste ficam num aviso informativo.
- **Cabeçalho**: sem mudança. Os botões da conta passam a vir das classes globais (4.1, compacto).
- **Carteira**: o cartão "Disponível" é o destaque: claro, fundo `ocre` e texto `sobreOcre`; noite, fundo `selecionado` (`#001E63`) com fio `destaque`. Valor em 40px/800 `tabular-nums`, `rounded-2xl`, nível 1. Depósito em cartão `papel` ao lado; extrato em tabela (4.8). Olho de ocultar saldo como botão de ícone.
- **Meus arremates**: cada lote é um **canhoto** (`rounded-xl`, fio, nível 1) com dois blocos: stub à esquerda ("LOTE" + número) e dados à direita, separados por picote tracejado de 2px com dois semicírculos na cor da página. É o único tracejado que sobrevive, com função: separar o que se destaca. Estado como selo (4.4) na primeira linha; filtros da seção 4.7.
- **Comprovante e recibo**: continua um recibo em faixas com picote, mas em `papel`, `rounded-xl`, fio e nível 2, sem rotação e sem `drop-shadow` duro. Linhas rótulo/valor em `tabular-nums`; o hash em 14px com quebra livre. Código de barras decorativo em `tinta` 70%.
- **Auditoria**: caixa do veredito (`rounded-2xl`) com selo grande "Íntegro" (`verde`) ou "Adulterado" (`ferrugem`), ícone e texto; tabela da seção 4.8; bloco "Como conferimos" em aviso informativo. Hashes em `tabular-nums`, `overflow-wrap: anywhere` (P4).
- **Painel do leiloeiro e Criar lote**: cartões fluidos e tabela de 760px (4.8); Criar lote empilha grupos e prévia sem mudar a sequência. A prévia usa o cartão de lote com a etiqueta "NOVO".

## 5. Estados de lote

Cada estado tem cor, ícone e texto próprios, em selo e em etiqueta. Nenhum depende só da cor.

| Estado (status) | Cor | Selo (texto canônico) | Ícone | Etiqueta | Cronômetro |
|---|---|---|---|---|---|
| **Agendado** (`SCHEDULED`) | azul suave (`selecionado`) | "ABRE …" | relógio | azul | "ABRE EM", `led` |
| **Aberto** (`LIVE`) | azul sólido (`ocre`) | "Ao vivo" | ponto que pulsa | azul | "RESTAM", `led` |
| **Encerrando** (`LIVE` ≤ 2 min; `CLOSING` = "Apurando") | âmbar (`alerta`) | "ÚLTIMOS 2 MIN" no cronômetro e "Apurando…" na Sala | relógio com alerta | azul | borda âmbar, LED laranja pulsando |
| **Encerrado** (`SOLD`, `UNSOLD`) | grafite (`tinta`) para Arrematado; fio neutro para Sem lances | "Arrematado" / "Sem lances" | martelo / traço | neutra (`papel`) | "ENCERRADO", "00:00" |
| **Cancelado** (`CANCELLED`) | vermelho suave (`falha` + `ferrugem`), borda tracejada | "Cancelado" | círculo cortado | neutra (`papel`) | sem cronômetro |

- **Encerrando não ganha selo novo.** A Sala e o cartão já têm "ÚLTIMOS 2 MIN" e "Apurando…". Criar o texto "Encerrando" mexeria em texto canônico (decidido).
- **Cancelado** usa vermelho porque é um desfecho negativo imposto, sem ser erro do usuário. Decidido em 27/10; o cinza tracejado ficou descartado por se confundir com "Sem lances".
- Vermelho fica para erro, superado, adulterado e cancelado. Verde, só para ganhando e íntegro. Âmbar, só para urgência e alerta.

## 6. Acessibilidade

### 6.1 Contrastes medidos

Fórmula WCAG 2.x. Mínimos: **4,5:1** texto normal, **3:1** texto grande (≥24px, ou ≥18,66px em negrito) e elementos gráficos ou bordas de controle. Foram medidos os pares efetivamente usados.

**Tema claro**

| Par | Razão | Uso |
|---|---|---|
| `tinta` `#0F1B33` / `papel` `#FFFFFF` | 17,14 | texto |
| `tinta` / `fundo` `#F7F9FF` | 16,29 | texto |
| `tinta2` `#4B5870` / `papel` | 7,17 | texto secundário |
| `tinta2` / `fundo` · `suave` | 6,81 · 6,22 | texto secundário |
| `ocreTexto` `#0033A0` / `papel` · `fundo` · `suave` | 10,60 · 10,07 · 9,20 | link, filtro ativo |
| `sobreOcre` `#FFFFFF` / `ocre` `#0033A0` | 10,60 | botão primário |
| `#FFFFFF` / `ocreHover` `#174BC2` | 7,44 | hover do primário |
| `linha` `#6F83AD` / `papel` · `fundo` · `suave` | 3,80 · 3,61 · 3,30 | borda de campo |
| `foco` `#174BC2` / `papel` · `fundo` · `suave` | 7,44 · 7,07 · 6,46 | anel de foco |
| `ferrugem` `#B42318` / `papel` · `falha` | 6,57 · 5,65 | erro |
| `#FFFFFF` / `ferrugem` | 6,57 | botão de perigo, faixa "superado" |
| `verde` `#1E7A46` / `papel` · `verdeSuave` | 5,35 · 4,75 | ganhando, íntegro |
| `#FFFFFF` / `verde` | 5,35 | faixa "ganhando" |
| `alerta` `#8A4B00` / `alertaSuave` · `fundo` | 6,19 · 6,46 | encerrando, alerta |
| `led` `#F2B92B` / `painel` `#0B1530` | 10,09 | cronômetro |
| `ledAlerta` `#FF6A3D` / `painel` | 6,34 | últimos 2 min |
| `rotuloRelogio` `#9FB0CF` / `painel` | 8,23 | rótulo do cronômetro |
| `borda` `#D3DCF0` / `papel` | 1,38 | **decorativo**, não identifica controle |

**Tema noite**

| Par | Razão | Uso |
|---|---|---|
| `tinta` `#F3F5F8` / `papel` `#151A21` · `fundo` `#0F1216` | 16,00 · 17,19 | texto |
| `tinta2` `#9BA7B8` / `papel` · `fundo` · `suave` | 7,17 · 7,70 · 6,46 | texto secundário |
| **`#0033A0` / `papel` · `fundo`** | **1,65 · 1,77 (falha)** | **não usar como texto nem borda** |
| `ocreTexto` `#6B93FF` / `papel` · `fundo` · `suave` · `selecionado` | 6,03 · 6,48 · 5,44 · 5,30 | link e texto azul |
| `sobreOcre` `#FFFFFF` / `ocre` `#174BC2` | 7,44 | botão primário |
| `#FFFFFF` / `ocreHover` `#2459D6` | 6,04 | hover do primário |
| `ocre` `#174BC2` / `papel` | 2,35 | fundo de botão; a identidade vem do rótulo branco (7,44) e da borda `destaque` |
| `destaque` `#3D6DFF` / `papel` · `fundo` | 4,02 · 4,32 | elemento gráfico |
| `linha` `#6F7C90` / `papel` · `fundo` | 4,13 · 4,44 | borda de campo |
| `foco` `#8AAAFF` / `papel` · `fundo` · `selecionado` | 7,72 · 8,29 · 6,79 | anel de foco |
| `ferrugem` `#FF8A7A` / `papel` | 7,63 | erro |
| `sobreCor` `#0F1216` / `ferrugem` · `verde` | 8,20 · 9,72 | faixas "superado" e "ganhando" |
| `verde` `#5FD08A` / `papel` · `verdeSuave` | 9,05 · 8,17 | ganhando, íntegro |
| `alerta` `#F2B65A` / `papel` · `alertaSuave` | 9,67 · 8,82 | encerrando |
| `led` / `painel` `#070B14` | 11,01 | cronômetro |
| `ledAlerta` / `painel` · `rotuloRelogio` / `painel` | 6,92 · 8,98 | últimos 2 min, rótulo |

**Azul principal no fundo escuro.** `#0033A0` fecha **1,65:1** sobre `papel` e **1,77:1** sobre `fundo`: nem texto nem borda. A solução segue o padrão do `--c-ocre-texto` que já usamos:
- **Texto e link azul** no noite usam `ocreTexto` `#6B93FF` (≥ 5,30:1 em todas as superfícies).
- **Fundo do botão primário** no noite usa `#174BC2`, com texto branco a 7,44:1.
- **Azul profundo** `#001E63` serve de fundo de seleção, não de texto.

### 6.2 Foco

Anel de 3px `foco` com `outline-offset: 2px`, em `:focus-visible` (e em `label:has(input:focus-visible)`). Nunca é removido. O anel passa 3:1 em todas as superfícies do sistema (tabela acima) e fica sobre o fundo da página, no afastamento, mesmo quando o botão é azul. Em cartão inteiro clicável, o anel contorna o cartão.

### 6.3 Alvos de toque e demais regras

- **Alvo mínimo 44×44px** em botões, links de navegação, filtros, atalhos e botões de ícone. Os botões compactos de 40px do cabeçalho passam a 44px com `pointer: coarse` (decidido). O mínimo do WCAG 2.2 é 24px; o projeto adota 44.
- **Texto mínimo** de 12px, só em rótulos e selos em caixa-alta e `font-weight` ≥ 700. Corpo a partir de 15px.
- **Estado nunca só por cor**: selo com texto, ícone nos avisos, faixa de posição com título, borda e rótulo no cronômetro.
- **Links em texto corrido** com sublinhado; `a:hover` não troca para vermelho.
- **Movimento**: `prefers-reduced-motion` desliga animação e transição. O cronômetro e o estado dos lances não dependem de movimento.
- **Zoom e reflow**: sem rolagem horizontal da página a 320px e a 200%. Só tabelas rolam, dentro de região identificada.
- **Tema**: segue `prefers-color-scheme`; o seletor do cabeçalho (Sistema/Claro/Noite) prevalece. `color-scheme` acompanha.

## 7. Ordem de implementação

Roteiro para a Amelia. **Um commit por etapa**, em português, atômico, sem marca de IA. Cada etapa fecha com `npm run typecheck`, `npm run lint`, `npm test` e uma conferência no Chrome real nos dois temas e em 360 e 1280px. Só estilo: nenhuma etapa mexe em texto canônico, rota ou regra.

| # | Etapa | Arquivos principais | Pronto quando |
|---|---|---|---|
| 1 | **Tokens** claro e noite (inclusive o bloco `prefers-color-scheme`), tokens novos, sombras e raios no Tailwind sem trocar nomes, `painel` e rótulos do relógio, backdrop do diálogo. O `.cabecalho` passa a usar os tokens globais. | `globals.css`, `tailwind.config.mjs` | Cabeçalho idêntico ao de hoje; o resto do site já está azul e claro |
| 2 | **Base**: foco global (anel azul), links (sublinhado em texto corrido, hover azul), `body`, seleção de texto. | `globals.css` | Foco visível em todos os controles, nos dois temas |
| 3 | **Botões**: `buttonClasses` com primário, secundário, fantasma, perigo (secundário e sólido), desabilitado, carregando (spinner), atalho e ícone; compacto e Sala; `SkipLink`. Os botões da conta no cabeçalho usam as mesmas classes. | `ui/button.tsx`, `site-header.tsx`, `skip-link.tsx` | Todas as variantes com hover, foco e pressionado; teste de `loading` mantido |
| 4 | **Campos**: `Field`, `MoneyField`, selects, busca, campo e atalhos do lance, valores do depósito, controle segmentado do Acesso. | `ui/field.tsx`, `money-field.tsx`, `bid-form.tsx`, `access-tabs.tsx` | Erro com cor, ícone e texto; borda de campo ≥ 3:1 |
| 5 | **Selos e estados**: `Stamp` vira selo em pílula (sem rotação), estados da seção 5, `LotTag` com os tons novos (cancelado neutro). | `ui/stamp.tsx`, `ui/lot-tag.tsx`, `my-bids/status-seal.tsx` | Os cinco estados distinguíveis em escala de cinza |
| 6 | **Cartão de lote, filtros e foto**: casca nova do cartão, faixa da etiqueta, rodapés, hover, `FilterTabs`, `CarPhoto`. | `lots/lot-card.tsx`, `ui/filter-tabs.tsx`, `lots/car-photo.tsx`, `vitrine.tsx` | Vitrine a 360, 768 e 1280px; título de 1 e 2 linhas; `lot-card.test.tsx` verde |
| 7 | **Cronômetro e placas**: display novo, variante encerrando com ícone, `SeloProrrogacao` fora do rótulo, `placa-lance`. | `lots/cronometro.tsx`, `lots/placa-lance.tsx` | `tabular-nums` e `nowrap` intactos; `cronometro.test.tsx` verde |
| 8 | **Sala**: painel, faixa de posição, histórico, resultado e carimbo, cancelado, "Apurando". | `sala.tsx`, `lots/bid-panel.tsx`, `lots/faixa-status.tsx`, `lots/placar-posicao.tsx`, `lots/bid-history.tsx`, `lots/resultado-do-lote.tsx` | Todas as variantes da Sala conferidas, incluindo 320px |
| 9 | **Avisos e diálogos**: `FeedbackState`, `RefusalMessage`, `ConnectionBanner`, `AvisoPapel`, estados globais, `Dialog` e `CancelDialog`, menu do perfil. | `ui/feedback-state.tsx`, `ui/refusal-message.tsx`, `connection-banner.tsx`, `aviso-papel.tsx`, `global-states.tsx`, `ui/dialog.tsx`, `cancel-dialog.tsx`, `profile-menu.tsx` | Os quatro tipos de aviso com ícone; foco devolvido ao fechar |
| 10 | **Tabelas e listas**: `DataTable`, extrato da Carteira, painel do leiloeiro, lista de lances e chip do licitante. | `ui/data-table.tsx`, `wallet-screen.tsx`, `painel-screen.tsx`, `lots/chip-licitante.tsx` | Rolagem horizontal em região focável a 360px |
| 11 | **Telas de conta e consulta**: Acesso (bilhetes), Carteira ("Disponível"), Arremates (canhoto), Comprovante e recibo, Auditoria. | `access-screen.tsx`, `role-tickets.tsx`, `my-bids/*`, `comprovante/*`, `audit/*`, `criar-lote-form.tsx` | Cada tela conferida nos dois temas; veredito da Auditoria legível sem cor |
| 12 | **Limpeza e conferência final**: remover `rounded-nenhum`, `border-2`, `border-dashed` e sombras duras que sobraram; varrer `ferrugem` no hover; conferir os pares da seção 6 renderizados; zoom de 200% e 320px; atualizar `progresso.md`. | todo `apps/web/src` | Nenhuma sombra dura nem canto reto restante (exceto picote); lint, typecheck e testes verdes |

Um aviso para o desenvolvimento: as etapas 1 a 3 mudam o visual do site inteiro de uma vez (cores e botões). As etapas 4 a 11 tiram as bordas grossas, pois até lá cartões e campos ainda trazem `border-2`. É esperado que o site passe por um visual híbrido entre as etapas. Por isso a branch `repaginacao-visual` continua local, sem push nem deploy, até a conferência final.

## 8. Perguntas em aberto

Nenhuma bloqueia a implementação. As abertas já têm a recomendação adotada neste documento.

**Decididas pelo Felipe em 27/10/2026**

| # | Pergunta | Decisão |
|---|---|---|
| P1 | Logo: placa escura na barra clara e clara no tema noite, ou clara nos dois? | Fica como está no código aprovado: escura no claro, clara no noite. |
| P2 | O estado "encerrando" precisa de um selo com a palavra "Encerrando"? | Não. Sem texto novo; o estado usa cor, ícone e os textos que já existem ("ÚLTIMOS 2 MIN", "Apurando…"). |
| P3 | Botões do cabeçalho com 40px, contra o alvo de 44px do projeto. | 40px com ponteiro fino e 44px com `pointer: coarse`. |
| P6 | "Cancelado" em vermelho suave. | Aprovado. |

**Abertas**

| # | Pergunta | Recomendação adotada |
|---|---|---|
| P4 | Sem fonte monoespaçada, o hash da Auditoria e do Comprovante pode confundir `0`, `O`, `1` e `l`. | Manter Manrope com `tabular-nums`. Se a leitura do hash atrapalhar, usar a pilha monoespaçada do sistema só nele (decisão sua, por sair da regra de uma família). |
| P5 | O nome `ocre` guarda azul e está sob análise. | Não renomeei. Proposta: criar aliases `--c-primario`, `--c-primario-hover` e `--c-primario-texto` apontando para os atuais, migrar os componentes aos poucos e só então remover `ocre`. |
| P7 | O app não tem toast. A aparência está definida (4.9); posição, duração e uso são comportamento. | Decidir no EXPERIENCE.md se e quando existirão. |
| P8 | O selo "+2 MIN" cobre parte do rótulo no cartão (pendência de `deferred-work.md`). | Resolvido só no visual: o selo vai ao lado do tempo, nunca sobre o rótulo. Se isso pedir mudar a estrutura do cronômetro, avisar antes. |
| P9 | `ferrugem` e `verde` mudam de matiz (marrom-vermelho para vermelho frio; verde mais escuro). | É coerência com o azul e contraste; os nomes ficam. |

## 9. Do's e Don'ts

| Faça | Não faça |
|---|---|
| Um botão primário por tela (ou por camada de diálogo) | Dois primários na mesma camada |
| Azul para ação, marca e seleção | Azul como decoração sem função |
| `ocreTexto` para texto azul no noite | `#0033A0` como texto ou borda no noite |
| Verde só para ganhando e íntegro; sucesso genérico em tom informativo | Verde para confirmação genérica |
| Vermelho para erro, superado, adulterado e cancelado | Vermelho como ênfase ou no hover de link |
| Âmbar e LED laranja só para urgência e alerta | Âmbar como cor de marca |
| Fio de 1px, cantos de 8 a 16px, sombra suave | Borda de 3px, canto reto, sombra dura, gradiente ou glow (exceto o brilho do logo no noite) |
| Estado com texto, ícone e cor | Estado só por cor |
| `tabular-nums` em valores, cronômetro e contadores; `nowrap` no cronômetro | Cronômetro que quebra linha ou dá salto de largura |
| Foco com anel azul de 3px, sempre visível | Remover o `outline` |
| Link em texto corrido sublinhado | Link só por cor |
| Respeitar `prefers-reduced-motion` | Animação essencial que não se desliga |
| Reflow com `flex-wrap`, `clamp()` e `grid auto-fit` | Layout dependente de media queries de largura |

## 10. Rastreio

- Esta revisão **substitui** a Rev. 03 ("Manual de pátio"). As fontes Big Shoulders Display, IBM Plex Mono e Newsreader, a cor ocre, o papel e a tinta quente, as bordas de 3px, as sombras duras, os cantos retos, os carimbos inclinados e o tracejado como linguagem saem do sistema. O tracejado fica só no picote.
- Os mocks em `design/project/` e o mock complementar mostram a Rev. 03. Servem para estrutura e conteúdo das telas, **não** para cor, forma ou tipografia.
- O comportamento, os fluxos e os textos canônicos vêm do [EXPERIENCE.md](EXPERIENCE.md), que não muda nesta revisão.
- Referência visual aprovada: o cabeçalho (`.cabecalho` em `apps/web/src/app/globals.css`, `site-header.tsx`, `ui/logo.tsx`).
