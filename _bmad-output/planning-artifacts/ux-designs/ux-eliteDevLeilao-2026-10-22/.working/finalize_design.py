from pathlib import Path
p=Path('_bmad-output/planning-artifacts/DESIGN.md')
s=p.read_text(encoding='utf-8')
s=s.replace('typography:\n', '''typography:
  display:
    fontFamily: Big Shoulders Display
    fontWeight: '900'
    lineHeight: '1'
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.3'
''',1)
s=s.replace("  '12': 12px", "  '8': 8px\n  '14': 14px\n  '20': 20px\n  '26': 26px\n  '30': 30px\n  '12': 12px",1)
s=s.replace('components:\n','''components:
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
''',1)
s=s.replace('O design importado (Claude Design, pasta `design/project/`) é a fonte da verdade visual deste documento. Onde o design não define algo, o texto diz "não definido no design" ou marca `[NOTE FOR UX]`; nada foi inventado.', 'Os protótipos [design/project](design/project/) são a referência visual; o [PRD markdown](<PRD — Plataforma de Leilão de Carros (Teste Técnico).md>) é a fonte funcional. O PDF antigo não se aplica. Este documento e [EXPERIENCE.md](EXPERIENCE.md) prevalecem sobre mocks e importações em caso de conflito. As extensões mínimas abaixo aplicam a autorização do usuário de seguir as recomendações P1–P40 compatíveis com o PRD, preservando a estética registrada.')
s=s.replace('O design **não define** uma escala de espaçamento nomeada, nem colunas e gutters formais, nem breakpoints. O frontmatter lista só os valores literais observados (12, 14, 16, 18, 20, 24, 26/30, 32, 36, 40, 48px) como referência, não como escala. `[NOTE FOR UX]`: a implementação pode precisar de uma escala; ela não deve ser inventada sem decisão explícita.', 'A escala operacional usa os valores observados no frontmatter, sem impor grid de colunas ou breakpoints novos. O reflow intrínseco do protótipo é o padrão também para Painel e Criar lote; 390px e 1440px são referências, não larguras fixas. Validar também 320px e zoom de 200%. Somente tabelas podem rolar horizontalmente dentro de região identificada e focável; formulário, cabeçalho e ações quebram linha sem overflow da página.')
s=s.replace('(ver Pendências)', '(ver extensões abaixo)').replace('Ver Pendências visuais.', 'Ver contraste abaixo.')
s=s.replace('Na CriarLote o botão desabilitado mantém `cursor: pointer` (ver Pendências).', 'Usar `disabled`, sem sombra e cursor padrão; o ponteiro clicável observado em CriarLote não é contrato.')
s=s.replace('**sempre ilustração SVG**, nunca foto', 'foto do snapshot com `object-fit: contain`, sem recortar o carro; ilustração SVG quando não houver foto ou ela falhar')
s=s.replace('Ao lado, o chip de identidade (pseudônimo mais "VOCÊ" em ocre). Altura mínima e padding **não definidos no design**.', 'Ao lado, o chip de identidade mostra somente "VOCÊ · LICITANTE" ou "VOCÊ · LEILOEIRO", sem pseudônimo global. O pseudônimo pertence ao lote. O link do saldo tem alvo mínimo 44px e padding 8px 12px; o marcador VOCÊ usa ocre.')
s=s.replace('Foco, placeholder e desabilitado: **não definidos no design** (ver extensões abaixo).', 'Foco usa `{components.foco}`; placeholder usa `tinta2` e nunca substitui o rótulo; desabilitado usa `suave`/`tinta2` e sem sombra. Erro tem mensagem textual ligada ao campo.')
s=s.replace('Altura de linha, padding e estilo exato do cabeçalho: `[NOTE FOR UX]` não definidos no design.', 'Cabeçalho Plex Mono 11px, peso 500, tracking .12em, cor `tinta2`, padding 12px 8px (20px nas extremidades), borda inferior 3px `linha`; células com padding 14px 8px (20px nas extremidades), altura automática. Ações preservam alvo mínimo 44px. Valores extraídos do Painel.')
s=s.replace('`[NOTE FOR UX]`: o design chama os botões de "pill"; o raio exato não foi extraído e a regra geral do sistema é canto reto.', 'O nome "pill" do protótipo não altera `{rounded.nenhum}`: filtros têm canto reto.')
s=s[:s.index('\n## Pendências visuais')]
extra='''### Extensões visuais aprovadas e cobertura

**Foco e contraste.** `{components.foco}` aplica-se a links, botões, campos e ao cartão do radio quando o input recebe `:focus-visible`. O halo de papel separa o contorno de superfícies escuras. Foco nunca é removido. Rótulos do relógio usam o literal `rotuloRelogio` sobre `painel`; texto BRASIL é parte decorativa da marca e o link mantém nome acessível LanceAuto. Textos de interface exigem contraste 4,5:1 (3:1 para texto grande); elementos de controle/foco, 3:1. Conferir combinações efetivamente renderizadas nos dois temas, sem transformar os dígitos fantasma em informação obrigatória.

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

'''
s=s.replace("## Do's and Don'ts",extra+"## Do's and Don'ts")
p.write_text(s,encoding='utf-8')
