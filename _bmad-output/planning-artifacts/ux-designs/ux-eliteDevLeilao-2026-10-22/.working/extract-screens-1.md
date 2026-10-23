# Extração de telas 1: Sala, Vitrine, Acesso

Fonte: `_bmad-output/planning-artifacts/design/project/{Sala,Vitrine,Acesso}.dc.html` (protótipos "dc", estilos inline, lógica em `DCLogic`). Wrappers de variante lidos: `SalaGanhando/Ultimos/Prorrogado/Encerrado/Recusa/Visitante/Mobile`, `VitrineEscuro/Mobile`, `AcessoLoginEscuro/Mobile`.

Observação: os valores de cor são todos literais hex dentro de um objeto `PAL` (claro/escuro) e acessados como `c.<nome>`. Não há CSS custom properties. Os "tokens" abaixo são as chaves de `PAL`.

## 0. Base compartilhada (as 3 telas)

### Paleta (`PAL`)
| token | claro | escuro |
|---|---|---|
| fundo | #E8DFCB | #161513 |
| papel | #F5EEDF | #262420 |
| suave | #DDD3BC | #2F2C27 |
| pontos | #C9BEA5 | #3F3B34 (não existe em Acesso) |
| tinta | #1E1C19 | #ECE4D2 |
| tinta2 | #5B5449 | #B3AA99 |
| linha | #1E1C19 | #CFC5B0 |
| sombra | #1E1C19 | #3A362F |
| tracejado | #8A8273 | #6E675C |
| ocre | #E2A514 | #E8AE22 |
| sobreOcre | #1E1C19 | #161513 |
| ferrugem | #A43C1E | #E36A43 |
| verde | #2E6A3E | #74B585 |
| sobreCor | #F5EEDF | #161513 |
| painel (só Sala/Vitrine) | #141311 | #0B0B0A |
| led | #F2B92B | #F2B92B |
| ledAlerta | #FF6A3D | #FF6A3D |

Literais fora de token: `#E2A514` e `#FFFFFF` na faixa "BRASIL" do logo (iguais nos dois temas); `#F5EEDF` (dígitos das placas do lance, fixo); `#000` (linha central das placas); `#8A8273` (rótulo do relógio "TEMPO RESTANTE"/"RESTAM"/"ENCERRADO", repete valor de `tracejado` claro mas hardcoded, igual nos dois temas).

### Tipografia (Google Fonts)
- Big Shoulders Display (600/800/900): títulos, botões, números de lote, selos. Sempre `text-transform:uppercase` nos títulos/botões.
- IBM Plex Mono (400/500/600): rótulos, dados, valores, relógio, histórico.
- Newsreader (400/600, itálico 400; opsz 6..72): corpo, inputs de texto, descrições. Fallback Georgia, serif.
- Tamanhos recorrentes: h1 `clamp(...)` (Vitrine 68-184px/11vw; Sala 48-104px/7vw; Acesso 64-140px/9vw), h2 de seção `clamp(46px,6vw,76px)` (Vitrine), h2 de cartão 26px, rótulo mono 10-13px com letter-spacing .10-.16em.

### Linguagem visual
Estética "ficha de pátio" / neo-brutalista: bordas sólidas 3px (`linha`), sombra dura sem blur `Npx Npx 0 sombra` (4/5/6/8px), `border-radius:0` (exceto logo 7px, placas 3px), divisórias tracejadas 2px `tracejado`, etiquetas de lote com recorte `clip-path` (cantos chanfrados) e "barbante" em SVG, carimbos rotacionados (-5/-6deg), fundo pontilhado `radial-gradient(pontos)`.

### Layout geral
Contêiner `max-width:1320px; margin:0 auto; padding: ... clamp(16px,4vw,56px)`. Tudo é `flex-wrap`/`grid auto-fit/auto-fill` com `min()`: reflow sem media queries. Única media query: `prefers-reduced-motion: reduce { * { animation:none !important } }` (nas 3 telas).

### Header/logo (repetido)
`<a aria-label="LanceAuto, vitrine" href="Vitrine.dc.html">` com placa tipo placa de carro: faixa superior `#E2A514` com "BRASIL" (mono 8px, letter-spacing .42em, `aria-hidden`), corpo "LANCE·AUTO" (Big Shoulders 800, 28px na Sala / 30px nas demais, letter-spacing .1em) entre dois pontos de 5px; borda 3px `tinta`, raio 7px, sombra 4px.

### Animações (keyframes)
- `la-pulsa` (opacity 1→.35→1): ponto "Pátio aberto", ponto/selo "Ao vivo", relógio urgente, ponto do histórico.
- Só na Sala: `la-vira` (placa de lance gira rotateX 90→0 com brilho, .5s, atraso 0.06s por dígito), `la-bate` (carimbo "Arrematado" escala 2.6→1 e rotaciona, .55s cubic-bezier(.2,.8,.3,1)), `la-mais` (selo "+2 MIN" sobe e fixa, .6s), `la-entra` (linha nova do histórico desce de -16px, .4s), `la-marca` (linha nova com fundo rgba(226,165,20,.55)→0 em 1.6s).

### Mecanismo de tema/estado
Props do componente (editor): `tema` claro|escuro; Sala `estado` superado|ganhando|ultimos|prorrogado|encerrado|saldo|visitante (default superado); Acesso `modo` cadastro|entrar e `erro` boolean. Não há toggle de tema para o usuário final: é só prop do protótipo. Não há `prefers-color-scheme`.

---

## 1. SALA (`Sala.dc.html`, título "Sala do lote 018")

### Propósito
Sala de leilão ao vivo do lote 018 (Gol GTI 2.0 1996): mostrar lance atual, relógio, histórico em tempo real, permitir dar lance (logado), assistir (visitante), ver resultado (encerrado) e linkar comprovante/auditoria.

### Estrutura/layout (ordem)
1. Header (flex wrap, gap 14/24): logo; se logado `nav aria-label="Principal"` (Vitrine [ativo, sublinhado 3px], Carteira, Meus arremates; Big Shoulders 800 19px uppercase); à direita se logado: chip "DISPONÍVEL {saldo}" (link p/ Carteira, borda 3px `linha`, fundo `papel`, mono 13px) e chip "C3E8 [VOCÊ]" (pseudônimo do usuário; "VOCÊ" fundo `ocre`); se visitante `nav aria-label="Conta"`: botões "Entrar" (papel) e "Criar conta" (ocre), ambos min-height 44, sombra 4px, ambos linkam `Acesso.dc.html`.
2. Faixa-título (borda inferior 4px `linha`, padding 22px 0 22px 22px, flex wrap, align flex-end): etiqueta de lote rotacionada -4deg (fundo `tagCor`: ocre se aberto, `papel` se encerrado; "LOTE" mono 11px + "018" Big Shoulders 900 64px; furo circular 11px; barbante SVG); coluna central (flex 1 1 320px): breadcrumb mono 12px `tinta2` "VITRINE / AO VIVO / LOTE 018" + h1 "Gol GTI 2.0 [1996 em tinta2]" (clamp 48-104px, line-height .84); à direita, só se aberto: selo "Ao vivo" (ferrugem, borda 4px + outline 2px offset 3, rotate -5deg, Big Shoulders 900 26px, ponto pulsante 10px).
3. Corpo em duas colunas flex-wrap, gap 36px: coluna esquerda (flex 1 1 520px) e direita (flex 1 1 440px, max-width 560px). Em telas estreitas as colunas empilham (esquerda primeiro: imagem+ficha; depois painel de lance e histórico). Observação: no mobile o painel de lance fica abaixo da ficha do carro (ordem DOM), não no topo.
   - Esquerda: `figure` imagem (aspect-ratio 16/10, borda 3px, sombra 8px, fundo `suave` com pontilhado `pontos` 10px; SVG de hatch cor `tinta` com faixa `ocre`, `role="img" aria-label="Ilustração lateral de um Gol GTI 1996"`, 82% da largura; etiqueta sobre a imagem no canto sup. esq. 16/16px, fundo `papel`, borda 3px, mono 12px: "Pintado à mão pelo pátio: o leiloeiro não mandou foto"; figcaption mono 12px `tinta2`: "Imagem: ilustração padrão LanceAuto · lote sem foto do anunciante"). Abaixo `section aria-labelledby="ficha-t"` "Ficha do carro" (cabeçalho com h2 26px e "FONTE: TABELA FIPE · OUT/2026" mono 11px; `dl` grid `repeat(auto-fit, minmax(min(100%,220px),1fr))`, column-gap 32px; cada item dt mono 12px `tinta2` + dd 18px peso 600 alinhado à direita, separador tracejado 2px; ao fim parágrafo 17px "NOTA DO LEILOEIRO · " mono 12px + texto em itálico).
   - Direita: `section aria-label="Painel de lance"` (borda 3px, sombra 8px) e `section aria-labelledby="hist-t"` "Histórico de lances".
4. Painel de lance, de cima para baixo: (a) faixa de status (`aria-live="polite"`, bg/fg por estado, título Big Shoulders 900 clamp 30-42px uppercase + subtítulo mono 13px); (b) bloco lance atual + relógio (flex wrap, space-between, flex-end); (c) se prorrogado, parágrafo explicativo; (d) divisória tracejada; (e) uma de três áreas mutuamente exclusivas: formulário de lance (logado e aberto), CTA de visitante, ou resultado (fechado).
5. Histórico: cabeçalho (h2 + contador "{NN} LANCES" com ponto pulsante), `ol aria-live="polite"` com linhas em grid `44px minmax(0,1fr) auto auto` (nº, licitante [+VOCÊ], valor, hora), rodapé "Lance inicial R$ 22.000,00 · aberto 18:10" + link "Auditar este lote" (`Auditoria.dc.html`, cor `tinta2`).

### Bloco "lance atual"
Rótulo mono 11px "LANCE ATUAL · R$"; valor exibido como placas de painel flip (cada dígito/ponto uma "placa": fundo `painel`, cor #F5EEDF, mono 600 40px, 40px de largura x 60px de altura, ponto milhar com 16px de largura, raio 3px, linha central #000 2px) + sufixo ",00" mono 20px. Container tem `aria-label="Lance atual R$ ..."` e as placas são `aria-hidden`. Abaixo: "{lider} · {NN} lances" mono 13px `tinta2` (`lider` = "Você" se o usuário lidera e logado, senão "Licitante XXXX").
Animação de troca: dois blocos alternados `flipA`/`flipB` por paridade de `flip` para reiniciar a animação CSS.

### Relógio
Caixa fundo `painel`, borda 3px (`relogio.borda`), rótulo mono 10px, `role="timer" aria-label="Tempo restante mm:ss"`, texto mono 600 58px; fantasma "88:88" com opacity .1 atrás (efeito LED de 7 segmentos) e valor real sobreposto absoluto.

### Estados e o que muda (lógica em `CENA`)
Dados por cena (todas partem de 14 lances BASE, último = 9A6F R$ 30.500 às 18:42:10):

| estado | lances extras | agora | restante | notas |
|---|---|---|---|---|
| superado (default) | nenhum | 18:46:52 | 728s (12:08) | `rival:true` (ver abaixo) |
| ganhando | C3E8 R$ 31.000 às 18:44:55 | 18:45:37 | 563s | |
| ultimos | nenhum | 18:58:23 | 97s | já em urgência |
| prorrogado | C3E8 R$ 31.000 às 18:59:19 | 18:59:20 | 160s | `prorrogou:true` |
| encerrado | 18:57:02 C3E8 31.000; 18:58:11 9A6F 32.000; 18:58:49 C3E8 33.500 | 19:00:49 | 0 | `fim:'19:00:49'`, venceu o usuário |
| saldo | nenhum | 18:48:48 | 612s | `valor:'50.000'` pré-preenchido, `erro:'saldo'` |
| visitante | nenhum | 18:46:52 | 728s | sem login |

Tick de 1s decrementa o relógio em tempo real; ao chegar em `fimSeg` fecha automaticamente (`fechado`, `fimHora = hms(fimSeg)`, erro limpo, `flip+1`).

Efeito visual por estado:
- **Superado** (logado, não lidera): faixa fundo `ferrugem` / texto `sobreCor`; título "Você foi superado"; sub "Seu lance (R$ X,00) é o Nº maior de N" (X = maior lance do usuário, N = nº de licitantes distintos). Chip "DISPONÍVEL" mostra TOTAL - OUTROS_TRAVADO (R$ 47.500,00). Rodapé do formulário: "Nada travado neste lote".
- **Ganhando** (usuário lidera, aberto): faixa `verde`, título "Você está ganhando", sub "Seu lance é o maior · 1º de N licitantes". Disponível reduz pelo valor travado (100.000 - 52.500 - 31.000 = R$ 16.500,00) e rodapé mostra "R$ 31.000,00 travados neste lote". Dar lance gera erro "ganhando" (ver abaixo). No histórico a linha do topo traz selo "VOCÊ" cheio (ocre); linhas antigas do usuário trazem "VOCÊ" contornado (borda 2px `linha`, 11px).
- **Últimos 2 minutos** (restante < 120s e aberto): relógio com cor `ledAlerta` (#FF6A3D) pulsando (`la-pulsa 1s infinite`), rótulo "ÚLTIMOS 2 MIN" em `ledAlerta`, borda do relógio `ferrugem`. Nenhuma mudança na faixa de status por si só.
- **Prorrogado** (+2 min): ocorre quando usuário dá lance com restante < 120 (`estica`): `fimSeg += 120`, `prorrogou=true`. Aparece selo "+2 MIN" (ocre, borda 3px, Big Shoulders 900 22px, rotate -6deg, animação `la-mais`) sobre o canto sup. dir. do relógio e o parágrafo "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às {hh:mm:ss}. Ninguém leva no susto." O selo e o parágrafo somem quando fecha. Cena "prorrogado" começa já com `prorrogou:true`. Observação: o aviso persiste até o fim do leilão (não some após alguns segundos).
- **Encerrado**: faixa depende de quem lidera: usuário: fundo `verde`, título "Você arrematou", sub "Martelo batido às {hora} · R$ X,00"; outro: fundo `tinta`/texto `fundo`, título "Martelo batido", sub "Licitante XXXX levou por R$ X,00". Relógio "00:00" em `led`, sem animação, rótulo "ENCERRADO" (#8A8273), borda `linha`. Selo "Ao vivo" do título some; etiqueta de lote vira `papel`. Ponto do histórico vira `tinta2` sem pulso. Formulário desaparece, entra carimbo "Arrematado" (Big Shoulders 900 52px, borda 5px + outline 2px, rotate -6deg, animação `la-bate`), frase `fimFrase`, botões. Frase se venceu: "Você levou o Gol GTI por R$ X,00. O valor saiu do saldo e o comprovante já tem link público." Frase se não venceu: "Licitante XXXX levou por R$ X,00. Seu saldo travado voltou para a carteira." Botão "Ver comprovante" (link `Comprovante.dc.html`, ocre, só se `venceu`) e botão "Dar lance" fantasma (borda 3px tracejada `tinta2`, texto `tinta2`) que, ao clicar, mostra erro "fechado".
- **Recusa por saldo (`estado=saldo`)**: campo pré-preenchido "50.000" (maior que o disponível R$ 47.500,00) com `erro:'saldo'` inicial: borda do campo `ferrugem`, `aria-invalid="true"`, caixa `role="alert"` (borda 2px tracejada `ferrugem`, texto `ferrugem` 16px, ícone SVG de "proibido") com "Saldo insuficiente: você tem R$ 47.500,00 disponíveis." + link "Depositar na carteira →" (`Carteira.dc.html`, ferrugem, 600). Só esse erro mostra o link.
- **Visitante**: sem nav principal nem chips de saldo, no lugar botões "Entrar"/"Criar conta". Faixa `tinta`/`fundo`: título "Você está assistindo", sub "Sem conta você vê tudo, só não pode levantar a mão." No lugar do formulário: botão-link grande "Entre para dar lances" (ocre, min-height 64, Big Shoulders 900 28px) para `Acesso.dc.html` e texto "Assistir é de graça e sem cadastro. Para disputar, crie uma conta e deposite saldo simulado. Mínimo aceito agora: R$ X,00." Linhas do histórico nunca mostram "VOCÊ" (`eu` false). Quando fechado como visitante, mostra o bloco de encerrado sem "Ver comprovante"; fimFrase "Licitante... Seu saldo travado voltou para a carteira." (inconsistência: texto sobre saldo do usuário aparece também para visitante, e o botão "Dar lance" fantasma é mostrado a visitante e dá erro "fechado").

Estados NÃO presentes no protótipo: carregando/skeleton, erro de rede/conexão perdida, FIPE fora do ar (a ficha mostra "FONTE: TABELA FIPE · OUT/2026" fixa, sem fallback), sem lances (a base sempre tem 14 lances), lote inexistente/cancelado, reconexão do tempo real. Imagem: só o estado "sem foto" (ilustração padrão), não há variante com foto real.

### Formulário de lance (logado e aberto)
- Rótulo mono 12px "SEU LANCE"; campo composto (borda 3px `campoBorda`: `ferrugem` se erro minimo/saldo, senão `linha`): prefixo "R$" (mono 600 18px), `input type="text" inputmode="numeric"` (mono 600 28px, min-height 56px), sufixo fixo ",00". `aria-describedby="regra-lance"`, `aria-invalid`. Máscara: o valor fica como string, atalhos reformatam com separador de milhar ("." a cada 3 dígitos); digitação manual NÃO aplica máscara (só no `onChange` guarda `e.target.value` cru e zera erro); o parse remove não-dígitos (`replace(/\D/g,'')`).
- Texto de regra (`#regra-lance`): "Mínimo aceito {R$ X,00} · incremento R$ 500,00" (Newsreader 15px; valor mínimo em mono `tinta`).
- Valor inicial do campo = mínimo aceito (lance atual + 500) formatado sem R$/",00".
- Atalhos (botões, min-height 44, borda 2px, mono 14px): "+ R$ 500", "+ R$ 1.000", "+ R$ 5.000". Somam ao valor numérico atual do campo (não ao lance atual) e limpam erro.
- Botão "Dar lance": ocre, min-height 64, Big Shoulders 900 30px, sombra 6px.
- Rodapé: "Disponível {R$ X,00}" (peso 600) e "{travadoTxt}" (`tinta2`): "R$ X,00 travados neste lote" ou "Nada travado neste lote".
- Erros `role="alert"` (ícone + texto, borda tracejada `ferrugem`). Ordem de validação em `darLance`: 1) fechado -> 2) usuário já lidera -> 3) valor < mínimo -> 4) valor > disponível -> aceita.
  - fechado: "Martelo batido às {hora}. Este lote não aceita mais lances."
  - ganhando: "Você já está na frente. Cobrir o próprio lance só gasta saldo."
  - minimo: "Seu lance precisa ser de pelo menos R$ X,00." (X = mínimo atual)
  - saldo: "Saldo insuficiente: você tem R$ X,00 disponíveis." + link "Depositar na carteira →"
- Apenas "minimo" e "saldo" pintam a borda do campo de ferrugem; "ganhando" e "fechado" não.
- Sucesso: lance anexado ao histórico com hora atual, valor = valor digitado, erro limpo, campo volta ao mínimo, animação flip e linha nova destacada. Não há toast nem confirmação textual; feedback é a placa virando, a faixa mudando para "Você está ganhando" e a linha no topo.
- Simulação de rival: na cena `superado`, após o primeiro lance do usuário (`rivalFeito` false), 6s depois o licitante `9A6F` cobre com lance = líder + R$ 1.000 (mesmo se o usuário prorrogou), faz o usuário voltar a "Você foi superado". Ocorre uma vez só. (Mock; em produção seria tempo real.)

### Regras de negócio implícitas
- Incremento mínimo R$ 500,00 (fixo no texto e no cálculo `minimo = lider.valor + 500`). Observação: na Vitrine os agendados têm incrementos diferentes (R$ 500,00 e R$ 1.000,00 por lote), mas a Sala hardcoda 500. Inconsistência potencial.
- Lance mínimo aceito = lance atual + 500; aceitar valores acima desse mínimo (qualquer valor, não só múltiplos de 500; não há validação de múltiplo).
- Saldo: TOTAL 100.000; OUTROS_TRAVADO 52.500 (travado em outros lotes); disponível = TOTAL - outros travados - travado aqui (lance atual do usuário só conta se ele lidera e lote aberto). Ou seja, ao ser superado o saldo é liberado imediatamente; ao liderar, só o lance líder fica travado. Comparação do lance: `v > disponivel` (quando o usuário ainda não lidera, disponivel não inclui nada travado aqui).
- Anti-snipe: lance com restante < 120s soma +120s ao fim (condição `restante < 120`, estrito, então exatos 120s não prorrogam); pode prorrogar repetidamente.
- Sem lance do próprio líder: impossível cobrir o próprio lance.
- Encerramento: ao zerar o relógio, vencedor = último lance (líder); saldo travado do perdedor volta (frase); valor do vencedor sai do saldo; comprovante com link público.
- Pseudônimo do usuário "C3E8" (constante EU), exibido a outros como "Licitante C3E8".
- Histórico numerado do mais novo (maior nº) ao mais antigo, 2 dígitos; contador "{NN} LANCES".
- Lance inicial R$ 22.000,00, aberto 18:10 (literais no rodapé do histórico); primeiro lance do BASE é de 22.000 às 18:12:40.
- Horário exibido em hh:mm:ss.

### Textos literais de UI (completo, além dos acima)
Título da página "Sala do lote 018"; "BRASIL"; "LANCE·AUTO"; "Vitrine", "Carteira", "Meus arremates"; "DISPONÍVEL"; "C3E8", "VOCÊ"; "Entrar", "Criar conta"; "LOTE", "018"; "VITRINE / AO VIVO / LOTE 018"; "Gol GTI 2.0 1996"; "Ao vivo"; "Ficha do carro"; "FONTE: TABELA FIPE · OUT/2026"; "NOTA DO LEILOEIRO · AP 2.0 de injeção, pintura original no capô e no teto. Sobre o resto, o dono anterior preferiu não comentar."; "Histórico de lances"; "{NN} LANCES"; "Lance inicial R$ 22.000,00 · aberto 18:10"; "Auditar este lote"; "LANCE ATUAL · R$"; ",00"; "TEMPO RESTANTE" / "ÚLTIMOS 2 MIN" / "ENCERRADO"; "88:88" (fantasma); "+2 MIN"; "SEU LANCE"; "R$"; "Licitante XXXX"; "Você".
Atenção: os rótulos de `dt` da ficha vêm de `ficha` (lista) que NÃO está definida em `renderVals()` retornado (o objeto não tem a chave `ficha`). Ou seja, os 6 itens da ficha (marca, ano, combustível etc.) não são renderizados; só o placeholder do editor (`hint-placeholder-count="6"`). Dados exatos da ficha não existem no protótipo; só se sabe que são 6 pares k/v e a FIPE do Gol GTI aparece na Vitrine (R$ 31.200, 1996, gasolina).

### Acessibilidade observada
- `aria-live="polite"` na faixa de status e na lista do histórico; `role="timer"` no relógio com `aria-label` (mas `aria-live` implícito do timer é "off", e o relógio mudando a cada segundo não é anunciado, o que é adequado); `role="alert"` nos erros; `aria-invalid` + `aria-describedby="regra-lance"` no input; `aria-label` em logo, nav, seções; `aria-hidden` em decorações (placas, SVGs, "88:88", logo "BRASIL"); landmark `nav` ×2 conforme logado/visitante; `aria-labelledby` em ficha e histórico; `label` envolvendo input (mas o texto do label inclui também o hint "Mínimo aceito...", que ficará no nome acessível).
- Alvos de toque: botões 44-64px de altura; chips de saldo sem min-height; link "Auditar este lote" 12px sem área grande; `Entrar`/`Criar conta` 44px.
- `prefers-reduced-motion` desliga todas as animações (isso inclui o flip, mas o relógio não depende de animação).
- Não há atalhos de teclado, nem Enter para submeter lance (o input não está em `<form>`; o botão é `type="button"`). Foco: sem estilo de foco customizado (nem outline removido explicitamente); `outline` herdado do navegador. O input tem `border:none` interno e a borda é do wrapper, então o foco nativo fica dentro da caixa.
- Contraste: texto `tinta2` (#5B5449) sobre `papel` (#F5EEDF) boa; rótulo "TEMPO RESTANTE" #8A8273 sobre painel #141311 aprox. 5,2:1 (ok para texto pequeno de 10px? limítrofe pelo tamanho); `ferrugem` #A43C1E sobre `papel` ok; `sobreCor` #F5EEDF sobre `verde` #2E6A3E ok. Erros combinam cor + ícone + texto.
- O ícone de erro (círculo cortado) é `aria-hidden`.

### Dados/mock
Lote 018 Gol GTI 2.0 1996 (VW). 14 licitantes/lances base com pseudônimos 04DE, 7F3A, B21C, C3E8 (usuário), 9A6F; valores de 22.000 a 30.500 (passos de 500 a 1.000). Constantes `OUTROS_TRAVADO=52500`, `TOTAL=100000`, horário base 18:12:40-18:42:10.

### Responsivo / mobile
Wrapper `SalaMobile` renderiza `Sala` em 390px de largura, tema escuro, estado "ganhando". Sem media queries: o header quebra em linhas, colunas empilham, tipografia fluida com `clamp`. A etiqueta de lote com `padding-left:22px` no cabeçalho e rotação pode vazar levemente; o selo "Ao vivo" com `margin:0 8px 10px 0`. As placas de dígitos (6 placas de 40px + ponto + ",00" ≈ 330px) mais o relógio de 58px (≈ 190px) obrigam a quebra de linha no mobile (flex-wrap).

### Inconsistências / dependências fora do óbvio
- A lista `ficha` não é fornecida (ver acima).
- Na cena `encerrado`, o relógio base é 0 e `fimHora` fixo '19:00:49', mas a hora do último lance 18:58:49 + 120s de prorrogação = 19:00:49 (coerente com anti-snipe).
- Chip do cabeçalho e o rótulo "Nº maior" usam ordinal "º" fixo; para 1º ele só aparece no estado ganhando.
- Plural: "{NN} lances" e "LANCES" sem singular.
- Depende de tempo real (websocket/SSE) para o histórico, relógio autoritativo do servidor, sincronização de relógio, auditoria (`Auditoria.dc.html`), comprovante público (`Comprovante.dc.html`), carteira (`Carteira.dc.html`), FIPE, upload de foto do lote (a imagem é "ilustração padrão" quando não há foto).
- Faixa de status e histórico têm ambos `aria-live="polite"`: anúncio duplicado a cada lance.
- A faixa "Você foi superado" é mostrada no estado superado mesmo com apenas visualização do usuário sem ter dado lance antes? Na cena `superado` o usuário (C3E8) já tinha lances na BASE; não há estado "logado que nunca deu lance" (nesse caso o texto "Seu lance (R$ 0,00) é o 0º maior de N" apareceria: lacuna de design).
- Em `saldo`: o campo mostra "50.000" que excede, mas a mensagem só aparece pois `erro:'saldo'` já vem no estado inicial (a UI não valida em tempo de digitação, só ao clicar "Dar lance").
- O mínimo exibido e o valor pré-preenchido mudam quando chegam novos lances, mas se o usuário editou o campo, o valor digitado permanece (pode ficar abaixo do novo mínimo).

---

## 2. VITRINE (`Vitrine.dc.html`, título "Vitrine de lotes")

### Propósito
Home pública: apresentar o LanceAuto, explicar o funcionamento em 3 passos, buscar/filtrar lotes e listar lotes em 3 seções (ao vivo, agendados, encerrados) com acesso a Sala (vivos/agendados) e Auditoria (encerrados). Sem login (header com Entrar/Criar conta).

### Estrutura/layout (ordem)
1. Barra de status superior (fundo `tinta`, texto `fundo`, borda inferior 3px `linha`, mono 12px uppercase, letter-spacing .1em, flex wrap): ponto `ocre` pulsante + "Pátio aberto" | "3 lotes ao vivo" | "2 agendados" | "Qui 22/out · 18:47". Todos literais (contagens fixas, não calculadas dos dados nem filtradas).
2. Header: logo; `nav aria-label="Conta"`: link "Como funciona" (âncora `#como-funciona`, Big Shoulders 800 19px), botão "Entrar" (papel) e "Criar conta" (ocre), ambos link para `Acesso.dc.html`.
3. Hero (flex wrap, borda inferior 4px, align flex-end): h1 "Quem dá mais, [leva.]" (clamp 68-184px, line-height .8, "leva." sobre fundo `ocre`), subtítulo mono 15px "Quem hesita, assiste."; coluna direita (max 430px): parágrafo 21px "Lotes montados a partir da Tabela FIPE, lances ao vivo com saldo de mentira e um comprovante que qualquer pessoa confere. Até quem não tem conta." e nota mono 12px `tinta2` "Referência FIPE out/2026. Nenhum carro de verdade troca de dono aqui."
4. "Como funciona" (`section#como-funciona`, h2 32px + régua tracejada + "3 passos, nenhum formulário de 12 páginas"): `ol` grid `auto-fit minmax(min(100%,300px),1fr)` gap 24, 3 cartões "canhoto" (borda 3, sombra 6; número 76px `ocre` com `-webkit-text-stroke:3px linha`; título 26px; texto 17px; rodapé tracejado "CANHOTO" / "Nº 0X"):
   - 01 "Deposite saldo": "Dinheiro de mentira, emoção de verdade. Escolha R$ 10, 50 ou 100 mil e pronto."
   - 02 "Dê lances ao vivo": "Cobriu nos 2 minutos finais? O relógio ganha +2 min. Ninguém leva no susto."
   - 03 "Receba o comprovante": "Recibo com link público e o hash do histórico. Para ninguém dizer que foi no grito."
5. Busca (`role="search" aria-label="Buscar lotes"`, cartão papel, borda 3, sombra 6, padding 18, flex wrap): "Buscar" `input type="search"` (placeholder "Opala, Hilux, 1974…"), "Marca" `select` (Todas, Chevrolet, Honda, Toyota, Volkswagen), "Preço" `select` (Qualquer valor, Até R$ 50 mil, R$ 50 a 100 mil, Acima de R$ 100 mil), grupo `role="group" aria-label="Status"` com 4 botões pill `aria-pressed`: "Todos", "Ao vivo", "Agendados", "Encerrados" (selecionado: fundo `tinta`, texto `fundo`; não selecionado: transparente).
6. Estado vazio (se nenhuma seção tem lote após filtros): caixa borda 3px tracejada `tracejado`, "Pátio vazio" (Big Shoulders 900 40px) + "Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar."
7. Seção "Ao vivo" (`aria-labelledby="sec-vivo"`): h2 clamp 46-76px com ponto ferrugem pulsante; contagem mono "NN LOTES"/"NN LOTE"; régua; dica "Lance nos 2 min finais estica o prazo em +2 min". Grid `repeat(auto-fill, minmax(min(100%,330px),1fr))` gap 40/32 (3 colunas em 1440px, 1 coluna no mobile).
8. Seção "Agendados": mesma estrutura; dica "Dá para olhar. Lance, só na abertura."
9. Seção "Encerrados": dica "Todo histórico é auditável. Sem login."
10. Rodapé (borda superior 4px): "Lotes cancelados não aparecem aqui. Nem em sonho." | "Preços de referência: Tabela FIPE · saldo 100% simulado".

### Cartão de lote (todo o cartão é um `<a>`)
- Etiqueta de lote (posicionada acima do cartão `top:0; left:20px`, rotacionada: -4deg vivos, 3deg agendados, -2deg encerrados; fundo `ocre` em vivos/agendados, `papel` em encerrados; número Big Shoulders 900 34px, rótulo "LOTE" mono 10px; furo e barbante SVG decorativos).
- Imagem 200px de altura (fundo `suave` + pontilhado 8px): ilustração SVG por tipo de carroceria (sedan, hatch, fusca, picape) com `role="img" aria-label="Ilustração do {titulo}"`; sempre ilustração, sem foto.
- Título (h3, Big Shoulders 900 32px), linha mono 13px "{ano} · {combustível} · FIPE R$ X".
- Divisória tracejada, rodapé por variante.
- Variantes:
  - **Ao vivo** (link `Sala.dc.html`, todos apontam para a mesma Sala 018): selo "Ao vivo" ferrugem no canto sup. dir. rotacionado -5deg com ponto pulsante; rodapé: "LANCE ATUAL" / valor mono 600 22px / "{n} lances" e caixa-relógio (fundo `painel`, borda 3px `linha`) com rótulo "RESTAM" (#8A8273) e tempo mono 28px em `led`; **urgente** quando < 120s: rótulo "ÚLTIMOS 2 MIN", cor `ledAlerta`, pulsando (`la-pulsa 1s`). O LED fantasma "88:88" opacity .12. Contagem regressiva a cada 1s (`seg - t`, mínimo 0; ao chegar a 0 o cartão fica "00:00" e continua na seção Ao vivo, sem migrar para Encerrados nem prorrogar).
  - **Agendado** (link `Sala.dc.html`): selo superior direito "ABRE {l.abre}" (mono 12px, fundo `papel`, borda 3px). Nota: o campo `abre` não existe nos dados (só `dia`, `hora`), portanto o texto aparece "ABRE " vazio no protótipo. Rodapé: "LANCE INICIAL" / valor / "incremento R$ 500,00"/"R$ 1.000,00" e caixa "ABERTURA" com dia (Big Shoulders 900 26px: "Sáb 24/out", "Dom 25/out") e hora mono ("14:00", "10:00"). Sem relógio, sem botão de lembrete/avise-me.
  - **Encerrado** (link `Auditoria.dc.html`): ilustração com opacity .55 e carimbo central (184px de largura, fundo `papel`, Big Shoulders 900 28px, borda 4px): "Arrematado" (borda sólida, cor `tinta`, rotate -6deg) ou "Sem lances" (borda tracejada, cor `tinta2`, rotate 3deg). Rodapé: "RESULTADO" / "Arrematado · R$ 49.000,00" ou "Fechado sem lances" (mono 600 20px) / observação 15px `tinta2`.

### Dados (mock `LOTES`)
- Vivos: 017 Opala Diplomata 4.1 (Chevrolet 1988 Gasolina, FIPE R$ 48.900, lance R$ 52.500, 23 lances, 107s [já urgente]); 018 Gol GTI 2.0 (Volkswagen 1996 Gasolina, FIPE R$ 31.200, R$ 30.500, 14 lances, 728s); 019 Hilux SRV 2.8 4x4 (Toyota 2018 Diesel, FIPE R$ 189.400, R$ 162.000, 9 lances, 2490s).
- Agendados: 020 Fusca 1300 (Volkswagen 1974 Gasolina, FIPE R$ 24.800, inicial R$ 15.000, inc R$ 500,00, Sáb 24/out 14:00); 021 Corolla XEi 2.0 (Toyota 2015 Flex, FIPE R$ 76.300, inicial R$ 58.000, inc R$ 1.000,00, Dom 25/out 10:00).
- Encerrados: 014 Civic LXS 1.8 (Honda 2012 Flex, FIPE R$ 54.700, R$ 49.000, "Licitante 7F3A levou em 19 lances. Saiu 10% abaixo da FIPE."); 016 Santana CL 1.8 (Volkswagen 1991 Gasolina, FIPE R$ 17.900, valor 12.000, sem lances: "Ninguém quis. O Santana segue sendo um Santana.").
- Observação: lote 018 mostra R$ 30.500 com 14 lances na vitrine mas a Sala (cenas) pode ter outros valores; consistência apenas na cena base. Lote 017 "lance atual" R$ 52.500 está acima da FIPE (48.900); lote 019 162.000 contra FIPE 189.400. Lote 014: 49.000 vs FIPE 54.700 é 10,4% abaixo (texto diz 10%). Observação: Opala e outros vivos linkam todos para a Sala 018 (protótipo).

### Lógica de filtro
- Busca: substring case-insensitive sobre `titulo + marca + ano` (sem normalizar acentos).
- Marca: igualdade exata; Preço baseado em `valor` (lance atual/inicial/final): `ate50` ≤ 50.000; `50a100` > 50.000 e ≤ 100.000; `mais100` > 100.000.
- Status: filtra por seção; seções sem resultado somem (seções vazias não aparecem, sem mensagem individual); só aparece "Pátio vazio" se tudo for vazio. Contagem "NN LOTES" reflete o filtro; a barra superior ("3 lotes ao vivo", "2 agendados") não.
- `onChange` (não `onInput`): em inputs React-like, o filtro de busca é aplicado a cada digitação (dependendo do runtime DC); no protótipo indica `onChange`.
- Não há ordenação, paginação, "carregar mais", botão limpar filtros, contagem de resultados, nem persistência de filtros na URL.

### Estados presentes
Padrão (tudo preenchido), filtrado parcialmente (seções ocultas), vazio ("Pátio vazio"), urgente (<120s) no cartão ao vivo, tema escuro (`VitrineEscuro`), mobile 390px (`VitrineMobile`: uma coluna; a barra de filtros quebra linha). Não há: carregando/skeleton, erro de carga, FIPE fora do ar, vitrine sem nenhum lote cadastrado vs. filtro vazio (mesma mensagem), lote encerrado sem foto vs. com foto.

### Acessibilidade observada
`role="search"`, `label` envolvendo cada campo, `aria-pressed` nos pills, `aria-labelledby` nas seções, `aria-label` nos SVGs ilustrativos (`role="img"`), `aria-hidden` nos decorativos (barbante, pontos, "88:88"), cartões inteiros como link (nome acessível = todo o texto do cartão, longo; sem `aria-label` próprio), âncora "Como funciona" (sem estilo de foco customizado; sem "skip to content"), cor + texto para urgência (`ÚLTIMOS 2 MIN` além da cor), `prefers-reduced-motion`. Relógio dos cartões sem `role="timer"` nem aria-label (diferente da Sala). Pílulas e selects 48px de altura, botões 44px. Links com `text-decoration:none` no cartão e sem indicador de foco além do padrão do navegador. "Como funciona" tem `padding:10px 4px` e não sublinhado; os links "Entrar"/"Criar conta" idem.

### Inconsistências
- "ABRE {l.abre}" sem dado correspondente.
- Barra superior estática com contagens hardcoded e data "Qui 22/out · 18:47" (hoje no sistema 22/out/2026 é quinta-feira, coerente).
- "Escolha R$ 10, 50 ou 100 mil" (passo 01) implica depósitos com 3 valores pré-definidos na Carteira (fora destas telas).
- Pill "Todos" tem `aria-pressed=true` por padrão.
- Todos os links de lote ao vivo e agendado apontam para a mesma página Sala (018).
- Agendado linka para a Sala embora a barra diga "Lance, só na abertura": a Sala deste protótipo não tem estado "agendado/ainda não aberto".
- Encerrados vão para Auditoria (pública, "Sem login"), não para Sala nem Comprovante.
- Rótulo "Ao vivo" duplicado em cartão (selo) e título de seção; barra superior também "Pátio aberto".

---

## 3. ACESSO (`Acesso.dc.html`, título "Criar conta ou entrar")

### Propósito
Tela única de autenticação com duas abas: "Criar conta" (cadastro com escolha de papel licitante/leiloeiro) e "Entrar" (login). Estilo "ficha de inscrição" / "portaria".

### Estrutura/layout
1. Header: logo (30px) + link "← Voltar à vitrine" (mono 14px, `Vitrine.dc.html`, padding 12px 0).
2. Duas colunas flex-wrap (gap 48/64): esquerda texto (flex 1 1 420px), direita formulário (flex 1 1 520px, max 640px). No mobile (390px) empilham: texto primeiro, formulário depois.
   - Esquerda: olho mono 13px uppercase; h1 gigante com quebra de linha forçada (`white-space:pre-line`, `\n`); lead 21px (max 460px); lista de 3 regras A/B/C com divisórias tracejadas (borda superior 3px):
     - A. "Seu nome nunca aparece em público. Lá fora você vira Licitante C3E8." (C3E8 em mono 600)
     - B. "O saldo é simulado. Ninguém cobra, ninguém entrega carro."
     - C. "Não existe recuperação de senha. Anote num papel. De verdade."
   - Direita: `section aria-label` = título do formulário; `role="tablist" aria-label="Acesso"` com abas ("Criar conta", "Entrar") com padding-left 18px, `role="tab" aria-selected`, aba ativa fundo `papel`/texto `tinta`, inativa `suave`/`tinta2`, `top:3px` para sobrepor a borda do cartão; cartão (borda 3, sombra 8): cabeçalho mono 12px com "{tituloForm}" e "FORM. LA-{01|02}" (cadastro = 01, entrar = 02).

### Modo Cadastro
Textos: olho "Ficha de inscrição · 2 minutos"; h1 "Entre\nno pátio."; lead "Uma ficha, um papel e um pseudônimo. O resto você resolve no martelo."; título do formulário "FICHA DE INSCRIÇÃO".
- Fieldset "01 · O QUE VOCÊ VEIO FAZER" (legend mono 12px): dois "bilhetes" radio (grid auto-fit minmax 230px, gap 22) com forma recortada, rotação (-2deg e 1.5deg), barbante SVG, furo; `input type=radio name="papel"` escondido visualmente (opacity 0, 1x1px) dentro de `label`:
  - LICITANTE · "Quero dar lances" · "Deposite saldo simulado e dispute lotes ao vivo." (padrão selecionado)
  - LEILOEIRO · "Quero leiloar" · "Monte lotes a partir da Tabela FIPE e assista à briga."
  - Selecionado: fundo `ocre`/texto `sobreOcre` e `drop-shadow(5px 5px 0 sombra)`; não selecionado: `papel`/`tinta`, sem sombra. Mínimo 132px de altura. Sem estilo de foco visível explícito: o radio é opacity 0 sem alternativa visual de `:focus` (acessibilidade de teclado: navega por setas mas sem indicador de foco).
- Fieldset "02 · QUEM ASSINA": campos NOME (`type=text autocomplete=name`, placeholder "Como está no documento"), E-MAIL (`type=email autocomplete=email`, placeholder "voce@exemplo.com.br"), SENHA (`type=password autocomplete=new-password`, placeholder "Mínimo de 8 caracteres"; nota 15px "Esqueceu, perdeu. Não há botão de recuperação."). Inputs min-height 50, borda 3px `linha`, fonte Newsreader 19px, fundo `fundo`.
- Rodapé do cartão (borda superior tracejada): botão ocre "Criar conta de licitante" / "Criar conta de leiloeiro" (muda conforme papel; Big Shoulders 900 24px, min-height 56, sombra 5px) e nota "Ao criar a conta você recebe um pseudônimo de 4 caracteres. É ele que aparece nos lances."
- Os botões são `type="button"` sem `onClick`: não submetem; sem `<form>`, sem validação, sem mensagens de erro de cadastro (nome vazio, e-mail inválido, senha < 8, e-mail já existente), sem máscara, sem confirmação de senha, sem checagem de força, sem estado de carregando/sucesso e sem destino pós-cadastro definido.

### Modo Entrar
Textos: olho "Portaria · só entra quem tem ficha"; h1 "De volta\nao pátio."; lead "Os lotes continuaram andando enquanto você estava fora. Alguns sem você."; título "IDENTIFICAÇÃO".
- Campos E-MAIL (`autocomplete=email`, placeholder "voce@exemplo.com.br") e SENHA (`autocomplete=current-password`, placeholder "A que você anotou no papel"), ambos com `aria-invalid` e borda `ferrugem` se erro.
- Botão ocre "Entrar no pátio" (`type=button`, sem handler).
- Erro (`erro=true` no protótipo, só enquanto o usuário não trocou de aba): `role="alert"` borda tracejada `ferrugem` com ícone: "E-mail e senha não batem. Confira o que está anotado; recuperar senha não é uma opção aqui." Aparece acima do botão. Observação: o erro some ao clicar numa aba (`!this.state.modo`), mesmo voltando para Entrar.
- Link/botão de texto: "Não lembra a senha? Então é conta nova. [Criar outra]." (botão estilizado como link sublinhado que vai ao cadastro).
- Sem checkbox "lembrar de mim", sem "mostrar senha", sem "esqueci a senha" (intencional), sem login social, sem estado de carregando.

### Comportamento/estado
- `modo` do estado local sobrepõe a prop; abas alternam sem navegar. Papel selecionado persiste entre modos (estado `papel`).
- Variantes do protótipo: `AcessoMobile` (390px, claro, cadastro), `AcessoLoginEscuro` (escuro, entrar, erro ativo).

### Regras de negócio implícitas
- Dois papéis: licitante e leiloeiro (escolhidos no cadastro; sem troca posterior prevista).
- Senha mínima 8 caracteres (placeholder).
- Pseudônimo de 4 caracteres gerado na criação da conta (ex. C3E8, hexadecimal em maiúsculas nos mocks), exibido como "Licitante XXXX"; nome real nunca público.
- Sem recuperação de senha (regra de produto repetida 4x: item C, nota da senha, mensagem de erro, link "Criar outra").
- Saldo simulado, sem entrega.
- "2 minutos" como estimativa de preenchimento.

### Acessibilidade observada
`role="tablist"/"tab"` com `aria-selected` (sem `aria-controls`, sem `role="tabpanel"`, sem navegação por setas), `fieldset/legend`, `label` envolvendo inputs, `autocomplete` correto, `aria-invalid`, `role="alert"` no erro, `aria-label` no logo e na seção. Radios visualmente ocultos sem indicador de foco; inputs com `aria-describedby` ausente (a nota da senha está dentro do label e entra no nome acessível). Placeholder carrega instruções importantes ("Mínimo de 8 caracteres") e some ao digitar. Alvos: abas 48px, inputs 50px, botão 56px. `prefers-reduced-motion` presente (a tela não tem animações). Contraste: placeholders sem estilo definido (padrão do navegador).

### Inconsistências / lacunas
- Aba ativa tem `top:3px` e cartão borda 3px (visual de aba conectada); aba "Entrar" e a "Criar conta" na ordem Criar conta/Entrar (cadastro primeiro, default).
- Dois nomes de ficha: "FICHA DE INSCRIÇÃO" (FORM. LA-01) e "IDENTIFICAÇÃO" (FORM. LA-02).
- O lead do modo Entrar diz "Alguns sem você" (tom humorístico); erros usam o mesmo tom.
- O link "← Voltar à vitrine" e o logo apontam para o mesmo destino.
- Falta qualquer indicação de qual papel o logado tem para exibir "Painel" (outro protótipo, `Painel.dc.html`) vs. "Vitrine/Carteira/Meus arremates" (Sala logada mostra só visão licitante).
- Depende de backend de auth (JWT/sessão), geração de pseudônimo, unicidade de e-mail, e redirecionamento pós-login (não definido).
