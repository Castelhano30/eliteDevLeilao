---
name: LanceAuto
status: draft
sources:
  - _bmad-output/planning-artifacts/PRD — Plataforma de Leilão de Carros (Teste Técnico).md
  - _bmad-output/planning-artifacts/design/project/ (protótipos "dc" do Claude Design, Rev. 03)
  - _bmad-output/planning-artifacts/ux-designs/ux-eliteDevLeilao-2026-10-22/.memlog.md
updated: 2026-10-22
---

# LanceAuto — Experience Spine

> Casa de leilões online de carros (teste técnico Verzel). Web responsivo, três papéis (visitante, licitante, leiloeiro), tempo real. O PRD é a fonte funcional; o design importado é a fonte visual; as decisões do usuário no memlog vencem os dois. Documento irmão: `DESIGN.md` (tokens e componentes visuais). Em conflito, as duas spines vencem qualquer mock.
>
> Convenções: `{colors.x}`, `{typography.x}` e `{components.x}` apontam para tokens do `DESIGN.md`. No DESIGN.md as cores vivem em `colors.claro.*` e `colors.noite.*`; aqui `{colors.ocre}` significa a mesma chave no tema ativo (`colors.claro.ocre` ou `colors.noite.ocre`). `[NOTE FOR UX]` marca lacuna que este documento não decide. `texto a revisar` marca microcopy escrita aqui por falta de texto no PRD/design. Nomes de pessoas (Mary, Seu João, Carla) são só protagonistas ilustrativos das jornadas, não dados do produto.

## Foundation

- **Plataforma:** web responsivo, desktop de referência 1440px e mobile de referência 390px. Sem aplicativo nativo (fora de escopo no PRD). Next.js + React + TypeScript no front; Node + Express + Socket.IO no back, aplicação separada. `lang="pt-BR"`; todo texto em português do Brasil.
- **UI system:** nenhum. O sistema visual é o "Manual de pátio" do `DESIGN.md` (5 cores com tokens nos dois temas, 3 famílias, borda 3px, sombra dura sem blur). Esta spine especifica só comportamento.
- **Princípio de produto:** o servidor é a única fonte de verdade de tempo, saldo e valores. A tela nunca aceita um lance por conta própria: mostra o resultado depois que o servidor responde ou publica o evento.
- **Dinheiro:** guardado em centavos (inteiros) e datas em UTC; a interface mostra só reais inteiros, no formato `R$ 31.000,00` (o ",00" é fixo, nunca há campo de centavos). Todo valor, lote, relógio, pseudônimo e hash aparece em `{typography.mono}`.
- **Estado do documento:** `draft`. Existem lacunas listadas em "Perguntas abertas".

## Information Architecture

### Nove telas base

O PRD diz "oito telas" mas a tabela dele lista nove linhas; o design desenha nove. Acesso é uma tela só com duas abas (Criar conta / Entrar).

| # | Tela | Quem acessa | Chega por | Para quê |
|---|---|---|---|---|
| 1 | Vitrine (também página inicial) | Todos | Logo, nav, abertura do site | Descobrir lotes ao vivo, agendados e encerrados; ler "Como funciona" |
| 2 | Acesso (Criar conta / Entrar) | Visitante | "Entrar" / "Criar conta" no cabeçalho, CTA "Entre para dar lances" na Sala | Cadastro com escolha de papel; login |
| 3 | Sala do lote | Todos veem; só licitante dá lance | Cartão da Vitrine, "Ir para a sala"/"Cobrir lance" em Meus arremates | Disputa ao vivo; resultado quando encerra |
| 4 | Carteira | Licitante | Nav "Carteira", chip de saldo, recusa por saldo | Ver saldo total/comprometido/disponível, depositar, ler extrato |
| 5 | Meus arremates | Licitante | Nav "Meus arremates" | Acompanhar lotes em que deu lance (ganhando, superado, arrematado, perdido) |
| 6 | Comprovante | Todos (público, por link) | "Ver comprovante", link copiado, "Ver comprovante do lote" na Auditoria | Recibo do arremate, compartilhável, sem dados pessoais |
| 7 | Painel do pátio ("Meus lotes") | Leiloeiro | Nav "Meus lotes" | Lotes próprios por status, total recebido, cancelar |
| 8 | Criar lote | Leiloeiro | Botão "Criar lote", nav "Criar lote" | Montar lote a partir da FIPE e agendar |
| 9 | Auditoria | Todos (pública, sem login) | "Auditar este lote" (Sala), cartões Encerrados da Vitrine, "Verificar na auditoria" / "Auditar lote" (Comprovante), "Conferir na auditoria" (Arremates), "Auditoria do lote" (Painel) | Conferir o histórico de lances e ver o veredito |

### Navegação por papel

| Papel | Cabeçalho | Destinos |
|---|---|---|
| Visitante | `{components.logo-placa}` (→ Vitrine); na Vitrine, "Como funciona" (âncora); botões "Entrar" (`{components.botao-secundario}`) e "Criar conta" (`{components.botao-primario}`), ambos → Acesso | Vitrine, Sala (assistir), Comprovante, Auditoria, Acesso |
| Licitante | `{components.logo-placa}`; nav "Principal": Vitrine · Carteira · Meus arremates; `{components.chip-saldo}` "DISPONÍVEL R$ X" (→ Carteira); chip de identidade "VOCÊ" + papel | Tudo do visitante (menos Acesso) + Carteira, Meus arremates |
| Leiloeiro | `{components.logo-placa}`; nav "Leiloeiro": Meus lotes · Criar lote · Vitrine; chip de identidade "VOCÊ" + papel; sem chip de saldo | Vitrine, Sala (como espectador), Painel, Criar lote, Comprovante, Auditoria |

- Item ativo da nav: sublinhado 3px em `{colors.tinta}` e `aria-current="page"`.
- Chip de identidade: mostra só "VOCÊ" e o papel (Licitante / Leiloeiro). O pseudônimo não aparece no cabeçalho porque muda por lote (ver Voice e Divergências). `[NOTE FOR UX]` a lista de componentes não tem um nome para esse chip; confirmar no `DESIGN.md`.
- Comprovante e Auditoria são públicas e usam cabeçalho mínimo: logo + legenda ("PÁGINA PÚBLICA · NÃO PRECISA DE LOGIN" / "AUDITORIA PÚBLICA · NÃO PRECISA DE LOGIN"), mesmo para quem está logado.
- Cada conta tem um único papel, escolhido no cadastro, sem troca posterior.
- Modais: no máximo um nível. No mobile o cabeçalho quebra em linhas (sem menu hambúrguer desenhado).

### Fechamento de superfícies

O que o PRD exige ou o design aponta e **não está desenhado**. Nenhuma destas superfícies foi inventada aqui; cada uma está em "Perguntas abertas" com o número indicado.

| Necessidade | Origem | Situação |
|---|---|---|
| Sala de lote **agendado** | Vitrine liga cartões agendados à Sala; PRD tem `LOT_NOT_STARTED` | Não desenhada (P1) |
| Sala de lote **cancelado** | PRD tem `LOT_CANCELLED`; cancelado some da Vitrine mas a URL existe | Não desenhada (P2) |
| Sala ao vivo **com zero lances** | Decisão do usuário: lance inicial é o mínimo | Não desenhada (P3) |
| Sala para licitante logado que **nunca deu lance** | Design só tem superado/ganhando | Não desenhada (P4) |
| Sala vista pelo **leiloeiro** | PRD: leiloeiro nunca dá lance (`ROLE_NOT_ALLOWED`) | Não desenhada (P5) |
| Sala entre 00:00 e a liquidação | Rotina de encerramento roda a cada poucos segundos | Não desenhada (P6) |
| **Logout** | Autenticação JWT/sessão | Sem botão em nenhum protótipo (P7) |
| Destino pós-login/pós-cadastro; rota protegida para visitante e para papel errado | Autorização por papel no back-end | Não definido (P8) |
| **Confirmação de cancelamento** de lote | Decisão do usuário | Comportamento definido abaixo; visual não desenhado (P9) |
| Lote **cancelado** no Painel, em Meus arremates e na Auditoria | PRD: cancelamento com lances é registrado no histórico | Não desenhado (P10) |
| Cancelamento como linha do histórico de auditoria | PRD | Não desenhado (P11) |
| Comprovante/Auditoria de **token ou lote inexistente** (404) | Link público | Não desenhado (P12) |
| Validação e erros do **cadastro** (e-mail repetido, senha curta, campos vazios) | Acesso só tem erro de login | Não desenhado (P13) |
| Validação do formulário de **Criar lote** e feedback pós-agendamento | PRD: validações não especificadas | Não desenhado (P14) |
| Erro de **depósito** (valor inválido, acima de R$ 10 milhões) | Decisão do usuário: limite 10 mi, mensagem não definida | Não definido (P15) |
| Estados **carregando / conexão perdida / reconectando** | Socket.IO, recarga por HTTP ao reconectar | Não desenhados (P16) |
| Painel e Criar lote no **mobile** | Design não tem variante celular | Spine-only (P17) |
| Carteira do leiloeiro | PRD: carteira existe, sem tela; só "total recebido" | Fechado: o Painel é a única superfície (total recebido) |

## Voice and Tone

Microcopy. A identidade de marca vive em `DESIGN.md`. A voz é a do "pátio": uma casa de leilões de carros antigos que fala curto, seco e com humor discreto, sem nunca esconder o número.

**Regras**

1. Frases curtas e concretas. Humor seco, uma piada por mensagem no máximo, e nunca no lugar da informação.
2. Todo erro diz o motivo e o valor (R$ exato, horário exato) e aponta a próxima ação quando houver uma.
3. Valores, horários e códigos sempre em `{typography.mono}`; a piada fica no texto de corpo (`{typography.body}`), títulos de cartaz em `{typography.display}` caixa-alta.
4. Sem exclamação, sem emoji, sem jargão de sistema ("erro 500", "operação inválida").
5. Português do Brasil, "você". Concordância correta: "1 lance", "2 lances", "1 lote".
6. O tom é o mesmo para licitante, leiloeiro e visitante.
7. Humor nunca cai sobre dinheiro perdido de verdade: o saldo é simulado e a casa diz isso, mas a recusa e o veredito de adulteração são sérios nos fatos.

| Faça | Não faça |
|---|---|
| "Você foi superado" / "Você está ganhando" | "Atenção! Alguém te passou!" |
| "Seu lance precisa ser de pelo menos R$ 31.000,00." | "Valor inválido." |
| "Saldo insuficiente: você tem R$ 47.500,00 disponíveis." + "Depositar na carteira →" | "Erro: saldo." |
| "Martelo batido às 18:58. Este lote não aceita mais lances." | "Leilão finalizado." |
| "Pátio vazio. Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar." | "Nenhum resultado encontrado." |
| "Dinheiro de mentira, emoção de verdade." | "Simulação de pagamento." |
| "E-mail e senha não batem. Confira o que está anotado; recuperar senha não é uma opção aqui." | "Credenciais inválidas." |
| "A tabela FIPE não respondeu." + "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou." | "Falha na API externa." |
| "Lote com lance cancelado devolve o saldo de quem liderava." (texto a revisar) | "Ação irreversível!" |
| "Licitante 7F3A levou por R$ 54.000,00." | "O usuário João Silva venceu." (nome real nunca aparece em público) |

**Pseudônimos nos exemplos.** Em produção o pseudônimo muda por lote. Todo exemplo deste documento usa pseudônimos diferentes em lotes diferentes para o mesmo licitante. Nas referências do design, onde `C3E8` ou `7F3A` se repetem entre lotes (Sala 018, Arremates, Painel, Auditoria), vale a regra: **no lote 018, a licitante logada é `C3E8`; no lote 017 o vencedor é `7F3A`; no lote 014 o vencedor passa a ser `2D91`; nos demais lotes, valores novos.** O texto "Lá fora você vira Licitante C3E8" do Acesso é reescrito: "Seu nome nunca aparece em público. Em cada lote você vira um Licitante diferente, tipo Licitante C3E8." (texto a revisar). A nota do rodapé do cartão do cadastro deixa de dizer que o pseudônimo nasce com a conta: "Em cada lote você ganha um pseudônimo de 4 caracteres. É ele que aparece nos lances." (texto a revisar).

## Component Patterns

Comportamento. As especificações visuais ficam em `DESIGN.md.Components`.

| Componente | Onde | Regras de comportamento |
|---|---|---|
| `{components.logo-placa}` | Todas as telas | Link para a Vitrine; `aria-label="LanceAuto, vitrine"`. "BRASIL" é decorativo (`aria-hidden`). |
| `{components.etiqueta-lote}` | Sala, cartões, Painel, Auditoria | Número do lote. Cor `{colors.ocre}` se ao vivo ou agendado, `{colors.papel}` se encerrado. Decorativa, nunca é o único meio de saber o status. |
| `{components.selo-ao-vivo}` | Sala e cartões ao vivo | Aparece só com o lote ao vivo; some ao encerrar. Ponto pulsante (parado em reduced-motion). |
| `{components.cronometro}` | Sala, cartões ao vivo, Painel | Mostra o tempo restante calculado com o relógio do servidor (ver Interaction Primitives). Variantes: normal (`{colors.led}`, rótulo "TEMPO RESTANTE" / "RESTAM"), últimos 2 min (`{colors.ledAlerta}`, rótulo "ÚLTIMOS 2 MIN", pulsa), prorrogado (selo "+2 MIN"), encerrado ("00:00", rótulo "ENCERRADO", sem animação). Na Sala tem `role="timer"` com `aria-label` "Tempo restante mm:ss". Nos cartões também precisa de rótulo acessível (defeito do protótipo). Fundo fixo `{colors.painel}`. |
| `{components.placa-lance}` | Sala (lance atual) | Cada dígito é uma placa; ao chegar lance novo a placa vira. O container carrega `aria-label="Lance atual R$ ..."`, as placas são `aria-hidden`. |
| `{components.placar-posicao}` | Sala, faixa do status do licitante | Dois estados: "Você está ganhando · 1º de N" (`{colors.verde}`) e "Você foi superado · Seu lance (R$ X,00) é o Nº maior de N" (`{colors.ferrugem}`). N = licitantes distintos; posição = colocação do maior lance de cada licitante. |
| `{components.faixa-status}` | Sala (assistindo, martelo batido, você arrematou), Vitrine (barra "Pátio aberto"), avisos de conexão | Faixa de situação sem ação. Mapeamento fino com `placar-posicao` `[NOTE FOR UX]` confirmar no `DESIGN.md`. |
| `{components.campo}` | Lance, depósito, Acesso, Criar lote | Rótulo visível sempre; o rótulo não contém texto de ajuda (a ajuda vai em `aria-describedby`). `aria-invalid` quando há erro; borda em `{colors.ferrugem}` nos erros de valor (mínimo e saldo). |
| `{components.botao-primario}` | "Dar lance", "Criar conta", "Entrar no pátio", "Depositar R$ X", "Agendar lote", "Criar lote", "Ver comprovante" | Só existe um botão ocre por tela. Pressionado: desce 3px e a sombra encolhe para 2px. |
| `{components.botao-secundario}` | "Copiar link", "Entrar", "Auditar lote", atalhos de valor, "Cancelar" (variante com texto `{colors.ferrugem}`) | Ação de apoio. |
| `{components.botao-desabilitado}` | "Lote fechado", Agendar lote sem FIPE | Usa `disabled` real. Substitui o botão fantasma "Dar lance" do design no lote encerrado (ver Divergências). |
| `{components.mensagem-recusa}` | Sala, colada ao botão de lance | `role="alert"`, ícone + texto (nunca só cor). Some quando o usuário edita o valor ou usa um atalho. Uma recusa por vez. Detalhes na seção "Mensagens de recusa". |
| `{components.carimbo}` | Sala (Arrematado), cartões Encerrados, Auditoria (Íntegro/Adulterado), Painel | Variantes: Arrematado, Sem lances, Íntegro, Adulterado, Ao vivo. "Bate" ao aparecer (animação desligada em reduced-motion; o carimbo continua visível). O texto do carimbo é o status, não depende da rotação nem da cor. |
| `{components.recibo}` | Comprovante, Sala (histórico de resumo) | Linhas rótulo/valor em `{typography.mono}`; `dl`. Dados verificáveis (lote, valor, pseudônimo, hash). |
| `{components.cartao-lote}` | Vitrine, Painel (encerrados) | Cartão inteiro é um link (Vitrine). Variantes ao vivo, agendado, encerrado. Nome acessível vem do título do lote, não de todo o texto do cartão. Destinos: ao vivo → Sala; agendado → Sala (ver P1); encerrado → Auditoria. Cancelado nunca aparece. |
| `{components.cartao-canhoto}` | "Como funciona" (Vitrine), cartões-ingresso de Meus arremates | Cartão com picote/stub. Em Meus arremates cada cartão traz selo de status, valores e ações. `[NOTE FOR UX]` confirmar se o ingresso de Meus arremates usa este nome. |
| `{components.chip-saldo}` | Cabeçalho do licitante | "DISPONÍVEL R$ X". Link para a Carteira. Atualiza com o evento privado de carteira. Alvo de toque mínimo 44px. |
| `{components.aba-filtro}` | Vitrine (status), Meus arremates (status) | Grupo de botões `aria-pressed`. Ativa: fundo `{colors.tinta}`, texto `{colors.fundo}`. Cada uma com contador (Meus arremates). |
| `{components.tabela}` | Extrato, Painel, Auditoria | `th scope="col"`, `caption` (oculto quando o título já está na tela). Em telas estreitas a tabela rola na horizontal dentro de um contêiner focável e rotulado. |

Comportamentos específicos:

- **Cartão ao vivo (Vitrine):** mostra lance atual, nº de lances e `{components.cronometro}`. Quando o fim é prorrogado, o cartão reflete o novo fim. Ao chegar a 00:00 o cartão migra para Encerrados quando o servidor confirmar (não fica preso em "Ao vivo" como no protótipo).
- **Sem lances no cartão ao vivo:** mostrar o lance inicial (P3).
- **Meus arremates, ações por status:** Ganhando → "Ir para a sala"; Superado → "Cobrir lance" (destaque ocre); Arrematado → "Ver comprovante" + "Copiar link"; Perdido → "Conferir na auditoria". Cada link deve apontar para o próprio lote/comprovante (o protótipo aponta sempre para o lote 018).
- **Painel, ações por lote:** "Cancelar" aparece em **todo** lote ao vivo ou agendado do leiloeiro, com ou sem lances, sempre com confirmação. O texto "Com lances · fica" e a frase "Lote com lance não se cancela. Regra da casa." do design são removidos (decisão do usuário).
- **Confirmação de cancelamento** (um diálogo, um nível): nomeia o lote, informa quantos lances existem e, se houver líder, que o saldo comprometido dele será estornado e que o cancelamento entra no histórico da auditoria. Botões: confirmar (destrutivo, `{colors.ferrugem}`) e voltar. Foco vai para o título do diálogo ao abrir e retorna ao botão "Cancelar" de origem ao fechar; `Esc` fecha sem cancelar. Textos em "Mensagens de sistema novas".
- **Criar lote:** seleção encadeada marca → modelo → ano/combustível; trocar a marca reseta modelo e ano; trocar o modelo reseta o ano. A imagem sugerida (Wikipedia) preenche a URL, editável, com campo de crédito. Marcar "Sem foto" desabilita a URL e usa a ilustração padrão. A prévia acompanha os campos (o protótipo fixa "ABERTURA Dom 25/out 10:00" e o número do lote; ver P14, P18). Lote agendado não pode ser editado (decisão do PRD): depois de agendado só existe "Cancelar".
- **Copiar link:** ver Interaction Primitives.
- **Auditoria, linha da tabela:** hash abreviado `6 primeiros…4 últimos`; "ver inteiro" / "recolher" alterna o hash completo (64 hex, quebra em qualquer ponto) com `aria-expanded` e `aria-controls`.

## State Patterns

Tokens de cada tratamento seguem o `DESIGN.md`. Onde o design não tem o estado, a linha diz **Lacuna** e remete a P-n.

### Sala do lote

| Estado | Tratamento |
|---|---|
| Ganhando | `{components.placar-posicao}` em `{colors.verde}`: "Você está ganhando · 1º de N". O valor do lance fica comprometido (chip de saldo e rodapé do campo: "R$ X,00 travados neste lote"). Dar lance leva a `ALREADY_WINNING`. Linha do topo do histórico com selo "VOCÊ" cheio (`{colors.ocre}`). |
| Superado | `{components.placar-posicao}` em `{colors.ferrugem}`: "Você foi superado · Seu lance (R$ X,00) é o Nº maior de N". Saldo liberado na mesma transação do lance que superou; chip atualiza. Rodapé do campo: "Nada travado neste lote". |
| Últimos 2 minutos | Restante < 2 min e lote ao vivo: `{components.cronometro}` com `{colors.ledAlerta}`, rótulo "ÚLTIMOS 2 MIN", borda `{colors.ferrugem}`, pulso de 1s. A faixa de status não muda por si só. |
| Prorrogado (+2 min) | Chega o evento de prorrogação: novo fim = horário do lance + 2 min. Selo "+2 MIN" no `{components.cronometro}` e parágrafo "Lance nos 2 minutos finais: o relógio ganhou +2 min. Novo fim às hh:mm:ss. Ninguém leva no susto." O aviso fica até o encerramento. Vale para todos os espectadores, não só para quem deu o lance. |
| Recusa por saldo | `{components.mensagem-recusa}` colada ao botão: "Saldo insuficiente: você tem R$ X,00 disponíveis." + link "Depositar na carteira →". Borda do campo em `{colors.ferrugem}`, `aria-invalid="true"`. O valor digitado permanece. |
| Outras recusas | Mesma caixa `{components.mensagem-recusa}`; ver a tabela de recusas. |
| Encerrado, você venceu | `{components.faixa-status}` em `{colors.verde}`: "Você arrematou · Martelo batido às hh:mm:ss · R$ X,00". `{components.cronometro}` "00:00" + "ENCERRADO". `{components.carimbo}` Arrematado bate. Frase: "Você levou o {carro} por R$ X,00. O valor saiu do saldo e o comprovante já tem link público." Botão "Ver comprovante". Formulário some; entra `{components.botao-desabilitado}` "Lote fechado". |
| Encerrado, você não venceu | `{components.faixa-status}` em `{colors.tinta}`: "Martelo batido · Licitante XXXX levou por R$ X,00". Frase com o texto do design ("Seu saldo travado voltou para a carteira") só quando faz sentido para o usuário `[NOTE FOR UX]` P19. Sem "Ver comprovante". |
| Encerrado, visitante | Como acima, sem frase sobre saldo e sem "Ver comprovante". Sem botão "Dar lance". Link "Entre para dar lances" continua oferecido (decisão a confirmar, P20). |
| Encerrado, sem lances | **Lacuna** no design da Sala (a Vitrine já usa o carimbo "Sem lances"). Usar `{components.carimbo}` "Sem lances". Textos P21. |
| Visitante (ao vivo) | `{components.faixa-status}` em `{colors.tinta}`: "Você está assistindo · Sem conta você vê tudo, só não pode levantar a mão." No lugar do formulário: `{components.botao-primario}` grande "Entre para dar lances" + "Assistir é de graça e sem cadastro. Para disputar, crie uma conta e deposite saldo simulado. Mínimo aceito agora: R$ X,00." Histórico nunca mostra "VOCÊ". Nav principal e chips ausentes; entram "Entrar"/"Criar conta". |
| Ao vivo, sem lances | **Lacuna** (P3). Regra decidida: o mínimo aceito é o lance inicial. Histórico vazio e contador "00 LANCES". |
| Agendado | **Lacuna** (P1). Regra do servidor: lance recusado com `LOT_NOT_STARTED`. |
| Cancelado | **Lacuna** (P2). Regra do servidor: lance recusado com `LOT_CANCELLED`. |
| Logado que nunca deu lance | **Lacuna** (P4). O design só tem superado/ganhando; sem tratamento, o texto sairia "Seu lance (R$ 0,00) é o 0º maior de N". |
| Leiloeiro vendo a Sala | **Lacuna** (P5). Formulário não aparece; `ROLE_NOT_ALLOWED` existe como resposta do servidor. |
| 00:00, ainda sem resultado | **Lacuna** (P6). Relógio em 00:00, lances bloqueados, resultado chega no evento de encerramento. |
| Carregando | **Lacuna** (P16). Esqueleto com `{colors.suave}` e `{colors.pontos}`, sem animação em reduced-motion. |
| Conexão perdida / reconectando | **Lacuna** (P16). Aviso por `{components.faixa-status}` (texto a revisar abaixo). Ao reconectar, a tela recarrega o estado do lote por HTTP antes de voltar a ouvir eventos. |
| Ficha do carro e FIPE fora do ar | A Sala lê só o banco (snapshot gravado na criação do lote), então a FIPE fora do ar **não muda nada** na Sala. O mês de referência exibido ("FONTE: TABELA FIPE · MÊS/ANO") vem do snapshot, não é fixo. Sem foto: ilustração padrão com a etiqueta "Pintado à mão pelo pátio: o leiloeiro não mandou foto". |
| Tema claro / noite | Tokens trocam todos juntos; nenhum estado depende de cor sozinha. Ver Perguntas P22 (mecanismo). |

### Vitrine

| Estado | Tratamento |
|---|---|
| Padrão | Barra superior ("Pátio aberto" · N lotes ao vivo · N agendados · data e hora) calculada a partir dos dados, não filtrada pelos controles de busca; hero; "Como funciona" (3 `{components.cartao-canhoto}`); busca; seções Ao vivo, Agendados, Encerrados. |
| Filtrada | Seções sem resultado somem; contagem "NN LOTES" reflete o filtro. Busca por substring sem diferenciar maiúsculas (e, `[NOTE FOR UX]`, acentos; P23). |
| Vazia (filtro) | Caixa tracejada "Pátio vazio — Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar." |
| Vazia (nenhum lote cadastrado) | **Lacuna**: o design usa a mesma mensagem do filtro (P24). |
| Urgente (< 2 min) | Cartão ao vivo com `{components.cronometro}` em `{colors.ledAlerta}`, rótulo "ÚLTIMOS 2 MIN", pulso. |
| Agendado | Selo "ABRE {dia} {hora}" (o campo `abre` não existe nos dados do protótipo: o selo saía vazio). Rodapé com lance inicial, incremento do próprio lote e abertura. |
| Encerrado | `{components.carimbo}` "Arrematado" (com valor e nº de lances) ou "Sem lances". |
| Cancelado | Nunca aparece. Rodapé da Vitrine mantém "Lotes cancelados não aparecem aqui. Nem em sonho." |
| Carregando / erro de carga | **Lacuna** (P16). |
| FIPE fora do ar | Sem efeito: a Vitrine lê só o banco. |
| Foto real em cartão | **Lacuna** (P25): o design só desenha ilustrações. |
| Tema | Claro e noite no desktop e no mobile. |

### Acesso

| Estado | Tratamento |
|---|---|
| Criar conta (padrão) | Papel Licitante pré-selecionado; botão primário "Criar conta de licitante" / "Criar conta de leiloeiro" conforme o papel. |
| Entrar | Campos e-mail e senha; botão "Entrar no pátio". |
| Erro de login | `{components.mensagem-recusa}` com o texto do design acima do botão; bordas dos dois campos em `{colors.ferrugem}`; `aria-invalid`. O erro não some ao trocar de aba e voltar (o protótipo apaga o erro ao clicar na aba). |
| Erros de cadastro; enviando; sucesso | **Lacuna** (P13). |
| Papel ao trocar de aba | O papel escolhido persiste entre as abas. |

### Carteira

| Estado | Tratamento |
|---|---|
| Padrão | Equação Total − Comprometido = Disponível (3 cartões; Disponível com borda 5px). Depositar (valores rápidos 10 / 50 / 100 mil + "Outro valor") e Extrato. |
| Depósito feito | Total e Disponível "viram" (`{components.placa-lance}`-like flip) e entra linha nova no topo do extrato. Anunciar por live region (ver Accessibility Floor). |
| Valor inválido (≤ 0, vazio, não numérico) | Botão mostra só "Depositar" e não age (protótipo). **Lacuna**: sem mensagem (P15). |
| Acima do limite | Limite decidido: R$ 10 milhões por depósito. **Mensagem de erro não definida** (P15). |
| Comprometido | "Travado onde você lidera: {lista de lotes}. Volta se alguém cobrir." Lista os lotes em que lidera, cada um com link para Meus arremates; sem nada travado, texto a definir (P26). |
| Extrato vazio / carregando / erro | **Lacuna** (P26). |
| Atualização em tempo real | Evento privado de carteira atualiza Total, Comprometido e Disponível sem recarregar. |

### Meus arremates

| Estado | Tratamento |
|---|---|
| Padrão | Cartões-ingresso (lote, título, selo de status, frase, dois valores, ações); `{components.aba-filtro}` Todos · Em disputa · Arrematados · Perdidos, com contadores. "Em disputa" = ganhando + superado. |
| Vazio | "Nada aqui. Ou você é muito prudente, ou ainda não chegou a hora." |
| Cópia de link | Ver Interaction Primitives. |
| Lote cancelado em que o usuário deu lance | **Lacuna** (P10). |
| Definição de "perdido" | Lote encerrado em que o usuário deu lance e outro venceu. O PRD não detalha (P27). |

### Comprovante

| Estado | Tratamento |
|---|---|
| Padrão | `{components.recibo}`: lote, carro, ano/combustível, referência FIPE, nº de lances (com prorrogações), martelo, arrematante (pseudônimo **daquele lote**), valor, `{components.carimbo}` Arrematado, hash final HMAC-SHA256, código de barras decorativo. |
| Token inexistente | **Lacuna** (P12). |
| Privacidade | Nunca nome, e-mail, CPF ou telefone. |
| Tema | Claro e noite. |

### Painel do pátio

| Estado | Tratamento |
|---|---|
| Padrão | Resumo (Total recebido + ARREMATES; placares AO VIVO / AGENDADOS / ENCERRADOS em LED `{colors.led}`; AO VIVO em `{colors.ledAlerta}`), tabelas Ao vivo e Agendados, cartões de Encerrados. |
| Lote com lances | Botão "Cancelar" presente, mesmo com lances; confirmação conta os lances e informa o estorno. |
| Lote sem lances | Botão "Cancelar" presente; confirmação mais simples. |
| Encerrado arrematado / sem lances | `{components.carimbo}` + resultado ("Licitante XXXX levou" com pseudônimo daquele lote, ou "Fechado sem lances") + comparação com a FIPE. |
| Cancelado | **Lacuna** (P10). |
| Seções vazias; carregando; erro | **Lacuna** (P16). |
| FIPE fora do ar | Sem efeito no Painel (o aviso aparece só no Criar lote). |

### Criar lote

| Estado | Tratamento |
|---|---|
| FIPE conectada | Indicador "TABELA FIPE CONECTADA" (`{colors.verde}`); três selects ativos; caixa "REFERÊNCIA FIPE · MÊS/ANO" com preço; prévia com silhueta e selo "FOTO SUGERIDA". |
| Sem foto marcado | Selo "ILUSTRAÇÃO PADRÃO"; campo URL desabilitado. |
| FIPE fora do ar | Indicador "FIPE FORA DO AR" (`{colors.ferrugem}`, pulsa); `{components.mensagem-recusa}` `role="alert"` com título "A tabela FIPE não respondeu.", texto "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou." e botão "Tentar de novo". Seletos desabilitados e vazios; prévia "Sem carro escolhido. A FIPE está de folga." / "Carro a definir"; `{components.botao-desabilitado}` "Agendar lote" com nota "Sem marca, modelo e ano não tem lote. O resto já está guardado." Imagem e regras continuam editáveis e preservadas. Texto da FIPE: design vence o PRD, que não define texto (P28). |
| Consultando | Botão "Consultando…" inerte; indicador "CONSULTANDO A FIPE…". Pode falhar de novo; o protótipo sempre acerta. |
| Falha ao sugerir imagem (Wikipedia) | **Lacuna** (P29): o PRD manda usar a ilustração padrão. |
| Erros de campo; enviando; sucesso | **Lacuna** (P14). |

### Auditoria

| Estado | Tratamento |
|---|---|
| Verificando | `{components.carimbo}` e frase somem; "Refazendo a conta, elo por elo…" com ponto pulsante `{colors.ocre}`; colunas de status viram "…". Quem confere é o **servidor** (HMAC); a tela só pede e exibe. Clique repetido durante a verificação é ignorado. |
| Íntegro | `{components.carimbo}` Íntegro (`{colors.verde}`); frase "N de N lances conferem e o hash final é o mesmo do comprovante. Ninguém mexeu em nada depois do martelo."; todas as linhas "CONFERE". |
| Adulterado | `{components.carimbo}` Adulterado (`{colors.ferrugem}`); frase "X de N lances conferem. A corrente quebra na linha NN, e o hash final não bate com o comprovante."; banner `role="alert"` apontando o primeiro registro com problema; linha do problema em `{colors.falha}` com borda esquerda `{colors.ferrugem}` e "NÃO CONFERE"; linhas seguintes "ELO QUEBRADO" sem reduzir opacidade a ponto de perder contraste. A frase só afirma que o hash final não bate quando de fato não bate (inconsistência do protótipo, onde a linha 17 ainda mostra o hash do comprovante). |
| Lote ao vivo | A auditoria abre também para lote em andamento. Sem "hash final esperado pelo comprovante" (não existe ainda); compara com o selo do lote. Atualização em tempo real: P30. |
| Lote encerrado sem lances | **Lacuna** (P31): tabela vazia e veredito. |
| Lote cancelado | **Lacuna** (P10, P11). |
| Lote ou token inexistente; erro de rede | **Lacuna** (P12, P16). |
| Tema | Claro e noite. |

### Estados globais

| Estado | Tratamento |
|---|---|
| Visitante em tela de licitante/leiloeiro | **Lacuna** (P8). |
| Falha de rede em ação do usuário | **Lacuna** (P16); a regra geral é nunca perder o que o usuário digitou. |
| `prefers-reduced-motion` | Animações e pulsos desligados; nenhum estado depende de animação para ser percebido (o carimbo, o selo "+2 MIN" e a placa do lance aparecem direto no estado final). |

## Interaction Primitives

### Lance (Sala)

1. **Campo:** prefixo "R$", sufixo fixo ",00", `inputmode="numeric"`. Valor inicial = mínimo aceito (lance atual + incremento do lote; sem lances, o lance inicial). Texto de regra associado por `aria-describedby`: "Mínimo aceito R$ X,00 · incremento R$ Y,00" (X e Y vêm do lote, nunca fixos em R$ 500).
2. **Máscara:** ao digitar ou colar, só dígitos; separador de milhar "." reaplicado a cada tecla, cursor preservado. O protótipo só mascara ao usar atalhos e guarda o texto cru ao digitar, o que é defeito a corrigir.
3. **Atalhos** `+ R$ 500`, `+ R$ 1.000`, `+ R$ 5.000` (`{components.botao-secundario}`): somam ao valor atual do campo (não ao lance atual) e limpam a recusa. Campo vazio: partir do mínimo aceito `[NOTE FOR UX]` (o protótipo soma sobre zero).
4. **Enviar:** botão "Dar lance" (`{components.botao-primario}`) dentro de um `<form>`; **Enter** no campo envia. Durante a requisição o botão fica inerte, evitando envio duplo. O texto do estado "enviando" é lacuna (P16).
5. **Resultado só vem do servidor.** Sem atualização otimista. Sucesso: a placa vira, o `{components.placar-posicao}` muda para "ganhando", a linha nova aparece no topo do histórico com destaque, o campo volta ao novo mínimo. Não há toast.
6. **Validação, na ordem em que o servidor decide:** (1) período do lote: cancelado → `LOT_CANCELLED`, não iniciado → `LOT_NOT_STARTED`, encerrado → `LOT_ENDED`; (2) valor: primeiro lance ≥ lance inicial, seguintes ≥ lance atual + incremento → `BELOW_MINIMUM`; (3) liderança: líder não cobre o próprio lance → `ALREADY_WINNING`; (4) papel: leiloeiro → `ROLE_NOT_ALLOWED`; (5) saldo disponível → `INSUFFICIENT_BALANCE`. O design usa outra ordem (encerrado, liderança, mínimo, saldo); a do PRD vence, pendente de confirmação na arquitetura (P32). Na prática o leiloeiro nunca vê o formulário.
7. **Lances simultâneos:** o servidor trava o lote; um único lance vence. O perdedor da corrida recebe `BELOW_MINIMUM` com o novo mínimo ("lance chegou antes"). O campo mantém o que o usuário digitou e o texto de regra passa a mostrar o mínimo novo. Se o usuário não tinha editado o campo, ele acompanha o mínimo.
8. **Lance aceito nos últimos 2 min** prorroga: novo fim = horário do lance + 2 minutos, sem teto de prorrogações.

### Tempo real e relógio

- Uma sala Socket.IO por lote. Eventos: novo lance, prorrogação, encerramento. Evento privado de carteira por licitante. Eventos só chegam depois da confirmação da transação.
- O relógio exibido é `fim − (agora + deslocamento)`, onde o deslocamento é calculado a partir do horário do servidor enviado em cada evento e em cada resposta HTTP. O relógio do aparelho nunca decide nada. Ao chegar a 00:00 a tela bloqueia novos lances localmente, mas o resultado só aparece quando o servidor confirma (P6).
- Ao reconectar, a Sala recarrega o estado do lote por HTTP, descarta duplicatas pela sequência do lance e só então volta a aplicar eventos.
- A Vitrine e o Painel usam o mesmo relógio. Se a Vitrine recebe eventos em tempo real ou se atualiza por carga/atualização manual não está definido (P33).

### Link do comprovante

- "Copiar link" copia `{origem}/c/{token}`; o token é aleatório e não adivinhável (não é número do lote mais sufixo). Sucesso: o botão vira "Link copiado" por 2,2 s, anunciado em live region. Falha da área de transferência: o botão mostra a falha e o link fica selecionável (o protótipo diz "Link copiado" mesmo se falhar).
- Falha: texto proposto "Não deu para copiar. Selecione o link e copie à mão." (texto a revisar).

### Outras

- **Máscara de valores** em Carteira e Criar lote segue a mesma regra do lance: só dígitos, milhar com ponto, ",00" fixo.
- **Valores rápidos** (Carteira): grupo de botões `aria-pressed`; digitar em "Outro valor" desmarca o rápido. Limite por depósito: R$ 10 milhões.
- **Filtros da Vitrine:** busca e selects aplicam enquanto o usuário digita/seleciona; nenhum persiste na URL, nenhum botão "limpar" (como no design).
- **Tabelas largas:** rolagem horizontal; o contêiner é focável por teclado.
- **Teclado:** `Tab` na ordem de leitura; `Enter` envia lance; `Esc` fecha o diálogo de cancelamento; abas do Acesso com setas.
- **Banido:** atualização otimista de lance, toast para lance aceito, recuperação de senha, edição de lote agendado, chat, notificações por e-mail, lance automático.

## Mensagens de recusa

Quando o servidor recusa, a resposta traz um código e um texto. A tela mostra `{components.mensagem-recusa}` colada ao botão de lance, com ícone (círculo cortado) e texto em `{colors.ferrugem}`, `role="alert"`. As 4 primeiras mantêm o texto do design (decisão do usuário). Os valores entre chaves vêm do servidor.

| # | Código | Situação | Texto | Onde aparece | Ação |
|---|---|---|---|---|---|
| 1 | `LOT_ENDED` | Lote encerrado | "Martelo batido às {hh:mm}. Este lote não aceita mais lances." | Sala; botão passa a `{components.botao-desabilitado}` "Lote fechado" | Nenhuma; a Sala vira o estado encerrado |
| 2 | `ALREADY_WINNING` | O líder tenta cobrir o próprio lance | "Você já está na frente. Cobrir o próprio lance só gasta saldo." | Sala; campo sem borda de erro | Nenhuma |
| 3 | `BELOW_MINIMUM` | Lance abaixo do mínimo | "Seu lance precisa ser de pelo menos R$ {mínimo},00." | Sala; borda do campo em `{colors.ferrugem}` | Corrigir o valor (atalhos disponíveis) |
| 4 | `INSUFFICIENT_BALANCE` | Valor acima do saldo disponível | "Saldo insuficiente: você tem R$ {disponível},00 disponíveis." + "Depositar na carteira →" | Sala; borda do campo em `{colors.ferrugem}` | Link para a Carteira |
| 5 | `LOT_NOT_STARTED` | Lote agendado ainda não abriu | "O lote abre {dia da semana}, {dd/mm}, às {HH}h. Até lá o martelo fica na gaveta." — **texto a revisar** (base: frase de exemplo do manual de tokens; o PRD dá "Este lote abre em 24/10 às 14:00.") | Sala do lote agendado (P1) | Nenhuma |
| 6 | `LOT_CANCELLED` | Lote cancelado pelo leiloeiro | "O leiloeiro cancelou este lote. Nada foi vendido e todo saldo travado voltou." — **texto a revisar** | Sala do lote cancelado (P2) | Voltar à Vitrine |
| 7 | `ROLE_NOT_ALLOWED` | Leiloeiro tenta dar lance | "Leiloeiro vende, não compra. Lance é coisa de licitante." — **texto a revisar** | Sala vista pelo leiloeiro (P5); o formulário não deveria aparecer, o texto vale também para tentativa por API | Nenhuma |
| 8 | `BELOW_MINIMUM` (lance chegou antes) | Outro lance entrou primeiro e o mínimo subiu | "Alguém levantou a mão antes de você. O mínimo agora é R$ {mínimo novo},00." — **texto a revisar** | Sala; atualiza a regra do campo e o lance atual | Dar o lance de novo no novo mínimo |

Notas: os códigos 3 e 8 são o mesmo código técnico com textos diferentes; a tela escolhe o texto pelo motivo que o servidor informar (`[NOTE FOR UX]` o back-end precisa devolver o motivo, P34). O PRD tem textos de exemplo diferentes para 2, 3 e 4; o texto do design vence. Cada recusa nomeia o motivo e, quando existe, o número exato.

### Mensagens de sistema novas (sem texto no PRD nem no design; todas "texto a revisar")

| Situação | Texto proposto |
|---|---|
| Confirmar cancelamento, lote com lances | "Cancelar o lote {NNN} com {N} lances? O saldo comprometido de quem lidera volta para ele, e o cancelamento fica registrado no histórico da auditoria." |
| Confirmar cancelamento, lote sem lances | "Cancelar o lote {NNN}? Ninguém deu lance ainda." |
| Botões do diálogo | "Cancelar o lote" / "Voltar" |
| Conexão perdida | "Sem sinal com o pátio. Tentando reconectar." |
| Reconectado | "De volta ao pátio. Estado do lote atualizado." |
| Sala ao vivo sem lances | "Nenhum lance ainda. O mínimo é o lance inicial." |
| Sala encerrada sem lances | "Ninguém quis. Lote fechado sem vencedor." |
| 00:00 sem resultado | "Martelo batido. Apurando o resultado…" |
| Auditoria de lote sem lances | "Sem lances, sem corrente para conferir." |
| Token inexistente | "Esse papel não existe, ou já foi para a gaveta." |

## Accessibility Floor

O PRD não especifica acessibilidade nem responsividade; este piso foi pedido pelo usuário. Comportamental; contraste visual vive em `DESIGN.md`. Alvo declarado: WCAG 2.2 AA nos fluxos centrais. Os itens marcados **(defeito)** descrevem o que foi observado nos protótipos e é requisito de correção.

- **Foco visível em todo elemento interativo**, no contraste do tema ativo. **(defeito)** Os protótipos não definem foco; os radios de papel no Acesso (opacidade 0) ficam sem indicador, e o foco nativo do campo de lance fica escondido dentro da caixa. Mostrar foco no "bilhete" selecionado e na caixa do campo inteira.
- **Teclado completo:** toda ação alcançável sem mouse. **(defeito)** Não existe Enter para dar lance (o campo não está num `<form>`). Ordem de tabulação igual à ordem de leitura; ver abaixo para a Sala no mobile.
- **Live regions sem anúncio duplicado.** **(defeito)** Na Sala a faixa de status e a lista do histórico têm `aria-live="polite"` e anunciam duas vezes cada lance. Regra: só `{components.placar-posicao}`/`{components.faixa-status}` anuncia mudanças de situação (ganhando, superado, prorrogado, encerrado); a lista do histórico não é live. O `{components.cronometro}` não anuncia a cada segundo; anuncia uma vez "Últimos 2 minutos" e cada prorrogação. Recusas por `role="alert"`. "Link copiado", depósito feito, estado da FIPE e "Verificando/Íntegro/Adulterado" também têm live region **(defeito)**: nenhum dos três é anunciado hoje (a Auditoria tem `aria-live` só no bloco do veredito).
- **Rótulos únicos em botões repetidos.** **(defeito)** "Copiar link", "Ver comprovante", "Cancelar" e "Conferir na auditoria" se repetem por lote sem identificar qual. Acrescentar o lote ao nome acessível ("Cancelar lote 023, Uno Mille Way 2010"). Cartões-link da Vitrine: nome acessível = título do lote, não o texto inteiro; cronômetro dos cartões com rótulo.
- **Padrão de abas do Acesso:** `role="tablist"` + `tab` com `aria-selected` **e** `aria-controls`, `role="tabpanel"` com `aria-labelledby`, navegação por setas, `Home`/`End`, só a aba ativa na ordem de tabulação. **(defeito)** O protótipo tem só `aria-selected`.
- **Nome acessível do campo de lance** só com o rótulo "Seu lance"; o texto "Mínimo aceito…" vai em `aria-describedby`. **(defeito)** Hoje o hint entra no nome. Mesma correção na nota da senha ("Esqueceu, perdeu…"). Instruções que importam ("Mínimo de 8 caracteres") não ficam só no placeholder.
- **Erros ligados ao campo:** `aria-invalid` + `aria-describedby` apontando para a recusa. No Criar lote **(defeito)** não há `required`, `aria-invalid` nem mensagens por campo.
- **`prefers-reduced-motion`:** desligar pulsos (ponto "Ao vivo", cronômetro urgente, "Pátio aberto"), flips, carimbo "bate" e o selo "+2 MIN"; o estado final aparece sem animação. O protótipo já corta animações em `*`; manter, e garantir que nada fique invisível porque sua animação foi cortada.
- **Alvos de toque ≥ 44px** em tudo que clica. **(defeito)** Chips de saldo, link "Auditar este lote" (12px), "Como funciona" e os links "ver inteiro" ficam abaixo disso.
- **Não depender só de cor:** status sempre em texto + forma (ganhando/superado/íntegro/adulterado/urgente têm palavra e ícone ou carimbo). **(defeito)** Linhas "ELO QUEBRADO" a 62% de opacidade podem perder contraste; o texto continua legível ou a opacidade sobe.
- **Estrutura:** `lang="pt-BR"`; landmarks `header`, `nav` (com `aria-label` diferente por papel), `main`, `section aria-labelledby`; "pular para o conteúdo" em todas as telas **(defeito: não existe)**; `table` com `caption` e `th scope="col"`; `aria-expanded` com `aria-controls` nos hashes.
- **Rolagem horizontal de tabelas** (Extrato 560px, Painel 760px, Auditoria 780px) acessível por teclado: contêiner com `tabindex="0"`, `role="region"` e `aria-label`.
- **Sala no mobile:** o painel de lance vem depois da ficha do carro (ordem do DOM). Decidir se o foco/ordem muda ou se há atalho para o painel (P35).
- **Rotação decorativa** (recibo, carimbos, etiquetas) não pode atrapalhar zoom até 200% nem reflow.
- **Idioma e tom em leitores de tela:** números lidos como moeda ("trinta e um mil reais") por `aria-label` nos containers de valor.

## Key Flows

Nomes são ilustrativos; os lotes e horários usam os dados do design (lote 018, Gol GTI 2.0 1996). Pseudônimos mudam por lote.

### Flow 1 — Mary ganha o Gol GTI na prorrogação (licitante, quinta à noite, 18:57)

1. Mary, analista, está logada. Na Vitrine, o cartão do lote 018 mostra `{components.cronometro}` em LED e "ÚLTIMOS 2 MIN" em `{colors.ledAlerta}` se faltar pouco; ela toca no cartão.
2. Na Sala, `{components.placar-posicao}` diz "Você foi superado". Neste lote ela é **Licitante C3E8** (no lote 017 ela era outro pseudônimo). O chip do cabeçalho mostra só "VOCÊ · Licitante" e "DISPONÍVEL R$ 33.000".
3. O campo vem com o mínimo (R$ 31.000,00). Ela dá o lance às 18:57:02. A placa vira, a faixa fica verde, a linha dela entra no topo do histórico.
4. Licitante 9A6F cobre com R$ 32.000,00 às 18:58:11. A Sala de Mary recebe o evento sem recarregar: "Você foi superado", saldo liberado no chip.
5. O mínimo agora é R$ 32.500,00. Ela clica em "+ R$ 1.000" e o campo vira 33.500. Aperta Enter.
6. Às 18:58:49 o servidor aceita. Como foi nos últimos 2 min, o novo fim é 18:58:49 + 2 min = **19:00:49**. O selo "+2 MIN" aparece no `{components.cronometro}` para todo mundo, e o texto "Novo fim às 19:00:49. Ninguém leva no susto." ocupa a faixa de aviso.
7. **Clímax:** às 19:00:49 o relógio zera em "00:00", o `{components.carimbo}` "Arrematado" bate, a faixa vira "Você arrematou · Martelo batido às 19:00:49 · R$ 33.500,00" e o botão "Ver comprovante" aparece.
8. Ela copia o link do comprovante e o recibo mostra "Arrematante: Licitante C3E8".

Falhas: (a) outro lance chega primeiro, `BELOW_MINIMUM` "Alguém levantou a mão antes de você. O mínimo agora é R$ X,00." com o campo preservado; (b) valor acima do saldo, `INSUFFICIENT_BALANCE` com o link "Depositar na carteira →" que leva à Carteira; (c) conexão cai, a faixa avisa e, ao reconectar, a Sala recarrega o estado pelo HTTP.

### Flow 2 — Seu João cria um lote com a FIPE fora do ar e cancela outro com lances (leiloeiro, manhã de sexta)

1. Seu João entra no Painel do pátio: Total recebido R$ 136.500,00, 3 lotes ao vivo, 2 agendados.
2. Ele clica em "Criar lote". A FIPE não responde: indicador "FIPE FORA DO AR", banner "A tabela FIPE não respondeu.", selects desabilitados, botão de agendar desabilitado.
3. Mesmo assim ele preenche título, lance inicial, incremento, início e fim. Nada se perde.
4. Clica em "Tentar de novo": "CONSULTANDO A FIPE…". A tabela volta. Escolhe Toyota · Corolla XEi 2.0 · 2015; a sugestão de imagem aparece com crédito.
5. Clica em "Agendar lote". O lote aparece em "Agendados" do Painel e da Vitrine, e vai abrir sozinho no horário.
6. Depois ele olha a Hilux (lote 019): 12 lances, líder em R$ 165.000,00. O dono desistiu da venda. Clica em "Cancelar" na linha.
7. O diálogo diz: lote 019, 12 lances, "o saldo comprometido de quem lidera volta para ele" e "o cancelamento fica registrado na auditoria". Ele confirma.
8. **Clímax:** a linha sai de "Ao vivo", o lote some da Vitrine, o líder recebe o estorno e quem estava na Sala vê o lote cancelado. A Auditoria do lote 019 registra o cancelamento no histórico.

Falhas: o lote recebe um lance enquanto o diálogo está aberto (a contagem no diálogo pode estar defasada; o servidor cancela e estorna o líder atual, P36); a FIPE cai de novo no passo 4 (volta ao estado de erro sem apagar nada).

### Flow 3 — Carla audita o lote e encontra um histórico adulterado (visitante, sem conta)

1. Carla recebe de um amigo o link do comprovante de um arremate. Abre sem login: vê lote, carro, valor, o pseudônimo do arrematante naquele lote e o hash final; nenhum nome nem e-mail.
2. Clica em "Auditar lote". A Auditoria abre, pública, com "Verificando…" por um instante: o servidor refaz o HMAC-SHA256 de cada lance, na ordem.
3. Veredito **Íntegro**: todos os lances conferem e o hash final bate com o do comprovante.
4. Em outro dia, num lote cuja linha 09 foi alterada direto no banco (o cenário do teste automatizado do PRD), ela abre a Auditoria pelo cartão de Encerrados da Vitrine.
5. **Clímax:** o `{components.carimbo}` "Adulterado" bate. O banner aponta a linha 09, "o lance gravado não gera o hash guardado para ele". A linha 09 fica em `{colors.falha}` e as seguintes aparecem como "ELO QUEBRADO".
6. Ela expande o hash da linha 09 com "ver inteiro" e clica em "Verificar de novo" para conferir que o servidor repete o veredito.

Falhas: o lote não existe (P12); lote ao vivo (a auditoria funciona, sem comparar com comprovante); a verificação falha por rede (P16).

## Responsive & Platform

Design fluido: sem media queries de largura; `flex-wrap`, `grid auto-fit/auto-fill` com `min()`, tipografia com `clamp`. Referências: desktop 1440px, mobile 390px. Sem breakpoints nomeados `[NOTE FOR UX]` (P37). Largura máxima do conteúdo 1320px (Comprovante 1200px); gutter lateral `clamp(16px, 4vw, 56px)`.

| Largura | Comportamento |
|---|---|
| Desktop (≥ ~1000px) | Sala em duas colunas (ficha do carro à esquerda; painel de lance e histórico à direita); Vitrine com 3 cartões por linha; Acesso em duas colunas; Painel e Auditoria com tabela. |
| Mobile (390px) | Colunas empilham (Sala: imagem e ficha primeiro, depois painel de lance e histórico; Acesso: texto, depois formulário); cartões em 1 coluna; cabeçalho quebra em linhas; `{components.placa-lance}` e `{components.cronometro}` quebram de linha; tabelas rolam na horizontal; filtros da Vitrine quebram. |

- Desenhados em mobile: Vitrine, Acesso (cadastro), Sala (ganhando, noite), Carteira (noite), Meus arremates (noite), Comprovante (claro), Auditoria (adulterado, noite). **Sem mock mobile:** Painel e Criar lote — saem só desta spine (P17). Carteira e Meus arremates só em claro no desktop; Auditoria noite só no mobile.
- Plataforma: navegadores modernos; sem app nativo; Socket.IO exige WebSocket (back em hospedagem com suporte); plano gratuito do back pode hibernar (nota para o README).
- Dados externos: só o back chama FIPE e Wikipedia; o front nunca depende delas, por isso Vitrine, Sala, Auditoria e Comprovante funcionam com a API externa fora.

## Divergências PRD × design resolvidas

| Decisão | Fonte |
|---|---|
| **Pseudônimo muda por lote** (HMAC do usuário com o lote). Chip do cabeçalho mostra só "VOCÊ" + papel; exemplos do design que repetiam C3E8/7F3A entre lotes foram reescritos. Regra A do Acesso e a nota do cadastro mudam. | Decisão do usuário (memlog); PRD vence |
| **Cancelamento de lote com lances e estorno ao líder entra.** "Cancelar" em todo lote ao vivo/agendado do leiloeiro, com confirmação; cancelamento registrado no histórico da auditoria. Somem "Com lances · fica" e "Lote com lance não se cancela. Regra da casa." | Decisão do usuário; PRD vence o design |
| **Auditoria é HMAC-SHA256 conferido pelo servidor.** O rótulo do Comprovante e da Auditoria passa de "SHA-256" para "HMAC-SHA256"; a frase "Você não precisa confiar na gente. Precisa só de uma calculadora de SHA-256 e paciência." sai; os 3 passos do aside "Como a gente confere" são reescritos (texto a revisar): o servidor refaz a conta com uma chave que só ele tem. | Decisão do usuário; PRD vence |
| **Textos de recusa:** mantêm o do design nas 4 existentes (fechado, ganhando, mínimo, saldo); as 4 faltantes escritas no mesmo tom e marcadas "texto a revisar"; códigos do PRD preservados. | Decisão do usuário |
| **Prorrogação = horário do lance + 2 min** (o design soma 120 s ao fim existente). | Decisão do usuário; PRD |
| **Incremento mínimo por lote** (a Sala hardcodava R$ 500). Os atalhos de valor ficam em +500/+1.000/+5.000 para todos os lotes. | Decisão do usuário; PRD |
| **Token do comprovante aleatório** (o design mostrava `NNN-XXXX`). | Decisão do usuário; PRD |
| **Limite por depósito R$ 10 milhões** (a Carteira do design não tinha limite). Mensagem do erro: não definida (P15). | Decisão do usuário; PRD |
| **Sala ao vivo sem lances** usa o lance inicial como mínimo. | Decisão do usuário |
| **Auditoria acessível para qualquer lote** (ao vivo, encerrado, sem lances); o design só tem o lote 018 encerrado. | Decisão do usuário |
| **Dinheiro em centavos no dado, UI em reais inteiros** (",00" fixo). | Decisão do usuário; PRD |
| **Ordem de validação do lance** segue a transação do PRD (período, valor, liderança, papel, saldo), não a do protótipo. | PRD (pendente de confirmação, P32) |
| **Dar lance como botão fantasma no lote fechado** (design) vira `{components.botao-desabilitado}` "Lote fechado" do manual; e a frase do saldo travado não aparece para visitante. | Proposta de UX para corrigir inconsistência do protótipo; a confirmar (P20) |
| **Links "Ver comprovante" / "Auditoria do lote" / "Conferir na auditoria" / cartões ao vivo** apontavam sempre para o lote 018 (protótipo); passam a apontar para o lote ou comprovante certo. | Correção óbvia de protótipo |
| **Mês de referência FIPE** ("OUT/2026" fixo no design) vem do snapshot gravado no lote. | PRD (snapshot) |

## Perguntas abertas

Nada abaixo está decidido. Onde há uma sugestão, ela é só ponto de partida.

1. **P1 — Sala de lote agendado.** A Vitrine liga cartões agendados à Sala, mas não existe tela. A Sala mostra a ficha e a contagem até abrir? Esconde o formulário? Mostra `LOT_NOT_STARTED` só se tentar dar lance?
2. **P2 — Sala de lote cancelado.** O PRD tem `LOT_CANCELLED` mas cancelado some da Vitrine. Quem chega por URL direta vê uma Sala? Uma página de aviso? E quem já estava dentro da Sala no momento do cancelamento (o PRD não lista evento de cancelamento no Socket.IO)?
3. **P3 — Sala ao vivo com zero lances.** O que mostram as `{components.placa-lance}` (lance inicial rotulado "LANCE INICIAL" ou R$ 0)? Como fica a linha do líder? Cartão da Vitrine com zero lances?
4. **P4 — Licitante logado que nunca deu lance.** Qual faixa de status? Texto?
5. **P5 — Leiloeiro dentro da Sala.** O que ocupa o lugar do formulário? Ele pode ver a Sala do próprio lote com ações extras (cancelar)?
6. **P6 — Entre 00:00 e a liquidação.** A rotina de encerramento roda a cada poucos segundos; a Sala fica quanto tempo sem resultado? Texto "apurando" é aceitável?
7. **P7 — Logout.** Onde fica (menu do chip de identidade? nav?). Nenhum protótipo mostra.
8. **P8 — Destino pós-login e pós-cadastro; rotas protegidas.** Para onde vai cada papel? O que vê um visitante que abre Carteira/Arremates/Painel/Criar lote por URL? E um licitante em tela de leiloeiro (e vice-versa)?
9. **P9 — Visual do diálogo de cancelamento.** Comportamento e textos estão neste documento; o desenho não existe.
10. **P10 — Lote cancelado em outras telas.** Aparece no Painel do leiloeiro ("lista dos próprios lotes por status")? Em Meus arremates do líder estornado? Como acessar a Auditoria dele?
11. **P11 — Registro do cancelamento na corrente de auditoria.** Formato do PRD não detalhado. Como aparece na tabela (linha própria, sem pseudônimo, sem valor)? Entra no cálculo do veredito?
12. **P12 — Token ou lote inexistente** em Comprovante e Auditoria (404 amigável).
13. **P13 — Erros do cadastro** (campo vazio, e-mail inválido, senha com menos de 8 caracteres, e-mail já cadastrado), estado "enviando" e sucesso; mensagem de erro de login além da do design.
14. **P14 — Validação do Criar lote** (início antes do fim, início no passado, lance inicial e incremento mínimos, título obrigatório), feedback pós-agendamento e destino. Prévia não acompanha as datas do formulário.
15. **P15 — Mensagem de depósito acima de R$ 10 milhões** e de valor inválido (zero, vazio). O limite está decidido; o texto, não.
16. **P16 — Carregando, erro de rede e reconexão** em todas as telas (esqueleto, texto de erro, "enviando"). Permitir ou bloquear o envio de lance sem socket? (O servidor protege, mas a tela fica defasada.)
17. **P17 — Painel e Criar lote no mobile:** sem mock; construídos só pela spine.
18. **P18 — Número do lote.** O design usa "Novo lote 025" sequencial; o PRD não define numeração pública. E o "Nº do comprovante" do recibo (hoje `018-7Q2K`) coexiste com o token aleatório do link?
19. **P19 — Frase "Seu saldo travado voltou para a carteira"** na Sala encerrada: pelo PRD o saldo já voltou no momento em que o usuário foi superado. A frase fica, muda ou some?
20. **P20 — Visitante na Sala encerrada:** manter "Entre para dar lances"? Remover o botão fantasma "Dar lance"?
21. **P21 — Textos da Sala encerrada sem lances** e se a Sala mostra o carimbo "Sem lances" igual à Vitrine.
22. **P22 — Mecanismo do tema claro/noite.** Não há toggle no design, nem `prefers-color-scheme`; o PRD trata dark mode como "se der tempo". Sistema, chave manual, ambos? Onde persiste? Evitar flash no carregamento.
23. **P23 — Busca da Vitrine:** ignora acentos? Marcas do filtro vêm dos lotes existentes ou de lista fixa? Ordenação e paginação inexistentes.
24. **P24 — Vitrine sem nenhum lote** (não confundir com filtro vazio).
25. **P25 — Foto real nos cartões e na Sala.** O design só tem ilustrações; o PRD guarda a imagem do lote (Wikipedia ou URL do leiloeiro) com crédito. Proporção, corte, onde mostrar o crédito, fallback quando a imagem falha. A prévia do Criar lote mostra silhueta, não a foto.
26. **P26 — Carteira vazia:** extrato sem movimentos, nada comprometido, usuário sem depósito. E o extrato registra "superado" (o design chama de "Estorno", total não muda) ou só os tipos do PRD (depósito, débito de arremate, crédito de venda, estorno)? "Estorno" no extrato é o do cancelamento?
27. **P27 — Definição de "perdido" em Meus arremates** e dos "5 estados" do ciclo de vida do lote (o PRD cita, não enumera).
28. **P28 — Texto de erro da FIPE:** o PRD pede "mensagem clara só no painel do leiloeiro" sem texto; este documento adota o do design.
29. **P29 — Falha ao sugerir imagem (Wikipedia)** no Criar lote: estado e texto; indicador de busca em andamento.
30. **P30 — Auditoria de lote ao vivo:** é um retrato estático com "Verificar de novo" ou atualiza em tempo real?
31. **P31 — Veredito para lote sem lances** e para adulteração que apaga os últimos lances (não há linha para apontar; o PRD fala em contagem e selo do lote). Como a tela mostra "adulterado" nesse caso?
32. **P32 — Ordem de validação** do servidor confirmada na arquitetura (PRD: período, valor, liderança, papel; design: encerrado, liderança, mínimo, saldo). Onde entra `ROLE_NOT_ALLOWED`.
33. **P33 — Vitrine e Painel em tempo real?** Os eventos do PRD são por lote. Cartões da Vitrine atualizam o lance e migram de seção sozinhos, ou só em atualização da página?
34. **P34 — API de recusa:** o back-end precisa diferenciar os dois `BELOW_MINIMUM` (abaixo do mínimo vs. lance chegou antes) para a tela escolher o texto.
35. **P35 — Ordem da Sala no mobile:** o painel de lance fica abaixo da ficha do carro; no 390px o usuário precisa rolar muito para chegar ao botão. Subir o painel? Barra fixa de lance?
36. **P36 — Cancelamento e corrida:** o que o diálogo mostra se entrar um lance entre abrir o diálogo e confirmar?
37. **P37 — Breakpoints nomeados:** o design é fluido e não define pontos de quebra; mantidos assim.
38. **P38 — Fuso horário de exibição:** datas em UTC no dado; a UI mostra horário de Brasília? Segundos sempre?
39. **P39 — Pseudônimo próprio nas telas privadas:** em Meus arremates e no Comprovante, o licitante vê "VOCÊ" ou o pseudônimo daquele lote? O PRD não detalha.
40. **P40 — Mapeamento de componentes:** confirmar no `DESIGN.md` a divisão entre `{components.placar-posicao}` e `{components.faixa-status}`; nome do chip de identidade; uso de `{components.cartao-canhoto}` nos ingressos de Meus arremates; aba de Acesso como `{components.aba-filtro}` ou componente próprio.
