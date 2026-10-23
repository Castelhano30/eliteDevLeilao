---
id: SPEC-lanceauto-rastreabilidade
---

# Rastreabilidade: PRD → fatia

Gerada dos frontmatters das fatias (`cobre` = fatia que TERMINA o requisito; `também toca` = fatias que o começam, ajustam ou verificam). Nenhum ID sem fatia. Os IDs vêm do PRD: R1–R15 = regras de negócio; E = escopo obrigatório; O = opcionais; T = telas; M = mensagens de recusa; X = API externa; H/A/L = cadeia, adulterações e limitações; P = privacidade; S = seed; D = README e entrega; AC = critérios de aceite; demais = pontos técnicos, modelo de dados e piso de UX.

| ID | Requisito | Fatia que termina | Também toca |
|---|---|---|---|
| R1 | Só aceita lance em lote ao vivo (início ≤ agora < fim) | S03 | — |
| R2 | Mínimos: 1º ≥ lance inicial; seguintes ≥ atual + incremento | S03 | — |
| R3 | Líder não cobre o próprio lance | S03 | — |
| R4 | Só licitante dá lance; leiloeiro nunca | S03 | — |
| R5 | Lance só se couber no saldo disponível | S03 | — |
| R6 | Lances irrevogáveis, histórico só recebe inserções | S03 | — |
| R7 | Disponível = total − comprometido | S01 | S03 |
| R8 | Lance líder compromete; superado libera na mesma transação | S03 | S01 |
| R9 | Depósito simulado soma ao total | S01 | — |
| R10 | Prorrogação: lance nos últimos 2 min ⇒ fim = lance + 2 min | S04 | S03 |
| R11 | Fim do lote com lances: debita vencedor, credita leiloeiro, gera comprovante | S05 | — |
| R12 | Lote sem lances fecha sem vencedor | S05 | — |
| R13 | Liquidação uma única vez, mesmo se a rotina rodar de novo | S05 | — |
| R14 | Cancelar lote sem lances; cancelado some da vitrine | S06 | — |
| R15 | Cancelar lote com lances: estorna o líder e registra no histórico | S06 | — |
| E1 | Cadastro e login com dois papéis | S01 | — |
| E2 | Busca na API pública e criação de lote | S02 | — |
| E3 | Vitrine ao vivo/agendados/encerrados | S02 | — |
| E4 | Sala do lote ao vivo | S04 | S02, S03 |
| E5 | Carteira com depósito e saldo comprometido | S01 | S03, S07 |
| E6 | Lances, prorrogação e recusas | S03 | — |
| E7 | Encerramento, liquidação e comprovante compartilhável | S05 | — |
| E8 | Meus arremates | S07 | — |
| E9 | Painel do leiloeiro (cancelar, resultados, total recebido) | S06 | S02, S05 |
| E10 | Auditoria pública e histórico à prova de adulteração | S08 | — |
| E11 | Privacidade na auditoria e no comprovante | S08 | S05 |
| E12 | Resiliência à queda da API externa | S02 | S09 |
| E13 | Seed, deploy público e README | S09 | S00, S01 |
| O1 | Busca e filtro de lotes | S02 | — |
| O2 | Cancelamento com estorno automático | S06 | — |
| O3 | Docker Compose | S00 | S09 |
| O4 | Testes automatizados | S09 | S00, S01 |
| O5 | Dark mode | S00 | S09 |
| PERM-V | Permissões do visitante | S01 | — |
| PERM-B | Permissões do licitante | S01 | — |
| PERM-A | Permissões do leiloeiro | S01 | S06 |
| T1 | Tela Vitrine | S02 | S01, S04, S05 |
| T2 | Tela Acesso | S01 | — |
| T3 | Tela Sala | S06 | S02, S03, S04, S05 |
| T4 | Tela Carteira | S01 | S04, S06, S07 |
| T5 | Tela Meus arremates | S07 | — |
| T6 | Tela Comprovante | S05 | — |
| T7 | Tela Painel | S06 | S02, S04, S05 |
| T8 | Tela Criar lote | S02 | — |
| T9 | Tela Auditoria | S08 | S06 |
| M1 | Recusa BELOW_MINIMUM (abaixo do mínimo) | S03 | — |
| M2 | Recusa INSUFFICIENT_BALANCE | S03 | — |
| M3 | Recusa ALREADY_WINNING | S03 | — |
| M4 | Recusa LOT_NOT_STARTED | S03 | — |
| M5 | Recusa LOT_ENDED | S03 | — |
| M6 | Recusa LOT_CANCELLED | S03 | S06 |
| M7 | Recusa ROLE_NOT_ALLOWED | S03 | — |
| M8 | Recusa BELOW_MINIMUM (outro lance chegou antes) | S03 | — |
| X1 | Só o back chama APIs externas | S02 | — |
| X2 | Telas públicas leem só o banco | S02 | — |
| X3 | Cópia da imagem + ilustração padrão | S02 | — |
| X4 | Cache ≥ 24 h | S02 | — |
| X5 | Timeout curto, poucas tentativas, mensagem só no painel | S02 | — |
| X6 | URL base e token em env | S02 | — |
| X7 | Fluxo de criação do lote em 4 passos | S02 | — |
| H1 | Campos de cada lance na cadeia | S03 | — |
| H2 | HMAC-SHA256 por lance e genesis | S03 | — |
| H3 | Lote guarda contagem, último hash e selo | S03 | — |
| H4 | Chave só em env do servidor | S00 | — |
| H5 | Auditoria recalcula e compara (selo e comprovante) | S08 | S03 |
| A1 | Detecta alteração de lance | S08 | — |
| A2 | Detecta remoção do meio | S08 | — |
| A3 | Detecta inserção | S08 | — |
| A4 | Detecta remoção dos últimos | S08 | — |
| A5 | Recalcular cadeia sem chave é impossível | S08 | — |
| L1 | Limitações da auditoria citadas no README | S08 | S09 |
| P1 | Pseudônimo, nunca nome/e-mail | S08 | — |
| P2 | Pseudônimo = HMAC usuário+lote (muda por lote) | S03 | — |
| P3 | Logado vê 'você' nos próprios lances | S03 | S07 |
| P4 | Comprovante por token aleatório sem dados pessoais | S05 | — |
| S1 | Seed: 1 leiloeiro e 2 licitantes com saldo | S01 | S09 |
| S2 | Seed: lote ao vivo com lances | S03 | S02, S09 |
| S3 | Seed: lote agendado | S02 | S09 |
| S4 | Seed: encerrado arrematado com comprovante | S05 | S09 |
| S5 | Seed: encerrado sem lances | S05 | S09 |
| S6 | Seed: lote cancelado | S06 | S09 |
| S7 | Seed: datas relativas, ao vivo 30 dias, comando que recria | S09 | S02 |
| S8 | Seed: itens de arquivo local sem FIPE | S02 | S09 |
| S9 | Seed: lances pelos services (cadeia válida) | S09 | S05 |
| D1 | README: visão geral, deploy, usuários de teste | S09 | — |
| D2 | README: stack e decisões | S09 | — |
| D3 | README: pré-requisitos, env, .env.example | S09 | S00 |
| D4 | README: banco, migrações, seed | S09 | — |
| D5 | README: rodar back/front e Docker Compose | S09 | S00 |
| D6 | README: rodar testes | S09 | S00 |
| D7 | README: técnica anti-adulteração | S09 | S08 |
| D8 | README: comportamentos inesperados e limitações | S09 | — |
| D9 | Formulário de entrega | S09 | — |
| D10 | Registro de uso de IA | S09 | — |
| AC1 | Lance fora do período recusado com o motivo certo | S03 | S09 |
| AC2 | 1º lance abaixo do inicial e seguintes abaixo de atual+incremento recusados | S03 | S09 |
| AC3 | Líder não cobre o próprio lance | S03 | S09 |
| AC4 | Lance acima do saldo recusado; superado tem saldo liberado na hora | S03 | S09 |
| AC5 | Dois lances simultâneos ⇒ um líder e saldos consistentes | S03 | S09 |
| AC6 | Lance nos últimos 2 min estende o fim e todos veem | S04 | S03, S09 |
| AC7 | Lance aparece em outro navegador sem recarregar | S04 | S03, S09 |
| AC8 | Encerramento debita, credita e gera comprovante uma vez | S05 | S09 |
| AC9 | Lote sem lances fecha sem vencedor | S05 | S09 |
| AC10 | Cancelado não aparece na vitrine; lote com lances estorna | S06 | S09 |
| AC11 | Alterar/remover/inserir lance direto no banco ⇒ auditoria acusa | S08 | S09 |
| AC12 | Auditoria e comprovante sem nome nem e-mail | S08 | S05, S09 |
| AC13 | API externa fora: vitrine, salas, auditoria e comprovante funcionam | S09 | S02 |
| AC14 | Seed traz 1 leiloeiro, 2 licitantes e lote ao vivo com lances | S09 | — |
| AC15 | Rodar só pelo README e link público funciona | S09 | — |
| TX | Transação do lance (locks e ordem de validação) | S03 | — |
| RT | Tempo real (sala por lote, eventos, reconexão HTTP) | S04 | — |
| SET | Rotina de encerramento idempotente | S05 | — |
| AUTH | JWT + bcrypt + autorização por papel no back | S01 | — |
| DEP | Deploy (hosts, env, migrações e seed no deploy, hibernação) | S00 | S09 |
| MONO | Monorepo | S00 | — |
| DKR | Docker Compose | S00 | S09 |
| TST | Testes (regras, tx simultânea, liquidação, cancelamento, adulteração) | S09 | S00, S01, S08 |
| STAT | Status do lote calculado | S02 | — |
| CLK | Relógio do servidor | S04 | S00, S02 |
| DM-User | Entidade Usuário | S01 | — |
| DM-Wallet | Entidade Carteira | S01 | — |
| DM-Ledger | Entidade Movimentação | S01 | — |
| DM-Item | Entidade Item (snapshot) | S02 | — |
| DM-Lot | Entidade Lote | S02 | — |
| DM-Bid | Entidade Lance | S03 | — |
| DM-Receipt | Entidade Comprovante | S05 | — |
| UX-A11Y | Piso de acessibilidade | S09 | S00, S01, S02, S03, S06, S07, S08 |
| UX-RESP | Responsivo fluido | S09 | S00, S02, S03, S08 |
| UX-THEME | Dois temas | S00 | S02, S03, S08, S09 |
| UX-VOICE | Voz do pátio | S09 | S03 |
| UX-RECON | Carregando/erro/conexão | S09 | S00, S01, S03, S04, S06, S07, S08 |