---
name: LanceAuto
description: Sistema visual "Azul de leilão" (Rev. 05, out/2026) da casa de leilões de carros LanceAuto. Moderno e sóbrio, com cantos arredondados, bordas finas e sombras suaves, em Manrope. Paleta azul (#0033A0, #174BC2, #001E63, #E8EFFF) em dois temas, claro e noite. A Rev. 05 refina filtros, cartão de lote e cronômetro e define o rodapé. Substitui o "Manual de pátio" (Rev. 03, neo-brutalista).
status: draft
revision: '05'
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
  # Rev. 05 (novos; nenhum nome anterior mudou)
  rotulo-campo: { fontSize: 13px, fontWeight: '600', lineHeight: '1.2', letterSpacing: '0', transform: none, color: tinta2 }
  filtro: { fontSize: 14px, fontWeight: '600', lineHeight: '1', letterSpacing: '0', transform: none }
  titulo-cartao: { fontSize: 20px, fontWeight: '700', lineHeight: '1.2', transform: none }
  meta-cartao: { fontSize: 13px, fontWeight: '500', lineHeight: '1.3', color: tinta2 }
  rotulo-cartao: { fontSize: 12px, fontWeight: '700', lineHeight: '1', letterSpacing: '0.06em', transform: uppercase, color: tinta2 }
  lance-cartao: { fontSize: 28px, fontWeight: '800', lineHeight: '1.1', numeros: tabular-nums }
  rodape-titulo: { fontSize: 12px, fontWeight: '700', lineHeight: '1', letterSpacing: '0.08em', transform: uppercase }
  rodape-link: { fontSize: 14px, fontWeight: '500', lineHeight: '1.3' }
  rodape-legal: { fontSize: 13px, fontWeight: '400', lineHeight: '1.45', color: tinta2 }
  body-lead: { fontSize: 18px, fontWeight: '400', lineHeight: '1.4' }
  body: { fontSize: 16px, fontWeight: '400', lineHeight: '1.45' }
  body-nota: { fontSize: 15px, fontWeight: '500', lineHeight: '1.35' }
  body-legenda: { fontSize: 13px, fontWeight: '500', lineHeight: '1.3' }
  dado: { fontSize: 14px, fontWeight: '500', lineHeight: '1.3' }
  cronometro: { fontSize: 40px, fontWeight: '700', lineHeight: '1' }
rounded:
  chip: 6px          # rounded-md: selos pequenos, itens de menu
  controle: 8px      # rounded-lg: botão COMPACTO de 40px (cabeçalho, tabelas). Valor e nome preservados.
  cartao: 12px       # rounded-xl: tabelas, avisos, cartão "Como funciona"
  painel: 16px       # rounded-2xl: diálogos, painel de lance, cartão "Disponível"
  pilula: 9999px     # rounded-full: trilho e segmentos de filtro, selos, badges, atalhos, botões de ícone, avatar
  # Novos na Rev. 05
  botao: 12px        # rounded-xl: botão padrão de 44px ou mais (primário, secundário, fantasma, perigo)
  campo: 12px        # rounded-xl: busca, seletor e campos de formulário
  cartao-lote: 16px  # rounded-2xl: cartão de lote e prévia do Criar lote; a foto herda (rounded-t-[inherit])
  cronometro-cartao: 12px  # rounded-xl: cronômetro do cartão (aninhado: 16px do cartão menos o respiro)
  # Regra: o raio acompanha a altura (40px → 8px; 44 a 56px → 12px; contêiner de lote → 16px); item aninhado usa o raio de fora menos o respiro.
  # Preservados (logo e círculos): placa 3px, logo-interno 6px, logo-tela 7px, logo 10px, circulo 50%
spacing:
  base: 4px
  escala: '4, 8, 12, 16, 20, 24, 32, 40, 48, 64'
  cartao-padding: '20px (16px abaixo de 640px)'
  gutter-lateral: 'clamp(16px, 4vw, 56px)'
  container-max: 1320px
  container-comprovante: 1200px
  alvo-minimo: 44px
  controle-altura: '40px (compacto: cabeçalho, tabelas) | 44px (padrão: botão, busca, seletor e trilho da barra de filtros) | 48px (campo de formulário) | 56px (lance na Sala)'
  segmento-altura: '36px visuais dentro do trilho de 44px; área clicável de 44px (pseudo-elemento)'
  selo-altura: '28px (cartão de lote) | 24px (tabela e lista) | 20px (badge de contagem)'
  barra-filtros: 'gap 12px entre linhas e 16px entre colunas; rótulo a 6px do campo; 24px abaixo da barra'
  cartao-lote-padding: '16px (20px a partir de 640px)'
  rodape: 'padding vertical 48px em cima e 32px embaixo; colunas com gap 32px; 64px entre o conteúdo da página e o rodapé'
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
    rodape: '0 -6px 18px -10px rgba(0, 30, 99, 0.35)'                           # NOVO. Espelho vertical da sombra do cabeçalho (--sh-rodape)
  noite:
    # No escuro a elevação vem do tom da superfície e do fio, não da sombra. Sombra só em menu e diálogo.
    rodape: none                                                                # NOVO. No noite a separação é a linha de 2px `destaque`
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

### 1.1 O que a Rev. 05 muda (segunda rodada)

A direção e a paleta não mudam. A rodada refina três pontos e conserta uma pendência. Só estilo: nenhum texto canônico, rota, fluxo ou regra muda.

| Ponto | Antes (Rev. 04 e código atual) | Rev. 05 |
|---|---|---|
| **Busca e Marca** | Caixa de 48px, rótulo em caixa-alta, fundo `fundo` no noite | 44px, 12px de raio, fundo `papel` nos dois temas, rótulo discreto (13/600, caixa normal), lupa na busca, chevron próprio no seletor, foco azul |
| **Filtro de status** | Quatro pílulas soltas, 40px | **Controle segmentado**: um trilho de pílula com quatro segmentos de 36px, selecionado em azul principal, hover em azul interativo |
| **Cartão de lote** | Faixa da etiqueta acima da foto; título 26px em caixa-alta; selo e cronômetro de cantos diferentes | **Foto no topo** (herda os 16px do cartão), faixa da etiqueta logo abaixo, título 20px em caixa normal, **lance atual 28px/800 como destaque**, selo e cronômetro na mesma gramática de raio e cor |
| **Cronômetro do cartão** | Selo "+2 MIN" no canto, cobrindo o rótulo | "+2 MIN" **dentro do fluxo**, na linha dos dígitos. Resolve P8 e a pendência de `deferred-work.md` |
| **Rodapé** | Não existe | Rodapé global em estilo espelhado do cabeçalho, com conteúdo provisório (4.13) |

**Ajustes de valor sobre a Rev. 04 (nenhum token foi renomeado).** (a) O botão padrão de 44px sobe de 8px para 12px (`botao`); o compacto de 40px e os botões do cabeçalho continuam em 8px (`controle`). Sem isso, campo de 12px e botão de 8px lado a lado no mesmo formulário ficam desencontrados. (b) Campo no noite deixa o fundo `fundo` e usa `papel`, como no claro. (c) Rótulo de campo deixa a caixa-alta de 12/700 e vira 13/600 em caixa normal (`rotulo-campo`), em todo o site, para o rótulo do filtro não destoar do rótulo dos formulários. (d) Cronômetro encerrando troca a borda de `alerta` para `ledAlerta` (o `alerta` do claro dá só 2,65:1 sobre o `painel`).

**Duas correções de mapa.** `lots/canhoto.tsx` não é a etiqueta do lote: é o cartão compacto do "Como funciona" e já está no padrão novo (`rounded-xl`, fio `borda`, nível 1), então **não muda**. A etiqueta do lote é `ui/lot-tag.tsx` (`LotTag`). E o selo de status é `ui/stamp.tsx` (`Stamp`), que vira pílula na etapa 7.

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

- **Raios** (frontmatter `rounded`, tabela 2.8): botão compacto 8px; botão padrão e campo 12px; tabela, aviso e cartão "Como funciona" 12px; cartão de lote, diálogo, painel de lance e cartão "Disponível" 16px; selo, trilho e segmento de filtro, atalho, botão de ícone e avatar em pílula. Nada fica com raio 0, exceto o picote (ver 4.12) e o recorte chanfrado da etiqueta do lote.
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

Troca de cor, borda e sombra em 150ms `ease-out`. Pressionar leva o botão 1px para baixo. **Cartão de lote no hover sobe 2px (`translateY(-2px)`) e leva a sombra ao nível 2, em 200ms** (Rev. 05; antes ficava parado). O segmento do filtro troca cor em 150ms e não se move. Os keyframes `la-pulsa`, `la-vira`, `la-bate`, `la-mais`, `la-entra` e `la-marca` continuam. `la-bate` assenta em no máximo -3° (antes -6°). Tudo desliga com `prefers-reduced-motion`, e nenhum estado depende de animação (o cartão também para de subir).

### 2.8 Tokens da Rev. 05 (resumo para implementação)

Nenhuma cor nova: o filtro, o cartão e o rodapé usam só tokens que já existem. O que é novo são raios, alturas, uma sombra e classes tipográficas. Os valores completos estão no frontmatter; aqui está o mapa para o código.

**Raios**

| Token | Valor | Tailwind | Onde |
|---|---|---|---|
| `controle` (existente) | 8px | `rounded-lg` | Botão compacto de 40px: cabeçalho, tabelas |
| `botao` (novo) | 12px | `rounded-xl` | Botão padrão de 44px+ |
| `campo` (novo) | 12px | `rounded-xl` | Busca, seletor, campos de formulário |
| `pilula` (existente) | 9999px | `rounded-full` | Trilho e segmentos, selo, badge, atalho, botão de ícone |
| `cartao` (existente) | 12px | `rounded-xl` | Tabela, aviso, "Como funciona" |
| `cartao-lote` (novo) | 16px | `rounded-2xl` | Cartão de lote; foto com `rounded-t-[inherit]` |
| `cronometro-cartao` (novo) | 12px | `rounded-xl` | Cronômetro do cartão |

O Tailwind já traz `rounded-lg`, `rounded-xl` e `rounded-2xl` com esses valores: **não precisa de chave nova no `tailwind.config.mjs`** para raio. O nome do token vive neste documento e no comentário do componente.

**Alturas** (frontmatter `controle-altura`, `segmento-altura`, `selo-altura`)

| Elemento | Altura |
|---|---|
| Botão compacto | 40px (44px com `pointer: coarse`) |
| Botão padrão, busca, seletor e trilho da barra de filtros | 44px |
| Segmento do filtro | 36px visuais; clicável em 44px |
| Campo de formulário | 48px |
| Botão "Dar lance" | 56px |
| Selo no cartão de lote / em tabela / badge de contagem | 28px / 24px / 20px |

**Sombras e elevação.** Reaproveita `cartao`, `elevada` e `modal`. Novo: `--sh-rodape` (claro: `0 -6px 18px -10px rgba(0, 30, 99, 0.35)`; noite: `0 0 #0000`) e a chave Tailwind `shadow-rodape`. Segmento selecionado usa `shadow-botao`. Hover do cartão: `shadow-painel` + `-translate-y-0.5`.

**Classes tipográficas novas** (em `globals.css`, no estilo `.t-<nome>`): `.t-rotulo-campo`, `.t-filtro`, `.t-titulo-cartao`, `.t-meta-cartao`, `.t-rotulo-cartao`, `.t-lance-cartao` (com `tabular-nums`), `.t-rodape-titulo`, `.t-rodape-link`, `.t-rodape-legal`. As antigas `.t-botao` e `.t-botao-primario` passam a caixa normal (15/600 e 16/600), como já pede a seção 3.

## 3. Tipografia

Só a Manrope. Os tamanhos dos títulos (`.t-display-*`, `.t-cartaz-*`, `.t-placar`, `.t-numero-lote`) e do corpo (`.t-body*`) ficam como estão no código. Três ajustes de acabamento:

1. **Botões em caixa normal**: 16px/600 (primário) e 15px/600 (secundário), como "Entrar" e "Criar conta" (14px/600, compacto). Caixa-alta fica para títulos, rótulos e selos.
2. **Selos** em 12px/700, caixa-alta, tracking .06em.
3. **Dados que se conferem** (R$, cronômetro, contadores, lance, hash) usam `tabular-nums`. Sem fonte monoespaçada, o alinhamento vem daí.
4. **Rev. 05, hierarquia do cartão e dos campos**: rótulo de campo em 13/600 e caixa normal (`rotulo-campo`); segmento de filtro em 14/600 e caixa normal (`filtro`); no cartão de lote, título em 20/700 caixa normal, meta em 13/500 e **lance em 28/800**, o maior texto do corpo. Seções, rótulos de painel e selos continuam em caixa-alta.

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

- **Medidas**: padrão 44px de altura, `rounded-xl` (12px, token `botao`; Rev. 05), `px-5`. **Compacto** 40px (cabeçalho, tabelas), `rounded-lg` (8px, `controle`), `px-4`, 14px. **Sala** ("Dar lance") 56px, `rounded-xl`, largura total, 18px/700. Com `pointer: coarse`, o compacto sobe para 44px (decidido).
- **Perigo sólido** fica no kit, mas **não é usado em "Cancelar lote"**: a decisão C9 do SPEC manda o confirmar do cancelamento em azul (primário) e deixa a `ferrugem` só no aviso do diálogo. Se um fluxo futuro pedir confirmação destrutiva em vermelho, o perigo sólido ocupa o lugar do primário daquela camada.
- **Foco**: ver 6.2. Anel `foco` de 3px com 2px de afastamento, em todas as variantes.
- **Links-botão** (`<a>`) usam as mesmas classes. O `!` nas cores continua necessário por causa da regra global `a { color }`.
- **Botão de atalho** ("+ R$ 500"): pílula de 44px, fio `linha`, texto `tinta`, `tabular-nums`. Selecionado: fundo `selecionado`, borda `ocre`/`ocreTexto`, `aria-pressed`.
- **Botão de ícone** (olho do saldo, tema): círculo de 44px, fio `linha`, fundo `papel`, hover `suave`. O ícone ativo do tema usa `ocre` e `sobreOcre`.

### 4.2 Links

Cor `ocreTexto`. Em texto corrido, **sempre sublinhado** (`underline-offset: 3px`), porque o azul sozinho não se distingue do texto. Em navegação e ações, sem sublinhado. O hover vai para `ocreHover` (claro) ou `tinta` (noite) com sublinhado. O `a:hover { ferrugem }` antigo sai: vermelho no hover parecia erro.

### 4.3 Campos de formulário

- **Caixa**: fundo `papel` **nos dois temas** (Rev. 05; antes o noite usava `fundo`), borda 1px `linha`, `rounded-xl` (12px, `campo`), 48px de altura em formulário (44px na barra de filtros, ver 4.7), texto 16px `tinta`. Evita zoom no iOS.
- **Rótulo** acima, token `rotulo-campo`: 13px/600, caixa normal, `tinta2`, a 6px do campo. O placeholder usa `tinta2` e nunca substitui o rótulo.
- **Hover**: borda `tinta2`. **Foco**: borda `foco` (1px) mais o anel global de 3px (6.2). **Desabilitado**: fundo `suave`, borda `borda`, texto `tinta2`, `cursor: not-allowed`.
- **Erro**: borda `ferrugem` com 2px visuais (`box-shadow: 0 0 0 1px`), ícone de aviso, mensagem em `ferrugem` abaixo, ligada por `aria-describedby`. Cor, ícone e texto juntos.
- **Campo de lance**: caixa composta, `rounded-xl`, 56px. Prefixo "R$" e sufixo ",00" em `tinta2`; o valor em 24 a 28px/700 `tabular-nums`. Atalhos logo abaixo (4.1). Recusa colada ao botão (4.9).
- **Depósito**: valores rápidos em grade de 3, como botões de atalho; "outro valor" é um campo comum.
- **Selects e busca da Vitrine**: mesma caixa, 44px na barra de filtros. Detalhe em 4.7.

### 4.4 Selos e badges

Pílula de 24 a 28px: ícone de 14px + texto 12px/700 caixa-alta, padding `4px 10px`, borda de 1px, `rounded-full`. Sem rotação, sem contorno duplo. Fundo tintado, texto e ícone na cor forte. O `Stamp` continua sendo o componente; muda a casca. **Tamanhos** (Rev. 05): 28px no cartão de lote e na Sala (`size="pequeno"` = cartão, `padrao` = Sala), 24px em tabela e lista. `white-space: nowrap`, `max-width: 100%`. **Todo selo carrega ícone e texto**: sem os dois, a cor sozinha não diz o estado.

| Selo | Fundo | Texto e ícone | Borda | Ícone |
|---|---|---|---|---|
| Informativo / Agendado | `selecionado` | `ocreTexto` | `ocre` 30% | relógio |
| Ao vivo | `ocre` | `sobreOcre` | nenhuma | ponto que pulsa |
| Íntegro / Ganhando | `verdeSuave` | `verde` | `verde` 35% | check |
| Erro / Adulterado / Superado | `falha` | `ferrugem` | `ferrugem` 35% | alerta |
| **Cancelado** | `falha` | `ferrugem` | `ferrugem` 35% | círculo cortado |
| Alerta / Encerrando | `alertaSuave` | `alerta` | `alerta` 40% | relógio com alerta |
| Neutro / Arrematado | `tinta` | `fundo` | nenhuma | martelo |
| Sem lances | transparente | `tinta2` | `linha` (tracejada) | traço |

**Badge de contagem** (filtros, listas): 20px de altura, mínimo 20px de largura, `rounded-full`, fundo `suave`, texto 12px/700 `tabular-nums`.

**Carimbo de resultado da Sala**: o único elemento "carimbado" que sobra. Cartão de `rounded-xl`, borda 2px na cor do estado, fundo tintado, texto 28 a 40px/800 caixa-alta, inclinação de -3°, animação `la-bate`. Sem inclinação com `prefers-reduced-motion`.

### 4.5 Etiqueta do lote

Componente: `ui/lot-tag.tsx` (`LotTag`). Fica em **faixa própria, logo abaixo da foto**, fora dela (alinhada à esquerda, com 16px de recuo; Rev. 05: a foto sobe ao topo para herdar os cantos do cartão, e o cordão da etiqueta sobe para o espaço vazio da faixa). Preserva o recorte chanfrado, o furo, o cordão que sai do furo, "LOTE" pequeno e o número em 36px (compacto) ou 52px/800. O recorte chanfrado é a única forma sem raio que fica no cartão: é a assinatura da marca.

- **Aberto, encerrando e agendado**: preenchimento `ocre`, texto `sobreOcre`, contorno de 2px (claro `#001E63`, noite `ocreTexto`).
- **Encerrado e cancelado**: preenchimento `papel`, texto `tinta`, contorno 2px `linha`. Hoje o cancelado herda o tom azul; passa a usar o neutro.
- Inclinação -4° a +3° (-2° nos encerrados), furo com borda do contorno e fundo `fundo`, cordão `tinta` com traço de 2px. É decorativa e nunca é o único meio de saber o estado.

### 4.6 Cartão de lote

Componente: `lots/lot-card.tsx` (`LotCard`). Cartão inteiro clicável (`<a>`; na prévia do Criar lote, um `<div>`): `papel`, fio 1px `borda`, `rounded-2xl` (16px, `cartao-lote`), `overflow: hidden`, nível 1, altura total da célula da grade (`flex flex-col h-full`, para os rodapés alinharem entre cartões vizinhos).

**Anatomia (de cima para baixo)**

```
┌────────────────────────────────────┐  ← 16px; a foto herda os cantos de cima
│              FOTO  200px           │
├────────────────────────────────────┤
│ ⟨ LOTE 018 ⟩              ● AO VIVO│  ← faixa da etiqueta: etiqueta à esquerda, selo à direita
│ Título do veículo em até              │
│ duas ou três linhas                │  ← título 20px/700, caixa normal
│ 2014 · Flex · FIPE R$ 38.000       │  ← meta 13px tinta2
│ ────────────────────────────────── │  ← fio borda
│ LANCE ATUAL            ┌─ RESTAM ─┐│
│ R$ 41.500              │  12:34   ││  ← rodapé: lance 28px/800 e cronômetro
│ 12 lances              └──────────┘│
└────────────────────────────────────┘
```

1. **Foto** (topo): fundo `suave` com os pontos de `pontos`, `object-fit: contain`, **altura 200px**, sem filtro nem recorte; os cantos de cima seguem o cartão (`rounded-t-[inherit]`). Sem foto ou com erro de carga, a silhueta de carro em `tinta` sobre `suave`. Nenhum selo, etiqueta ou texto cobre a foto.
2. **Faixa da etiqueta**: `LotTag` compacto à esquerda (recuo de 16px; o cordão ocupa o espaço vazio acima dela) e, à direita, o selo de estado ou o chip de abertura (agendado), alinhado à base do corpo da etiqueta. Fundo igual ao do cartão, sem divisor. `flex-wrap`: em largura muito curta o selo desce para baixo da etiqueta.
3. **Corpo** (padding 16px; 20px a partir de 640px): título (`titulo-cartao`, 20px/700, caixa normal, `overflow-wrap: anywhere`, sem corte de linhas); meta (`meta-cartao`, 13px/500 `tinta2`: "ano · combustível · FIPE R$ X"); fio 1px `borda` com 16px de respiro; **rodapé por estado**, empurrado para a base (`mt-auto`).

**Hierarquia.** O **lance atual** é o destaque do cartão: 28px/800, `tinta`, `tabular-nums`, o maior texto do corpo. O título (20px) vem em segundo, a meta (13px) e o rótulo (12px caps) ficam em `tinta2`. Só reais inteiros: `R$ 41.500`, nunca centavos. O azul não pinta o preço (num cartão clicável o azul lê como link): quem carrega a cor de "ao vivo" é o selo.

**Estados de interação**

| Estado | Claro | Noite |
|---|---|---|
| Padrão | fio `borda`, `shadow-cartao` | fio `borda`, sem sombra |
| Hover | sobe 2px, `shadow-painel`, borda `ocre` a 40% (`color-mix`) | sobe 2px, `shadow-painel`, borda `destaque` |
| Foco (`:focus-visible`) | anel global de 3px `foco` com 2px de afastamento, contornando o cartão (segue o raio) | idem, `foco` do noite |
| Pressionado | volta à posição (sem subir), sombra nível 1 | idem |
| Prévia (`div`) | sem hover, sem foco, sem cursor de link | idem |

Transição: `transform`, `box-shadow` e `border-color` em 200ms `ease-out`. Com `prefers-reduced-motion` o cartão não sobe, e hover e foco continuam legíveis pela borda e pela sombra.

**Rodapé do corpo por estado** (a matriz completa, com etiqueta, selo, foto e cronômetro, está em 5.1)

- **Ao vivo**: rótulo "LANCE ATUAL" (ou "LANCE INICIAL", sem lances), valor `lance-cartao`, "N lances" em `meta-cartao`, e à direita o cronômetro do cartão (4.11). `flex-wrap` com gap 16px: o cronômetro desce abaixo do valor se faltar largura.
- **Agendado**: "LANCE INICIAL", valor, "incremento R$ X" e, à direita, a caixa "ABERTURA" (`rounded-xl`, fundo `suave`, fio `borda`, padding `8px 12px`, dia em 22px/800, hora em 14px/500).
- **Encerrado**: rótulo "RESULTADO", as linhas que o código já monta (`endedCardLines`), com o valor do arremate em 24px/800 `tabular-nums`. O selo vai **na faixa da etiqueta**; a foto leva um véu (5.1).
- **Cancelado**: igual ao encerrado, sem valor em destaque.

### 4.7 Filtros e abas

Componentes: `ui/filter-tabs.tsx` (`FilterTabs`, status) e, na Vitrine, a busca e o seletor de Marca. As três peças compartilham **altura (44px), fio (1px `linha`) e superfície (`papel`)**, e por isso lêem como uma barra só.

**Barra de filtros da Vitrine**

```
 Buscar                     Marca              
┌──────────────────────┐  ┌──────────────┐  ┌──────────────────────────────────────┐
│ 🔍  Marca, modelo, ano… │  │ Todas      ⌄ │  │ ( Todos )  Ao vivo  Agendados  Encerrados │
└──────────────────────┘  └──────────────┘  └──────────────────────────────────────┘
        flex 1 1 260px          flex 0 1 200px          trilho: flex 0 1 auto
```

- **Layout**: `flex flex-wrap items-end`, gap 12px (linhas) e 16px (colunas), 24px abaixo da barra. Sem breakpoint: o que não cabe quebra para a linha de baixo. Todas as peças têm 44px; o alinhamento é pela base.
- **Rótulos** "Buscar" e "Marca" em `rotulo-campo` (13/600, caixa normal, `tinta2`), a 6px do campo. O trilho de status não tem rótulo visível: o nome do grupo vai em `aria-label="Status"`, como hoje.

**Busca**

- Caixa `campo` (4.3): 44px, `rounded-xl`, `papel`, fio `linha`, texto 16px `tinta`, placeholder `tinta2`.
- **Lupa** à esquerda: SVG de 18px, traço de 2px, `tinta2`, `aria-hidden`, a 14px da borda; o texto começa a 42px. Com o campo em foco, a lupa vira `ocreTexto` (`:focus-within`). Não é botão: não tem ação.
- O "x" nativo do `type="search"` continua (é comportamento do navegador). Nenhum botão "limpar" novo.

**Marca (seletor)**

- Select nativo (`appearance: none`) com a mesma caixa, `padding-right: 40px` e **chevron próprio**: SVG de 16px em `tinta2`, a 14px da borda direita, `pointer-events: none`, dentro de um `relative`. O menu aberto é o do navegador (acompanha `color-scheme`).

**Status: controle segmentado**

- **Trilho**: `inline-flex`, 44px, padding 4px, `rounded-full`, fundo `papel`, fio 1px `linha`, `max-width: 100%`.
- **Segmento** (`<button type="button" aria-pressed>`): 36px visuais, `rounded-full`, `px-14px`, texto `filtro` (14/600, **caixa normal**: "Todos", "Ao vivo", "Agendados", "Encerrados"), `white-space: nowrap`, gap 4px entre segmentos. O mesmo peso em todos os estados, para o rótulo não mudar de largura ao selecionar.
- **Área clicável de 44px**: um pseudo-elemento `before:absolute before:-inset-y-1 before:inset-x-0` leva a área ao alto do trilho. O alvo de 44px do projeto vale.
- **Contador** (opcional, `count`): badge de 20px dentro do segmento, `rounded-full`, 12px/700 `tabular-nums`, fundo `suave` (no segmento selecionado: branco a 20% sobre `ocre`, texto `sobreOcre`). A Vitrine não passa contador hoje; o estilo fica pronto.
- **Ordem do DOM e ARIA**: iguais às de hoje (`role="group"` + `aria-label` + `aria-pressed`). Nada de `role="tab"`: a mudança é só de pele.

**Estados do segmento**

| Estado | Claro | Noite |
|---|---|---|
| Padrão | transparente; texto `tinta` | transparente; texto `tinta` |
| Hover | fundo `selecionado`, texto `ocreHover` (azul interativo) | fundo `selecionado`, texto `ocreTexto` |
| Foco (`:focus-visible`) | anel de 3px `foco` com 2px de afastamento, fora do segmento | idem |
| Pressionado | desce 1px | idem |
| **Selecionado** | fundo `ocre`, texto `sobreOcre`, `shadow-botao` | fundo `ocre`, **borda 1px `destaque`**, texto `sobreOcre` |
| Selecionado + hover | fundo `ocreHover` | fundo `ocreHover` (`#2459D6`), borda `destaque` |
| Desabilitado | texto `tinta2`, sem hover, `cursor: not-allowed` | idem |
| Selecionado + desabilitado | fundo `papel`, borda 1px `linha`, texto `tinta2` | idem |

No noite, o `ocre` (`#174BC2`) sobre o trilho `papel` dá só 2,35:1; a borda `destaque` (4,02:1) é o que garante o estado selecionado para quem não distingue o azul. O "desabilitado" não é usado pela Vitrine hoje (o filtro nunca fica inerte), mas fica definido para o componente.

**Estados da busca e do seletor**

| Estado | Claro | Noite |
|---|---|---|
| Padrão | fundo `papel`, fio `linha`, texto `tinta`, placeholder e ícones `tinta2` | idem |
| Hover | fio `tinta2` | fio `tinta2` |
| Foco | fio `foco` + anel global de 3px; lupa em `ocreTexto` | idem |
| Preenchido | igual ao padrão (o texto é a pista) | idem |
| Desabilitado | fundo `suave`, fio `borda`, texto `tinta2`, `cursor: not-allowed` | idem |
| Erro (formulários) | ver 4.3 | ver 4.3 |

**Tela estreita (320 a 640px).** Busca e Marca ocupam uma linha cada (`min-width: min(100%, 260px)` e `min(100%, 200px)` fazem o `flex-wrap` empilhar). O trilho de status ganha a linha própria e passa a `width: 100%`, com os segmentos em `flex: 1 1 auto`. Se os quatro não couberem (a 320px a soma passa de 288px), **o trilho rola na horizontal**: `overflow-x: auto`, `scrollbar-width: none`, dentro de um invólucro com `padding: 6px; margin: -6px` para o anel de foco não ser cortado, e o segmento seguinte aparece cortado na borda, o que mostra que há mais. Nenhuma rolagem horizontal na página.

**Abas de acesso** ("Criar conta" e "Entrar") seguem o mesmo trilho, em `rounded-xl` (cantos de 12px, não pílula, porque são abas largas): fundo `suave`, aba ativa `papel` com nível 1 e texto `ocreTexto`. Os filtros de "Meus arremates" usam o segmento de status daqui.

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

`<dialog>` nativo: `papel`, fio `borda`, `rounded-2xl`, nível 3, largura máxima 560px, margem lateral mínima 16px, padding 24px. Título 20px/800; corpo 16px; ações alinhadas à direita e empilhadas no celular, com o primário por último ("Cancelar lote" é primário azul; o aviso de irreversibilidade e de estorno usa `ferrugem`, como no SPEC C9). Fundo (`::backdrop`): `rgba(5, 12, 32, 0.60)`, sem blur. O conteúdo sob o diálogo fica inerte (comportamento no EXPERIENCE.md). O menu do perfil é um popover pequeno: `rounded-xl`, nível 2, itens de 44px com hover `suave`.

### 4.11 Sala de lances

**Estrutura.** Ficha do carro à esquerda, painel de lance à direita (abaixo no celular), como hoje. Painel: `papel`, fio, `rounded-2xl`, nível 1, padding 24px.

- **Lance atual**: placas flip (`placa-lance`) em `painel`, dígito `digitoPlaca` 40×60px, `rounded-md`, linha central de 2px, sufixo ",00" em 20px. `aria-label="Lance atual R$ …"`, placas `aria-hidden`. A troca usa `la-vira` com atraso de .06s por dígito.
- **Cronômetro**: ver abaixo.
- **Faixa de posição** (`placar-posicao`/`faixa-status`, `aria-live="polite"`): `rounded-xl`, padding `14px 16px`, ícone + título 18 a 22px/800 + contador. "Ganhando" e "Arrematou": `verde`/`sobreCor` (com ícone de check). "Superado": `ferrugem`/`sobreCor` (ícone de seta para baixo). Neutro (visitante, "Martelo batido", "Você está assistindo"): fundo `suave`, texto `tinta`, fio `borda`. Os textos literais não mudam.
- **Botão "Dar lance"**: primário de Sala (4.1). **Recusa** (4.9) logo abaixo.
- **Histórico**: lista da seção 4.8, mais recente no topo.
- **Selo "+2 MIN"** (resolve P8 e a pendência de `deferred-work.md`): pílula `led`/`painel` (10,09:1), 12px/800 caixa-alta, `la-mais`. **Entra no fluxo do cronômetro, na linha dos dígitos, à direita deles**, e não mais em `position: absolute` no canto. Altura 20px no cartão e 24px na Sala. Nunca toca o rótulo. Detalhe abaixo.
- **Estados**: agendado (etiqueta azul, abertura e contagem, sem formulário), cancelado (selo "Cancelado" + aviso + histórico, sem CTA), zero lances ("Lance inicial", "Nenhum lance ainda"), "Apurando resultado…" (alerta, ação desabilitada), encerrado (carimbo de resultado, 4.4).

**Cronômetro** (cartão e Sala): display `painel`, fio `linha`, **mesmo desenho nos dois tamanhos, só muda a escala**. Rótulo de 12px/700 caixa-alta em `rotuloRelogio`. Dígitos `led`, `tabular-nums`, `white-space: nowrap`, `font-weight: 700`. Segmentos apagados ("88:88") a 10% de opacidade, só decoração. `role="timer"` e `aria-label="Tempo restante mm:ss"` (atualizado a cada 10s).

| | Cartão | Sala |
|---|---|---|
| Raio | `rounded-xl` (12px, `cronometro-cartao`) | `rounded-xl` (12px) |
| Padding | `8px 12px` | `10px 14px` |
| Dígitos | 24px | `clamp(32px, 10vw, 44px)` |
| Selo "+2 MIN" | 20px | 24px |

**Estrutura interna.** Linha 1: rótulo (com ícone de alerta de 14px à esquerda, só no "encerrando"). Linha 2: `flex items-center gap-8px`, com os dígitos e, se houver prorrogação, o selo "+2 MIN" com `flex-shrink: 0`. A caixa é `inline-flex flex-col`; se a linha 2 não couber na largura disponível (por exemplo "26d 10:18:34" mais o selo no cartão), o selo **quebra para baixo dos dígitos**, nunca por cima do rótulo e nunca para fora da caixa. Os dígitos não quebram.

| Variante | Rótulo | Dígitos | Borda | Reforço sem cor |
|---|---|---|---|---|
| Normal | RESTAM / TEMPO RESTANTE | `led` | 1px `linha` | rótulo |
| **Encerrando** (≤ 2 min) | ÚLTIMOS 2 MIN, em `ledAlerta` | `ledAlerta`, `la-pulsa` 1s | **2px `ledAlerta`** | rótulo + ícone de alerta |
| Prorrogado | PRORROGADO | `led` | 1px `linha` | selo "+2 MIN" |
| Prorrogado + encerrando | ÚLTIMOS 2 MIN | `ledAlerta` | 2px `ledAlerta` | rótulo + ícone + selo "+2 MIN" |
| Apurando | (rótulo da variante) | `led`, sem pulso | 2px `ledAlerta` | texto "Apurando…" |
| Encerrado | ENCERRADO | `led` ("00:00") | 1px `linha` | rótulo |
| Agendado | ABRE EM | `led` | 1px `linha` | rótulo |

A borda do "encerrando" sai de `alerta` para `ledAlerta` porque o `alerta` do claro (`#8A4B00`) dá só 2,65:1 contra o `painel` (6.1).

Com `prefers-reduced-motion` o pulso e a entrada do "+2 MIN" desligam, e o estado "encerrando" continua legível pelo rótulo, pelo ícone e pela borda grossa.

### 4.12 Telas

- **Acesso (conta)**: cartão `rounded-2xl` com controle segmentado (4.7) e campos (4.3). Os bilhetes de perfil ("Licitante" e "Leiloeiro") são cartões selecionáveis `rounded-xl`: selecionado com borda `ocre`, fundo `selecionado` e ícone de check; não selecionado com `papel` e fio. Contas de teste ficam num aviso informativo.
- **Cabeçalho**: sem mudança. Os botões da conta passam a vir das classes globais (4.1, compacto).
- **Carteira**: o cartão "Disponível" é o destaque: claro, fundo `ocre` e texto `sobreOcre`; noite, fundo `selecionado` (`#001E63`) com fio `destaque`. Valor em 40px/800 `tabular-nums`, `rounded-2xl`, nível 1. Depósito em cartão `papel` ao lado; extrato em tabela (4.8). Olho de ocultar saldo como botão de ícone.
- **Meus arremates**: cada lote é um **canhoto** (`rounded-xl`, fio, nível 1) com dois blocos: stub à esquerda ("LOTE" + número) e dados à direita, separados por picote tracejado de 2px com dois semicírculos na cor da página. É o único tracejado que sobrevive, com função: separar o que se destaca. Estado como selo (4.4) na primeira linha; filtros da seção 4.7.
- **Comprovante e recibo**: continua um recibo em faixas com picote, mas em `papel`, `rounded-xl`, fio e nível 2, sem rotação e sem `drop-shadow` duro. Linhas rótulo/valor em `tabular-nums`; o hash em 14px com quebra livre. Código de barras decorativo em `tinta` 70%.
- **Auditoria**: caixa do veredito (`rounded-2xl`) com selo grande "Íntegro" (`verde`) ou "Adulterado" (`ferrugem`), ícone e texto; tabela da seção 4.8; bloco "Como conferimos" em aviso informativo. Hashes em `tabular-nums`, `overflow-wrap: anywhere` (P4).
- **Painel do leiloeiro e Criar lote**: cartões fluidos e tabela de 760px (4.8); Criar lote empilha grupos e prévia sem mudar a sequência. A prévia usa o cartão de lote com a etiqueta "NOVO".

### 4.13 Rodapé

Componente novo, só visual: `components/site-footer.tsx` (`SiteFooter`), com o conteúdo provisório num arquivo só, `lib/rodape-conteudo.ts`, para o Felipe trocar sem tocar no layout. **Todo texto do rodapé é placeholder**, escrito entre colchetes para ser reconhecido de longe e achado por busca. Nada de dado real inventado: sem CNPJ, endereço ou telefone.

**Família do cabeçalho, espelhada.** O cabeçalho é uma faixa clara no claro e uma faixa escura com linha azul de 2px embaixo no noite. O rodapé é o mesmo par, de cabeça para baixo:

| | Claro | Noite |
|---|---|---|
| Fundo | `papel` (`#FFFFFF`) | `papel` (`#151A21`) |
| Borda superior | 1px `borda` | **2px `destaque`** (a linha azul do cabeçalho noite) |
| Sombra | `shadow-rodape` (a do cabeçalho invertida) | nenhuma |
| Logo | placa **escura** (como no cabeçalho claro) | placa **clara** (como no cabeçalho noite) |
| Texto | `tinta` e `tinta2` | `tinta` e `tinta2` |

O logo é o `Logo` de `ui/logo.tsx`, tamanho "tela", com as mesmas variáveis `--f-logo-papel` e `--f-logo-tinta` que `.cabecalho` define. Para não duplicar, o seletor passa a ser `.cabecalho, .rodape { … }` nas variáveis do logo, e `.rodape .logo-placa` recebe a mesma `--h-logo-sombra`. Os links do logo (`aria-label="LanceAuto, vitrine"`) repetem o do cabeçalho: dois landmarks diferentes, nenhum conflito.

**Estrutura** (`<footer>` = landmark `contentinfo`; largura `min(100% - 2 * var(--gutter-lateral), 1320px)`, igual ao cabeçalho)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⟨LANCE·AUTO⟩         NAVEGUE         SUA CONTA        CONTATO               │
│ [Frase de            Vitrine         Entrar           [E-mail de contato]   │
│  apresentação        Como funciona   Criar conta      [Telefone]            │
│  provisória]         [Sobre]                          [Horário]             │
│                      [Termos]                         (●) (●) (●)  ← redes  │
│─────────────────────────────────────────────────────────────────────────────│
│ [Espaço para avisos legais: termos, privacidade e aviso de saldo simulado.] │
│ © [ano] LanceAuto · [Texto de direitos provisório]                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Linha 1** (`flex flex-wrap`, gap 32px, sem breakpoint): marca (`flex: 2 1 280px`: logo + frase de apresentação em `rodape-legal`, `max-width: 36ch`) e três colunas (`flex: 1 1 160px`): Navegue, Sua conta, Contato. Em tela estreita as colunas descem em grade natural, uma ou duas por linha.
- **Linha 2**: fio 1px (`borda` no noite; no claro, `borda` a 100% já aparece sobre `papel`), 24px de respiro, o **espaço de avisos legais** em `rodape-legal`, `max-width: 80ch`.
- **Linha 3**: linha de direitos em `rodape-legal`, à esquerda; `flex-wrap` com a legal. Sem "voltar ao topo" (seria função nova).
- **Respiros**: 64px entre o fim do conteúdo da página e o rodapé; 48px em cima e 32px embaixo do conteúdo do rodapé.

**Títulos de coluna**: `rodape-titulo` (12/700, caixa-alta, tracking .08em, `tinta`), a 12px da lista. As colunas são `<nav aria-label="Rodapé">` num único landmark, com os títulos em `<p>` (e não `<h2>`, para não poluir o índice de títulos da página).

**Conteúdo provisório e regra de links.** Só entra `<a>` para rota que já existe. O resto é texto entre colchetes, **sem** `href`, em `tinta2`, sem sublinhado e sem hover.

| Coluna | Item | Tipo | Destino ou texto |
|---|---|---|---|
| Navegue | Vitrine | link | `/` |
| Navegue | Como funciona | link | `/#como-funciona` |
| Navegue | [Sobre o LanceAuto] | texto provisório | sem rota |
| Navegue | [Termos de uso] | texto provisório | sem rota |
| Sua conta (visitante) | Entrar | link | `/entrar?aba=entrar` |
| Sua conta (visitante) | Criar conta | link | `/entrar` |
| Sua conta (licitante) | Meus arremates, Carteira | link | `/arremates`, `/carteira` |
| Sua conta (leiloeiro) | Meus lotes, Criar lote | link | `/painel`, `/painel/criar-lote` |
| Contato | [E-mail de contato], [Telefone], [Horário de atendimento] | texto provisório | sem dados reais |
| Contato | Redes sociais (3 espaços) | ícone provisório | sem `href` |
| Marca | [Frase de apresentação provisória: uma linha sobre o LanceAuto.] | texto | — |
| Avisos | [Espaço para avisos legais: termos, privacidade e aviso de saldo simulado.] | texto | — |
| Direitos | © [ano] LanceAuto · [Texto de direitos provisório] | texto | — |

A coluna "Sua conta" segue o mesmo critério por papel do cabeçalho (`useAuth`); enquanto a sessão carrega, a coluna reserva a altura e não mostra nada (sem salto de layout). Se a leitura do papel pesar, a alternativa aceita é mostrar só "Entrar" e "Criar conta" para visitantes e nada para quem já tem sessão.

**Redes sociais (provisório).** Três círculos de 44px (`rounded-full`), fundo `suave`, fio `borda`, ícone de 20px em `tinta2`, `<span role="img" aria-label="Rede social [provisória]">`, `cursor: default`. Quando virarem links reais, passam a `<a>` com o estilo do botão de ícone (4.1: fio `linha`, fundo `papel`, hover `suave`, foco global).

**Estados dos links do rodapé**

| Estado | Claro | Noite |
|---|---|---|
| Padrão | texto `tinta2`, `rodape-link`, sem sublinhado, altura mínima de 44px (`inline-flex items-center`) | idem |
| Hover | texto `tinta`, sublinhado com `underline-offset: 3px` | idem |
| Foco | anel global de 3px `foco` com 2px de afastamento | idem |
| Ativo (página atual) | texto `ocreTexto`, `aria-current="page"` | idem |
| Texto provisório | `tinta2`, sem interação | `tinta2`, sem interação |

**Em quais telas aparece**

| Tela | Rodapé | Por quê |
|---|---|---|
| Vitrine `/` | **Completo** | É a porta de entrada; fim natural da página |
| Entrar `/entrar` | **Completo** | Tela estática, sem tempo real |
| Carteira, Meus arremates | **Completo** | Telas de conta, longas e estáticas |
| Painel e Criar lote | **Completo** | Telas de trabalho do leiloeiro, sem disputa em curso |
| **Sala de lances** `/lotes/[id]` | **Nenhum** | É o único lugar com decisão em tempo real: relógio, painel de lance e histórico precisam ser a única coisa na tela. Um rodapé com links e redes no fim de um histórico longo atrapalha a leitura e dá mais pontos de Tab depois da lista |
| Comprovante `/c/[token]` e Auditoria `/lotes/[id]/auditoria` | **Mínimo**: só as linhas de avisos e de direitos, sem logo nem colunas | O cabeçalho dessas telas já é mínimo; mantém a coerência sem competir com o documento. **`print:hidden` no Comprovante**, que é impresso |
| Telas de erro e de "não encontrado" dentro de `(site)` | Completo | Herdam o layout |

Como a Sala fica dentro do grupo `(site)`, a implementação mais barata é um invólucro cliente fino que lê `usePathname()` e **não renderiza** o rodapé quando o caminho casa com `/lotes/<id>` (sem `/auditoria`). Mover a Sala para outro grupo de rotas é a alternativa e traz mais risco; fica a critério da Amelia, desde que o resultado visual seja o da tabela.

**Posição.** O rodapé fica no fim do documento, não fixo: `body` como coluna (`min-height: 100vh; display: flex; flex-direction: column`) e `main` com `flex: 1`, para o rodapé encostar no pé da janela em páginas curtas. Nunca cobre conteúdo nem a barra de rolagem.

**Responsivo**: a 320px as colunas empilham em uma só, a marca vem primeiro, o espaço legal e os direitos ficam por último, sem rolagem horizontal. A 1280px a linha 1 abre em quatro blocos. Os alvos (links e círculos) são de 44px.

## 5. Estados de lote

Cada estado tem cor, ícone e texto próprios, em selo e em etiqueta. Nenhum depende só da cor.

| Estado (status) | Cor | Selo (texto canônico) | Ícone | Etiqueta | Cronômetro |
|---|---|---|---|---|---|
| **Agendado** (`SCHEDULED`) | azul suave (`selecionado`) | "ABRE …" | relógio | azul | "ABRE EM", `led` |
| **Aberto** (`LIVE`) | azul sólido (`ocre`) | "Ao vivo" | ponto que pulsa | azul | "RESTAM", `led` |
| **Encerrando** (`LIVE` ≤ 2 min; `CLOSING` = "Apurando") | âmbar (`alerta`) | "ÚLTIMOS 2 MIN" no cronômetro e "Apurando…" na Sala | relógio com alerta | azul | borda `ledAlerta` de 2px, LED laranja pulsando |
| **Encerrado** (`SOLD`, `UNSOLD`) | grafite (`tinta`) para Arrematado; fio neutro para Sem lances | "Arrematado" / "Sem lances" | martelo / traço | neutra (`papel`) | "ENCERRADO", "00:00" |
| **Cancelado** (`CANCELLED`) | vermelho suave (`falha` + `ferrugem`), borda tracejada | "Cancelado" | círculo cortado | neutra (`papel`) | sem cronômetro |

- **Encerrando não ganha selo novo.** A Sala e o cartão já têm "ÚLTIMOS 2 MIN" e "Apurando…". Criar o texto "Encerrando" mexeria em texto canônico (decidido).
- **Cancelado** usa vermelho porque é um desfecho negativo imposto, sem ser erro do usuário. Decidido em 27/10; o cinza tracejado ficou descartado por se confundir com "Sem lances".
- Vermelho fica para erro, superado, adulterado e cancelado. Verde, só para ganhando e íntegro. Âmbar, só para urgência e alerta.

### 5.1 Matriz do cartão de lote (Rev. 05)

Cada linha é um estado do `LotCard`. Todos mantêm a mesma estrutura (4.6), a mesma altura de foto e o mesmo corpo, para a grade não saltar quando o lote muda de estado. "Selo" é o `Stamp` de 28px na faixa da etiqueta. Os textos são os que o código já usa.

| Estado | Etiqueta | Selo (ícone · texto) | Foto | Rodapé do corpo | Cronômetro |
|---|---|---|---|---|---|
| **Ao vivo** (`LIVE`, mais de 2 min) | `ocre` | sólido `ocre`/`sobreOcre` · ponto que pulsa · "Ao vivo" | normal | "LANCE ATUAL", valor 28px, "N lances" | normal: "RESTAM", `led`, borda 1px `linha` |
| **Encerrando** (`LIVE`, ≤ 2 min ou prorrogado) | `ocre` | `alertaSuave`/`alerta`, borda `alerta` a 40% · relógio com alerta, **sem pulso** · "Ao vivo" (mesmo texto) | normal | igual ao ao vivo | "ÚLTIMOS 2 MIN", `ledAlerta` pulsando, borda 2px `ledAlerta`, ícone de alerta; com prorrogação, selo "+2 MIN" na linha dos dígitos |
| **Apurando** (`CLOSING`) | `ocre` | nenhum (como hoje) | normal | "Apurando o resultado…" em `alerta` com ícone de relógio | borda 2px `ledAlerta`, sem pulso |
| **Agendado** (`SCHEDULED`) | `ocre` | `selecionado`/`ocreTexto`, borda `ocre` a 30% · relógio · "ABRE …" (texto de `opensLabel`) | normal | "LANCE INICIAL", valor 28px, "incremento R$ X", caixa "ABERTURA" | só a caixa "ABERTURA" (sem relógio) |
| **Ao vivo sem lances** (`bidCount` 0) | `ocre` | igual ao ao vivo | normal | rótulo "LANCE INICIAL", valor 28px, a frase que `bidsText(0)` já devolve em `tinta2` | normal |
| **Encerrado, arrematado** (`SOLD`) | neutra (`papel`, contorno `linha`) | `tinta`/`fundo` · martelo · "Arrematado" | véu (abaixo) | "RESULTADO" + linhas de `endedCardLines`; valor 24px/800 | nenhum |
| **Encerrado, sem lances** (`UNSOLD`) | neutra | transparente, texto `tinta2`, borda tracejada 1px `linha` · traço · "Sem lances" | véu | "RESULTADO" + "Sem lances" | nenhum |
| **Cancelado** (`CANCELLED`) | neutra | `falha`/`ferrugem`, borda `ferrugem` a 35% · círculo cortado · "Cancelado" | véu; título intacto | "RESULTADO" sem valor em destaque | nenhum |
| **Carregando** | bloco `suave` de 64×60 no lugar da etiqueta | nenhum | bloco `suave` de 200px | barras `suave` (abaixo) | bloco `suave` de 96×52, `rounded-xl` |
| **Prévia** (Criar lote) | "NOVO" | conforme o status escolhido | URL digitada | conforme o status | conforme o status |

**Véu da foto nos encerrados e cancelados**: camada sobre a foto com `painel` a 25% (escurece nos dois temas; `tinta` clarearia no noite). Não usa `opacity` na foto nem no texto: o contraste do título e do rodapé não muda.

**O selo acompanha o relógio.** Para o selo ficar âmbar nos últimos 2 minutos, o cartão precisa saber a variante do cronômetro. Os dados são os mesmos que o `Cronometro` já usa (`countdownState` de `lib/lots` e `useServerNow`): é leitura, não regra nova, e o texto do selo continua "Ao vivo". Se isso pedir mudar a assinatura do `Cronometro`, avisar antes; o fallback aceito é manter o selo azul e deixar o relógio sozinho dar o alerta.

**Esqueleto de carregamento.** O mesmo casco do cartão (fio, raio, sombra, altura de foto), com blocos `suave` e `rounded-md` no lugar do conteúdo: três barras no corpo (título a 70% e 45% de largura, meta a 55%), o fio, uma barra de 28px a 40% (o preço) e o bloco do cronômetro. Pulso lento de opacidade (`la-pulsa`, 1,6s) que desliga com `prefers-reduced-motion`, sem perder o desenho. O conjunto vai em um contêiner `role="status"`, `aria-busy="true"`, com o texto de carregamento que o `FeedbackState` já usa, em `sr-only`; os blocos são `aria-hidden`. Substitui só o bloco central "Carregando" do **primeiro** carregamento da Vitrine (três esqueletos na grade); o refetch em segundo plano não mostra esqueleto, como hoje.

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

**Rev. 05: pares novos** (mesma fórmula, calculados por script; mínimos 4,5:1 texto, 3:1 elemento gráfico)

| Par | Claro | Noite | Uso |
|---|---|---|---|
| `tinta` / `papel` | 17,14 | 16,00 | segmento padrão, título e preço do cartão, links do rodapé ao passar o mouse |
| `tinta2` / `papel` | 7,17 | 7,17 | rótulo de campo, placeholder, meta do cartão, links e textos do rodapé |
| `tinta2` / `suave` | 6,22 | 6,46 | segmento desabilitado, texto da caixa "ABERTURA" |
| `linha` / `papel` | 3,80 | 4,13 | fio de busca, seletor e trilho (elemento gráfico) |
| `foco` / `papel` | 7,44 | 7,72 | anel e fio de foco |
| `ocreHover` / `selecionado` | 6,46 | n/a | hover do segmento no claro |
| `ocreTexto` / `selecionado` | 9,20 | 5,30 | hover do segmento no noite; selo "ABRE …" (claro: `#0033A0` sobre `#E8EFFF`) |
| `sobreOcre` / `ocre` | 10,60 | 7,44 | segmento selecionado, selo "Ao vivo" |
| `sobreOcre` / `ocreHover` | 7,44 | 6,04 | segmento selecionado com hover |
| `ocre` / `papel` (trilho) | 10,60 | **2,35** | no noite o fundo do selecionado sozinho **não** identifica o estado: a borda `destaque` cobre |
| `destaque` / `papel` (trilho) | n/a | 4,02 | borda do segmento selecionado no noite |
| `destaque` / `fundo` | n/a | 4,32 | linha de 2px no topo do rodapé noite |
| `sobreOcre` / `ocre` + 20% branco | 6,32 | 4,75 | contador dentro do segmento selecionado |
| `fundo` / `tinta` | 16,29 | 17,19 | selo "Arrematado" |
| `alerta` / `alertaSuave` | 6,19 | 8,82 | selo do "Ao vivo" nos últimos 2 min |
| `verde` / `verdeSuave`, `ferrugem` / `falha` | 4,75 · 5,65 | 8,17 · **6,01** | selos "Íntegro" e "Cancelado" |
| `led` / `painel` | 10,09 | 11,01 | dígitos; selo "+2 MIN" (`painel` sobre `led`) |
| `ledAlerta` / `painel` | 6,34 | 6,92 | dígitos, rótulo e **borda de 2px** do "encerrando" |
| `linha` / `painel` | 4,75 | 4,65 | borda de 1px do cronômetro normal |
| **`alerta` / `painel`** | **2,65 (falha)** | n/a | **não usar como borda do cronômetro**: por isso a borda do "encerrando" é `ledAlerta` |
| `tinta` / `painel` a 25% (véu) | n/a | 18,02 | o véu sobre a foto não toca texto; o contraste dos textos do cartão não muda |

**Cor nunca sozinha, conferido no cartão e nos filtros.** Segmento selecionado: preenchimento sólido contra transparente, texto branco contra `tinta`, e `aria-pressed` (no noite, mais a borda). Selos: sempre ícone mais texto; "Sem lances" e "Arrematado" diferem pelo traço (tracejado contra sólido), pelo ícone e pela palavra. Cronômetro: rótulo, ícone e borda grossa. Em escala de cinza, os estados do cartão (5.1) continuam distintos.

### 6.2 Foco

Anel de 3px `foco` com `outline-offset: 2px`, em `:focus-visible` (e em `label:has(input:focus-visible)`). Nunca é removido. Vale para o segmento do filtro, o campo de busca, o seletor, o cartão de lote inteiro e os links do rodapé. Em campo, a borda também troca para `foco` (7,44:1 no claro, 7,72:1 no noite). Dentro do trilho com rolagem horizontal (tela estreita), o invólucro com `padding: 6px; margin: -6px` evita que o `overflow` corte o anel. O anel passa 3:1 em todas as superfícies do sistema (tabela acima) e fica sobre o fundo da página, no afastamento, mesmo quando o botão é azul. Em cartão inteiro clicável, o anel contorna o cartão.

### 6.3 Alvos de toque e demais regras

- **Alvo mínimo 44×44px** em botões, links de navegação, filtros, atalhos e botões de ícone. Os botões compactos de 40px do cabeçalho passam a 44px com `pointer: coarse` (decidido). O mínimo do WCAG 2.2 é 24px; o projeto adota 44. O segmento do filtro tem 36px visuais e **44px clicáveis** (pseudo-elemento); links e círculos do rodapé têm 44px.
- **Texto mínimo** de 12px, só em rótulos e selos em caixa-alta e `font-weight` ≥ 700. Exceções da Rev. 05: o rótulo de campo e a meta do cartão têm 13px/600 e 13px/500, e o texto legal do rodapé 13px/400, sempre em `tinta2` (≥ 6,2:1). Corpo a partir de 15px.
- **Estado nunca só por cor**: selo com texto, ícone nos avisos, faixa de posição com título, borda e rótulo no cronômetro.
- **Links em texto corrido** com sublinhado; `a:hover` não troca para vermelho.
- **Movimento**: `prefers-reduced-motion` desliga animação e transição. O cronômetro e o estado dos lances não dependem de movimento.
- **Zoom e reflow**: sem rolagem horizontal da página a 320px e a 200%. Só tabelas rolam, dentro de região identificada.
- **Tema**: segue `prefers-color-scheme`; o seletor do cabeçalho (Sistema/Claro/Noite) prevalece. `color-scheme` acompanha.

## 7. Ordem de implementação

Roteiro para a Amelia. **Um commit por etapa**, em português, atômico, sem marca de IA, no formato `Repaginação n/16: …`. Cada etapa fecha com `npm run typecheck`, `npm run lint`, `npm test` e uma conferência no Chrome real **nos dois temas, em 320, 360 e 1280px**. Só estilo: nenhuma etapa mexe em texto canônico, rota, fluxo ou regra. Toda etapa mantém os `aria-*`, a ordem do DOM e os `data-*` que os testes usam.

**Rev. 05: o roteiro foi refeito.** A Rev. 04 tinha 12 etapas; a etapa 1 (tokens) já está feita (commit `fc0966d`). A Rev. 05 abre as etapas 2 a 11 na ordem que o Felipe pediu: **tokens e botões, depois filtros, cartão e por fim o rodapé**, e leva o resto (Sala, avisos, tabelas, telas de conta, limpeza) para as etapas 12 a 16, com o mesmo conteúdo de antes. Mapa, Rev. 04 → Rev. 05: 1→1, 2→2, 3→3, 4→4, 5 (selos)→6, 6 (cartão, filtros e foto)→5, 8, 9 e 10, 7→7, 8→12, 9→13, 10→14, 11→15, 12→16; o rodapé (11) é novo.

| # | Etapa e commit sugerido | Arquivos principais | Pronto quando |
|---|---|---|---|
| 1 | ✅ **Tokens** claro e noite (feito) | `globals.css`, `tailwind.config.mjs` | Feito em `fc0966d` |
| 2 | **Tokens da Rev. 05 e base**: `--sh-rodape` (claro e noite, inclusive o bloco `prefers-color-scheme`) e `shadow-rodape`; classes `.t-rotulo-campo`, `.t-filtro`, `.t-titulo-cartao`, `.t-meta-cartao`, `.t-rotulo-cartao`, `.t-lance-cartao`, `.t-rodape-*`; `.t-botao` e `.t-botao-primario` em caixa normal (15/600 e 16/600); foco global (anel `foco` de 3px, offset 2px, sem o `box-shadow` de papel); links com sublinhado em texto corrido e `a:hover` sem `ferrugem`; `body` como coluna (`min-height: 100vh`, `main` com `flex: 1` no `(site)`); `.cabecalho, .rodape` agrupados nas variáveis do logo. | `globals.css`, `tailwind.config.mjs`, `(site)/layout.tsx` | Nenhuma classe nova está em uso ainda; o foco já é azul e visível em todos os controles, nos dois temas |
| 3 | **Botões**: `buttonClasses` com primário, secundário, fantasma, perigo (secundário e sólido), desabilitado, carregando (spinner), atalho (pílula de 44px) e ícone (círculo de 44px); padrão em `rounded-xl` (12px), compacto em `rounded-lg`; hover, pressionado e foco; `SkipLink`. Os botões da conta no cabeçalho usam as mesmas classes (compacto, 8px). | `ui/button.tsx`, `site-header.tsx`, `ui/skip-link.tsx` | Todas as variantes com os cinco estados (4.1); teste de `loading` mantido |
| 4 | **Campos de formulário**: `Field` (rótulo `rotulo-campo`, 48px, `rounded-xl`, `papel` nos dois temas, fio `linha`, hover, foco, erro, desabilitado), `MoneyField`, campo e atalhos do lance, valores do depósito, abas de acesso. | `ui/field.tsx`, `money-field.tsx`, `lots/bid-form.tsx`, `access-tabs.tsx` | Erro com cor, ícone e texto; borda de campo ≥ 3:1 nos dois temas |
| 5 | **Filtros: busca, Marca e status.** `ui/search-field.tsx` e `ui/select-field.tsx` (invólucros visuais: lupa, chevron próprio, 44px, estados da 4.7), `FilterTabs` como controle segmentado (trilho, segmento de 36px com área de 44px, os oito estados) e a barra da Vitrine (`flex-wrap`, rótulos discretos, 12/16px de gap, rolagem do trilho a 320px). Se o diff ficar grande, parte em duas: (a) busca e Marca, (b) status. | `ui/filter-tabs.tsx`, `ui/search-field.tsx`, `ui/select-field.tsx`, `vitrine.tsx`, `ui/ui.test.tsx` | Tabela de estados da 4.7 conferida no Chrome nos dois temas; `aria-pressed` e ordem de Tab intactos; busca com debounce de 250ms e filtro por marca funcionam como antes; sem rolagem horizontal na página a 320px |
| 6 | **Selos**: `Stamp` vira pílula (28px no cartão e na Sala, 24px em tabela), sem rotação, sem contorno duplo, com ícone e texto, inclusive a variante âmbar e a de cancelado; `LotTag` com os tons novos (cancelado neutro); `StatusSeal` de "Meus arremates". | `ui/stamp.tsx`, `ui/lot-tag.tsx`, `my-bids/status-seal.tsx`, `ui/ui.test.tsx` | Os estados da 5.1 distinguíveis em escala de cinza; testes do `Stamp` atualizados para a pele nova (sem a rotação de -4°) |
| 7 | **Cronômetro e placas**: display novo (12px de raio, padding `8px 12px` no cartão), borda de 2px `ledAlerta` no "encerrando", ícone de alerta no rótulo, **`SeloProrrogacao` dentro do fluxo, na linha dos dígitos** (sem `position: absolute`), `placa-lance`. | `lots/cronometro.tsx`, `lots/placa-lance.tsx`, `lots/cronometro.test.tsx` | `tabular-nums` e `nowrap` intactos; o "+2 MIN" não toca o rótulo a 320px, no cartão e na Sala; a pendência de `deferred-work.md` fecha; `cronometro.test.tsx` verde |
| 8 | **Foto do cartão**: `CarPhoto` com altura de 200px no cartão, `rounded-t-[inherit]`, véu `painel` a 25% nos encerrados (prop `dimmed` troca `opacity` por véu), silhueta em `tinta` sobre `suave`. | `lots/car-photo.tsx` | Foto e véu nos dois temas; o texto sob o véu não perde contraste |
| 9 | **Cartão de lote**: casca (`rounded-2xl`, fio `borda`, nível 1, hover com 2px de subida e sombra nível 2, foco), **ordem foto → faixa da etiqueta → corpo**, título e meta novos, **lance de 28px**, rodapés por estado (ao vivo, agendado, encerrado, cancelado, sem lances, apurando), selo âmbar nos últimos 2 min, caixa "ABERTURA" em `rounded-xl`. A prévia do Criar lote usa o mesmo cartão. | `lots/lot-card.tsx`, `lots/lot-card.test.tsx`, `vitrine.tsx` (grade) | Todos os estados da 5.1 renderizados; título de 1, 2 e 4 linhas; 360, 768 e 1280px; cartões vizinhos com os rodapés alinhados; `lot-card.test.tsx` verde |
| 10 | **Esqueleto do cartão**: `lots/lot-card-skeleton.tsx` (mesmo casco, blocos `suave`, pulso lento) no lugar do bloco central "Carregando" **só no primeiro carregamento** da Vitrine; `role="status"` com o texto de carregamento atual em `sr-only`. | `lots/lot-card-skeleton.tsx`, `vitrine.tsx` | Sem salto de layout quando os cartões reais chegam; `reduced-motion` sem pulso; refetch em segundo plano sem esqueleto |
| 11 | **Rodapé**: `site-footer.tsx` (completo e mínimo), `lib/rodape-conteudo.ts` (todos os placeholders entre colchetes), CSS `.rodape` (espelho do cabeçalho), `(site)/layout.tsx` com o invólucro que esconde o rodapé na Sala, `(publico)` e `(auditoria)` com a versão mínima e `print:hidden`. A nota final da própria Vitrine (a de "Lotes cancelados não aparecem aqui") troca o tracejado por fio de 1px `borda`. | `site-footer.tsx`, `lib/rodape-conteudo.ts`, `globals.css`, `(site)/layout.tsx`, `(publico)/layout.tsx`, `(auditoria)/layout.tsx`, `vitrine.tsx` | Rodapé nos dois temas; completo na Vitrine, Entrar, Carteira, Arremates, Painel e Criar lote; **ausente na Sala**; mínimo no Comprovante e na Auditoria; fora da impressão do Comprovante; nenhum `href` para rota que não existe; 320px sem rolagem horizontal; foco e Tab corretos |
| 12 | **Sala**: painel, faixa de posição, histórico, resultado e carimbo, cancelado, "Apurando". | `sala.tsx`, `lots/bid-panel.tsx`, `lots/faixa-status.tsx`, `lots/placar-posicao.tsx`, `lots/bid-history.tsx`, `lots/resultado-do-lote.tsx` | Todas as variantes da Sala conferidas, incluindo 320px; **sem rodapé** |
| 13 | **Avisos e diálogos**: `FeedbackState`, `RefusalMessage`, `ConnectionBanner`, `AvisoPapel`, estados globais, `Dialog` e `CancelDialog`, menu do perfil. | `ui/feedback-state.tsx`, `ui/refusal-message.tsx`, `connection-banner.tsx`, `aviso-papel.tsx`, `global-states.tsx`, `ui/dialog.tsx`, `cancel-dialog.tsx`, `profile-menu.tsx` | Os quatro tipos de aviso com ícone; foco devolvido ao fechar |
| 14 | **Tabelas e listas**: `DataTable`, extrato da Carteira, painel do leiloeiro, lista de lances e chip do licitante. | `ui/data-table.tsx`, `wallet-screen.tsx`, `painel-screen.tsx`, `lots/chip-licitante.tsx` | Rolagem horizontal em região focável a 360px |
| 15 | **Telas de conta e consulta**: Acesso (bilhetes), Carteira ("Disponível"), Arremates (canhoto), Comprovante e recibo, Auditoria. | `access-screen.tsx`, `role-tickets.tsx`, `my-bids/*`, `comprovante/*`, `audit/*`, `criar-lote-form.tsx` | Cada tela conferida nos dois temas; veredito da Auditoria legível sem cor |
| 16 | **Limpeza e conferência final**: remover `rounded-nenhum`, `border-2`, `border-dashed` e sombras duras que sobraram; varrer `ferrugem` no hover; conferir os pares da seção 6 renderizados; zoom de 200% e 320px; atualizar `progresso.md`. | todo `apps/web/src` | Nenhuma sombra dura nem canto reto restante (exceto picote e chanfro da etiqueta); lint, typecheck e testes verdes |

**Dependências.** 3 antes de 4 e 5 (os campos reusam o foco e o raio); 6 e 7 antes de 9 (o cartão monta o selo e o cronômetro novos); 8 antes de 9; 5, 9 e 10 todas dentro da Vitrine, em commits separados; 11 não depende de nada além da 2 e pode vir antes da 9 se o Felipe quiser ver o rodapé primeiro, mas a ordem pedida é a de cima.

**Pontos de atenção para a Amelia**

- `lots/canhoto.tsx` **não entra** em nenhuma etapa: é o "Como funciona" e já está no padrão novo.
- O `Stamp` e o `Cronometro` têm testes que afirmam rotação, `la-pulsa` e posição do selo; esses testes mudam na 6 e na 7 junto com o visual, e só as asserções de pele (classe, rotação), nunca as de texto, `aria` ou `role`.
- O selo âmbar do "encerrando" (etapa 9) pede o estado do relógio no `LotCard`: usar `countdownState` e `useServerNow`, sem regra nova. Se complicar a assinatura do `Cronometro`, vale o fallback da 5.1.
- A conferência no Chrome real segue o roteiro do `conferencia-no-chrome-real` (banco descartável, API e web locais). Etapa de filtro e de cartão precisam de lotes ao vivo, agendado, encerrado e prorrogado no seed.
- As etapas 2 a 15 mexem na pele aos poucos, e **o site passa por um visual híbrido até a 16**. Por isso a branch `repaginacao-visual` continua local, sem push nem deploy, até a conferência final.

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
| P8 | O selo "+2 MIN" cobre parte do rótulo no cartão (pendência de `deferred-work.md`). | **Resolvido na Rev. 05**: o selo entra no fluxo, na linha dos dígitos (4.11), nunca sobre o rótulo. Só a ordem dos elementos dentro do `Cronometro` muda; o comportamento fica. A Amelia fecha a pendência na etapa 7. |
| P9 | `ferrugem` e `verde` mudam de matiz (marrom-vermelho para vermelho frio; verde mais escuro). | É coerência com o azul e contraste; os nomes ficam. |
| P10 | **Conteúdo real do rodapé.** O rodapé nasce 100% provisório: frase de apresentação, nomes das colunas, "Sobre" e "Termos" (sem rota), e-mail, telefone, horário, redes sociais, avisos legais e linha de direitos. | Fica tudo em `lib/rodape-conteudo.ts`, entre colchetes. Depende de você: o texto final, quais redes existem de verdade, e se "Sobre", "Termos" e "Privacidade" vão virar rotas (hoje não existem, e esta rodada não cria nenhuma). |
| P11 | **Título do cartão em caixa normal.** O cartão deixa o título em caixa-alta de 26px e passa a 20px/700 em caixa normal, para o lance de 28px ser o destaque. É a única mudança que mexe na "voz de cartaz" do cartão. As seções da Vitrine (AO VIVO, AGENDADOS) continuam em caixa-alta. | Adotada: caixa normal. Se você preferir manter o cartaz, o título volta a 22px/800 em caixa-alta e o lance sobe a 30px para continuar sendo o maior texto. |

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
| Filtro de status como um trilho de pílulas, selecionado em azul principal; no noite, com borda `destaque` | Quatro caixas soltas, caixa-alta, ou selecionado só pelo preenchimento no noite (2,35:1) |
| Busca, Marca e trilho com a mesma altura (44px), o mesmo fio e a mesma superfície | Alturas e raios diferentes na mesma barra |
| Cartão de lote com a foto no topo herdando o raio, e a etiqueta em faixa própria logo abaixo | Selo, etiqueta ou texto sobre a foto |
| Lance atual como maior texto do corpo do cartão (28px/800, `tabular-nums`) | Preço pintado de azul num cartão que já é um link |
| "+2 MIN" dentro do fluxo do cronômetro, na linha dos dígitos | `position: absolute` no canto, cobrindo o rótulo |
| Borda do cronômetro "encerrando" em `ledAlerta` | `alerta` do claro como borda sobre o `painel` (2,65:1) |
| Rodapé com todo texto provisório entre colchetes, só com `href` para rota que existe | CNPJ, endereço, telefone ou link inventado; rodapé na Sala de lances |

## 10. Rastreio

- Esta revisão **substitui** a Rev. 03 ("Manual de pátio"). As fontes Big Shoulders Display, IBM Plex Mono e Newsreader, a cor ocre, o papel e a tinta quente, as bordas de 3px, as sombras duras, os cantos retos, os carimbos inclinados e o tracejado como linguagem saem do sistema. O tracejado fica só no picote.
- Os mocks em `design/project/` e o mock complementar mostram a Rev. 03. Servem para estrutura e conteúdo das telas, **não** para cor, forma ou tipografia.
- O comportamento, os fluxos e os textos canônicos vêm do [EXPERIENCE.md](EXPERIENCE.md), que não muda nesta revisão.
- Referência visual aprovada: o cabeçalho (`.cabecalho` em `apps/web/src/app/globals.css`, `site-header.tsx`, `ui/logo.tsx`).
- **Rev. 05 (27/10/2026)**: segunda rodada pedida pelo Felipe (filtros, cartão de lote e rodapé). Refina as seções 4.3, 4.4, 4.5, 4.6, 4.7, 4.11, 5 (nova 5.1) e 6, cria a 4.13 e a 2.8, e refaz o roteiro (7). Nenhum token existente foi renomeado; `controle` mantém o valor de 8px. A pendência P8 (e a de `deferred-work.md`) fecha com a etapa 7.
- Código lido para esta revisão: `ui/filter-tabs.tsx`, `vitrine.tsx` (barra e nota final), `lots/lot-card.tsx`, `lots/car-photo.tsx`, `lots/cronometro.tsx`, `ui/stamp.tsx`, `ui/lot-tag.tsx`, `ui/logo.tsx`, `ui/button.tsx`, `site-header.tsx`, `globals.css`, `tailwind.config.mjs` e os layouts de `(site)`, `(publico)` e `(auditoria)`. O código ainda traz o visual antigo (`rounded-nenhum`, bordas de 3px): o "antes" descrito aqui é o do código, não o da Rev. 04.
