# Diário de progresso — Casa de Leilões (Verzel)

Registro passo a passo do que foi feito, decidido e do que vem a seguir. Serve também de base para o relato de uso de IA exigido na entrega.

## Convenções de trabalho

- **Commits atômicos:** uma mudança lógica por commit.
- **Mensagens:** em português, claras, enxutas, objetivas e com tom humano.
- **Repositório:** monorepo (front e back juntos).
- **Stack:** React com Next.js, Node.js com Express, Socket.IO, PostgreSQL com Prisma.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Prorrogação | Novo fim = horário do lance + 2 minutos |
| Posição do usuário | Colocação do maior lance de cada licitante |
| Cancelamento com lances | Fazer, com estorno automático |
| Edição de lote agendado | Não fazer |
| Limite por depósito | R$ 10 milhões |
| Imagem dos lotes | Wikipedia, editável, com ilustração padrão |

## Passo a passo

### 22/10/2026

1. **Ponto de partida.** Rodado o `bmad-help` para mapear o fluxo: PRD, UX, arquitetura, épicos, sprint e build.
2. **Design importado.** Baixados 29 arquivos do Claude Design para `planning-artifacts/design/project/` (9 telas, com variações claro, noite e celular).
3. **PRD reconciliado.** Havia duas versões: o PDF antigo (marketplace) e o `.md` novo (Casa de Leilões, teste Verzel). O `.md` é a fonte única e bate com o design.
4. **Stack definida.** Next.js no front e Express no back, registrada no PRD.
5. **Decisões em aberto fechadas** e monorepo adotado (tabela acima).
6. **Git e GitHub.** Repositório iniciado na `main` e publicado (privado, por enquanto) em `Castelhano30/eliteDevLeilao`. Só o `_bmad-output` vai para o git. Envio com `git push` ao fim de cada etapa, e commits sempre só no nome do autor.

7. **UX gerado.** `DESIGN.md` e `EXPERIENCE.md` escritos a partir do design e do PRD, com as 40 perguntas abertas (P1 a P40) triadas por recomendação. Divergências entre design e PRD resolvidas a favor do PRD (pseudônimo por lote, cancelamento com estorno, auditoria HMAC-SHA256). Aceitos como `draft` para ganhar agilidade, sem o Reviewer Gate.

## Próximos passos

- [x] `bmad-ux`: gerar `DESIGN.md` e `EXPERIENCE.md` a partir do design (aceitos como draft)
- [ ] `bmad-architecture`: fixar as decisões técnicas
- [ ] `bmad-create-epics-and-stories`
- [ ] `bmad-sprint-planning`
- [ ] `bmad-build`: implementar por história (deploy mínimo já no dia 1)

## Registro de uso de IA

- PRD e pesquisa de APIs: Claude, com revisão e ajustes de Felipe
- Design: Claude Design
- Planejamento e implementação: BMad com Claude Code
