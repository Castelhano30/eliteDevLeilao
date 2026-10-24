# LanceAuto — proposta de compactação e header

Data: 24/10/2026. Estado: proposta aguardando aprovação de Felipe; implementação não autorizada nesta etapa.

## Evidências e limites

O print mencionado não está disponível na conversa. Nenhuma observação abaixo foi atribuída ao print; o diagnóstico vem da leitura do código, sem validação visual no navegador nesta etapa. Conferidos AGENTS.md, SPEC.md, diário de progresso e trechos pertinentes da S03 (última fatia implementada). PRD, EXPERIENCE, DESIGN e arquitetura não foram abertos.

O header atual (`site-header.tsx`) usa grupos flex com quebra livre, gaps de 24 px, padding vertical de 16 px e borda inferior de 4 px. Para o licitante, reúne navegação, saldo, chip do papel, Sair e seletor de tema. Não mostra o nome do usuário nem oferece menu de perfil. A fragmentação e as dimensões sugerem competição por espaço; eventuais sobreposições não foram constatadas no navegador.

`globals.css` define hero de 68–184 px, títulos de página de 60–132 px e títulos de seção de 46–76 px. `PageShell` usa 48 px de padding vertical. Botões têm mínimo de 52 px; campos comuns, 50 px mais bordas. Cards usam padding de 20 px, título de 32 px e imagem de 200 px de altura. Bordas de 3 px e sombras deslocadas de 4–8 px se repetem. Vitrine ainda soma hero, Como funciona e filtros antes dos lotes. Há medidas locais em componentes que não respondem somente à troca dos tokens.

Já existem paleta claro/noite, foco global visível, alvo mínimo de 44 px, fontes display/serif/mono, SVGs locais e respeito a movimento reduzido. Não há dependência de ícones ou componente de dropdown na lista de componentes inspecionada.

## Organização proposta

Desktop, quando houver espaço: `Logo | navegação por papel | espaço flexível | tema | saldo + olho | perfil`.

- Logo-placa preservado, menor. Header alinhado ao mesmo contêiner do conteúdo (máximo 1320 px), com padding vertical de 10–12 px e separador de 1–2 px. Navegação mantém links e indicação da página atual.
- Visitante mantém Entrar e Criar conta; não recebe saldo ou perfil. Leiloeiro mantém os próprios links e perfil, sem ganhar carteira no header. Kit continua restrito ao ambiente não produtivo.
- Tema: toggle discreto com sol e lua em SVG local, ícones de 18–20 px e alvo de pelo menos 44 px. Nome acessível estável “Tema escuro”, estado `aria-checked`, operação com Espaço/Enter. Reusar `applyThemeChoice`, chave `lanceauto-tema`, atributos e script inicial existentes. Sem escolha manual, refletir o tema efetivo do sistema; a primeira interação grava claro/noite. A opção explícita Sistema deixa de ocupar espaço no header, conforme a troca solicitada por um controle binário; o comportamento automático inicial continua.
- Perfil: um botão com avatar de iniciais (fallback neutro se faltar nome), indicador discreto de abertura e nome acessível “Abrir menu do perfil”. Nome completo e papel ficam no dropdown de aproximadamente 240 px, limitado à largura da janela, alinhado à direita. Cabeçalho informativo seguido de Sair, que chama o `logout` existente. Sem foto nova, upload ou nova rota.
- Dropdown: botão com `aria-expanded` e `aria-controls`; Enter/Espaço abre, foco vai a Sair; Escape fecha e devolve foco ao botão. Tab segue a ordem natural e fecha ao sair do conjunto, sem aprisionar foco. Clique fora fecha; ao clicar em outro controle focável, respeitar o destino do clique, sem roubar seu foco. Fechamento explícito devolve foco ao botão; logout segue a navegação existente. Superfície suave no hover, foco global preservado e fundo distinto no estado aberto. Preferir painel não modal com botão nativo, evitando semântica de menu de aplicação desnecessária.
- Saldo: “Disponível” discreto acima do valor, link preservado para `/carteira` e botão de olho irmão do link, nunca aninhado nele. Reusar `useWalletSummary`, `WALLET_SUMMARY_KEY`, `availableCents` e `formatBRL`. Reservar largura estável para valor/máscara, com números tabulares; testar valores extensos sem corte de informação.
- Olho: rótulo “Ocultar saldo” ou “Mostrar saldo”; oculto mostra exatamente `••••••`. Não renderizar o valor oculto em nome acessível, tooltip, atributo de dados ou elemento visualmente escondido. Nome acessível do link oculto: “Saldo oculto, ir para a carteira”. Persistir somente a preferência em localStorage, compartilhada pelo navegador e mantida após logout, até escolha explícita de mostrar. Ler antes de exibir o valor, evitando exposição transitória na hidratação; sincronizar entre abas. Se armazenamento estiver indisponível, manter a escolha em memória durante a sessão. Escopo da ocultação: saldo do header; valores necessários nas telas de carteira e lance seguem seu funcionamento atual.

## Escala sugerida para aprovação

Redução coordenada das dimensões maiores, sem zoom, scale global ou redução indiscriminada de todos os textos.

| Elemento | Atual confirmado | Proposta |
|---|---|---|
| Corpo | 17 px | 16 px |
| Texto introdutório | 21 px | 18 px |
| Hero | 68–184 px | 48–112 px, fluido |
| Título de página | 60–132 px | 40–80 px, fluido |
| Título de seção | 46–76 px | 30–48 px, fluido |
| Título do card | 32 px | 26 px |
| Botões | 20–22 px; mínimo 52 px | 18–20 px; mínimo 44 px, principal 48 px |
| Campo comum | 19 px; mínimo interno 50 px | 16 px; altura total próxima de 48 px |
| Campo monetário | 28 px; mínimo interno 56 px | 24 px; altura total próxima de 52 px |
| Rótulos e dados mono | 10–14 px | Não reduzir; rótulos funcionais de ao menos 12 px |
| Padding vertical de página | 48 px | 24–32 px |
| Padding de card | 20 px | 16 px |
| Intervalos grandes entre blocos | 40–56 px | 24–32 px |
| Foto de card | 200 px de altura | 168–180 px, com proporção reservada |
| Bordas e sombras | Bordas 3–4 px; sombras 4–8 px | Bordas usuais 1–2 px; sombras 2–4 px |

Preservar o desenho da placa, ocre nas ações principais, tipografia expressiva e monoespaçada nos dados. Suavizar molduras secundárias, mantendo status, recusas e foco inequívocos. Preservar 44 × 44 px de área interativa nos controles pequenos. Ajustar também tamanhos locais da Sala, filtros, Painel e cards para evitar duas escalas concorrentes. Não substituir utilitários globalmente por busca/replace. Medidas propostas que diferem das fatias são decisões visuais pendentes desta aprovação, sem mudança de contratos ou regras.

## Responsividade

- Desktop amplo (referência: a partir de 1200 px): uma linha no header; navegação à esquerda do grupo de ações. Altura natural, sem altura fixa que corte conteúdo.
- Tablet (referência: 768–1199 px): logo e controles na primeira linha; navegação em segunda linha própria, com quebra de itens quando necessária.
- Mobile (referência: abaixo de 768 px): primeira linha com logo e toggle; segunda com saldo e perfil alinhados à direita; terceira com navegação. Visitante usa a segunda linha para Entrar/Criar conta; leiloeiro pode manter perfil junto ao toggle se couber. Priorizar encaixe real em 320 px, sem comprimir áreas clicáveis.
- Usar os mesmos nós de controles em layout responsivo, sem duplicar instâncias ou alterar a ordem de foco em relação à leitura visual. Dropdown limitado à janela, nomes longos quebram dentro dele. Sem rolagem horizontal no header.
- Cards: uma coluna em celular, duas onde couberem e três em desktop; gaps de 16–24 px. Filtros empilham em telas estreitas. Sala mantém ficha antes do painel e histórico; reduzir espaços sem criar barra fixa ou atalho novo. Tabelas mantêm sua rolagem local quando necessária.
- Conferir reflow com zoom do navegador a 200%, conteúdo longo e fontes ampliadas. Os pontos de quebra são referências, ajustáveis pela largura real dos controles.

## Encaminhamento para desenvolvimento após aprovação

Reusar `SiteHeader`, `Logo`, `ThemeSwitch`, `BalanceChip`, `useAuth`/`logout`, `Button`/`buttonClasses`, `Field`, `PageShell`, `FilterTabs`, `LotCard` e `CarPhoto`. Ajustar tokens em `globals.css` e `tailwind.config.mjs`, além das medidas locais correspondentes nas telas existentes. `PublicHeader` recebe apenas consistência de escala; sua composição mínima permanece. `IdentityChip` sai do header, mas continua disponível para outros usos. Criar somente um pequeno componente de perfil e os SVGs locais necessários. O `Dialog` existente é modal e não deve ser adaptado à força para esse dropdown.

Ordem de commits sugerida: (1) tokens e escala compartilhada; (2) escala local das telas/cards; (3) toggle de tema; (4) dropdown de perfil; (5) privacidade do saldo; (6) organização responsiva final do header. Cada mudança inclui sua validação e registro no diário, com mensagem curta em português e push ao fim da etapa. Não incluir alterações alheias. Sem dependências novas ou mudança em API, contratos, rotas, cache e autorização.

Validação obrigatória: claro/noite; 320, 390, 768, 1024 e 1440 px; visitante, licitante e leiloeiro; carregamento e erro de sessão; Tab/Shift+Tab, Enter, Espaço, Escape e clique fora; foco após fechamento; nomes extensos; saldo zero/extenso/carregando; recarga e outra aba para preferências; tema inicial do sistema; valor oculto ausente da árvore acessível, inclusive durante recarga; atualização do saldo após depósito/lance; logout e links existentes. Conferir contraste, foco e mensagens de erro, além dos fluxos de busca, filtro, acesso, criação de lote, depósito e lance. Executar lint, typecheck, testes pertinentes e build; depois deploy e smoke público dentro do escopo, sem criar operações de negócio desnecessárias. Registrar evidências reais e pendências, sem declarar validação apenas pela leitura de código.

## Pendência para aprovação

Felipe aprova esta direção visual e as interações descritas antes de qualquer alteração no código. A comparação com o print continua pendente de recebimento da imagem.
