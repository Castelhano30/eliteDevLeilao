---
title: 'Tipografia Manrope na interface'
type: 'refactor'
created: '2026-10-26'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="intenção do usuário">

## Intent

**Problema:** A interface usa Big Shoulders, Newsreader e IBM Plex Mono, inclusive peso 900, em papéis tipográficos diferentes.

**Abordagem:** Usar Manrope com pesos reais 400, 500, 600, 700 e 800 em toda a interface. Títulos principais e preços usam 700–800, títulos de veículos e cards 700, botões e navegação 600, textos 400–500 e informações secundárias 500. Preservar cores, tamanhos gerais, espaçamentos, alinhamentos, estrutura e comportamento. Ajustar entrelinha e espaçamento de letras apenas onde a fonte exigir.

</frozen-after-approval>

## Implementation Notes

- Fonte central no layout e no tema Tailwind; classes de papel existentes seguem como pontos de ajuste tipográfico.
- Removidas as referências a Big Shoulders, Newsreader, IBM Plex Mono e peso 900 nos componentes. Manrope carrega somente 400, 500, 600, 700 e 800.
- Mantidos os tamanhos da interface; o logo grande recebeu escala fluida apenas para caber a 390 px. Títulos longos e valores monetários permitem quebra no contêiner.
- Revisão detectou conflito da cascata entre classes de papel e utilitários de peso. Navegação, título de veículo no painel, preço da Sala e histórico de lances foram ajustados com pesos computados corretos.
- `npm run lint`, `npm run typecheck`, `npm run build` e `npm test` verdes. Chrome local: `/kit`, `/entrar` e `/` em 1440, 768 e 390 px, claro e noite, sem rolagem lateral. Navegação 600, título longo 700 e preço longo 800 confirmados. Salas, Painel e comprovantes reais exigem sessão e dados da API e não foram abertos nesta checagem visual.
