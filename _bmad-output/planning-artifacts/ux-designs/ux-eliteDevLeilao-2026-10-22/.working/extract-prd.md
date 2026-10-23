# Extração do PRD — Casa de Leilões de Carros (Teste Técnico Verzel)

Fonte: `_bmad-output/planning-artifacts/PRD — Plataforma de Leilão de Carros (Teste Técnico).md` (22/10/2026, @Felipe). O PRD não usa IDs formais de requisito (RF-xx); os itens abaixo são numerados como no PRD (regras 1–15) ou receberam rótulos de extração (RF-A, RF-B...) apenas para referência. Nada foi inferido além do texto.

## 1. Visão geral
- Casa de Leilões online de carros para o teste técnico Elite Dev da Verzel.
- Leiloeiro monta lotes a partir de carros buscados em API pública; licitantes com saldo simulado disputam com lances ao vivo; vencedor recebe comprovante compartilhável por link; qualquer pessoa, mesmo sem login, audita o histórico de lances de um lote e verifica que não foi adulterado.
- Prazo: "7 dias corridos"; deploy obrigatório.
- Diferenciais de avaliação: regras de lance/saldo corretas (inclusive lances simultâneos); sala do lote ao vivo sem recarregar; app funciona com API externa fora; histórico à prova de adulteração com técnica explicada; deploy com dados de teste; README detalhado incluindo comportamentos inesperados.
- Versão anterior do PRD: saem preço mínimo de venda e decisão do leiloeiro ("ao fim do lote o maior lance sempre arremata"). Entram carteira com saldo comprometido, prorrogação de 2 minutos, liquidação, comprovante e auditoria pública.

## 2. Papéis/atores
Cada conta tem um único papel, escolhido no cadastro.
| Papel | Pode | Não pode |
|---|---|---|
| Visitante (sem login) | Ver vitrine e salas; abrir auditoria de qualquer lote; abrir comprovante pelo link | Dar lances; depositar; criar lotes |
| Licitante (cliente) (`BIDDER`) | Depositar saldo simulado; dar lances; ver carteira, "Meus arremates" e próprios comprovantes | Criar ou gerenciar lotes |
| Leiloeiro (vendedor) (`AUCTIONEER`) | Buscar carros na API; criar lotes; cancelar os próprios lotes sem lances; ver resultados e total recebido | Dar lances; mexer em lote de outro leiloeiro |

Sistemas/atores técnicos: back-end (única fonte de verdade de tempo, saldo e valores; único a chamar APIs externas), rotina de encerramento, FIPE API, Wikipedia REST.

## 3. Escopo
Obrigatório: cadastro/login com dois papéis; busca de carros na API e criação de lote; vitrine (ao vivo, agendados, encerrados); sala do lote ao vivo; carteira com depósito simulado e saldo comprometido; lances com todas as regras, prorrogação de 2 min e mensagens de recusa; encerramento com liquidação e comprovante compartilhável; Meus arremates; painel do leiloeiro (cancelar lote sem lances, resultados, total recebido); página de auditoria pública e histórico à prova de adulteração; privacidade dos licitantes na auditoria e comprovante; resiliência à queda da API externa; seed, deploy público, README detalhado.

Opcionais (todos contam na avaliação) e recomendação do PRD: busca e filtro de lotes (Fazer); cancelamento de lote com estorno automático (Fazer); Docker Compose (Fazer); testes automatizados (Fazer); dark mode ("Se der tempo" — "Barato se as cores forem variáveis desde o primeiro dia").

## 4. Fora de escopo (explícito)
- Pelo PDF: nota fiscal, revenda entre usuários, aplicativo nativo, recuperação de senha.
- Por escolha: pagamento real, preço de reserva, lance automático, chat, notificações por e-mail.
- Decisão: edição de lote agendado — "não fazer, o PDF não pede".
- Alternativa descartada: API Art Institute of Chicago (só se o tema não fosse carros).

## 5. Requisitos funcionais (rótulos de extração)
- RF-A Cadastro e login com escolha do papel; sem recuperação de senha.
- RF-B Leiloeiro busca carros na FIPE (marca, modelo, ano em seleções encadeadas), vê imagem sugerida (Wikipedia), pode trocar a URL da imagem, preenche lance inicial, incremento mínimo, início e fim; back-end salva snapshot completo (inclusive imagem).
- RF-C Vitrine (também página inicial): lotes separados em ao vivo, agendados e encerrados; cancelados nunca aparecem; card com imagem, título, lance atual, número de lances, contagem regressiva; busca e filtro (opcional); bloco curto "como funciona".
- RF-D Sala do lote ao vivo (todos veem; licitante dá lances): lance atual; histórico de lances; posição do usuário (ex.: "seu lance é o 2º maior"); contagem regressiva que reflete prorrogações; indicador "você está ganhando" / "você foi superado"; campo de lance com mínimo aceito já sugerido; mensagem de recusa; link para auditoria; tudo sem recarregar.
- RF-E Carteira do licitante: saldo total, comprometido e disponível; depósito simulado; extrato de movimentações (sugestão).
- RF-F Meus arremates: lotes em que deu lance, com status (ganhando, superado, arrematado, perdido); lotes vencidos com comprovante e link de compartilhamento.
- RF-G Comprovante (público, pelo link): lote, dados do carro, valor, data, pseudônimo do vencedor, hash final do histórico, link para auditoria.
- RF-H Painel do leiloeiro: busca na API e criação de lote (imagem, título, atributos, início, fim, lance inicial, incremento); lista dos próprios lotes por status; cancelar lote sem lances; resultado de cada lote encerrado (arrematado ou não, por quanto) e total recebido.
- RF-I Página de auditoria (pública, sem login): histórico completo (ordem, pseudônimo, valor, horário, hash) e veredito "íntegro" ou "adulterado", apontando o primeiro registro com problema.
- Total: "oito telas: as sete pedidas no PDF, mais cadastro e login; a vitrine também funciona como página inicial" (a tabela lista 9 linhas, ver lacunas).

## 6. Regras de negócio de lance/leilão
Princípio: "O servidor é a única fonte de verdade sobre tempo, saldo e valores; todo lance passa pelas regras abaixo dentro de uma única transação."

Lances
1. Só aceitos em lotes ao vivo: "início ≤ horário do servidor < fim".
2. Primeiro lance ≥ lance inicial; seguintes ≥ lance atual + incremento mínimo.
3. Líder não pode cobrir o próprio lance.
4. Só licitantes dão lances; leiloeiro nunca.
5. Lance só aceito se couber no saldo disponível.
6. Irrevogáveis: histórico só recebe inserções, nunca alterações ou remoções.

Saldo
7. Disponível = saldo total − saldo comprometido.
8. Ao assumir a liderança, o valor fica comprometido. Quando superado, volta ao disponível "imediatamente, na mesma transação do lance que o superou".
9. Depósito simulado soma ao saldo total. Limite por depósito simulado: "R$ 10 milhões" (seção Decisões).

Prorrogação (anti-sniping)
10. Lance aceito nos últimos 2 minutos estende o fim: "novo fim = horário do lance + 2 minutos". "Interpretação adotada do texto do PDF", a registrar no README. O lote guarda também "fim original".

Encerramento e liquidação
11. Ao chegar o fim o lote fecha. Com lances, líder vence: valor debitado do saldo total e do comprometido do vencedor, creditado ao leiloeiro, comprovante gerado.
12. Sem lances: fecha sem vencedor.
13. Liquidação uma única vez por lote, mesmo que o encerramento rode de novo (só age se data de liquidação vazia).

Cancelamento
14. Leiloeiro cancela o próprio lote enquanto sem lances; cancelado some da vitrine.
15. Opcional (decidido fazer): cancelar lote com lances, liberando saldo comprometido do líder (estorno) e registrando o cancelamento no histórico.

Posição do usuário: "colocação do maior lance de cada licitante".

Status do lote (calculado, não gravado): cancelado se houver data de cancelamento; agendado antes do início; ao vivo entre início e fim; encerrado depois do fim. Data de liquidação indica se encerramento foi processado. Ciclo de vida: "5 estados" (conteúdo embutido não disponível no texto; descrição: abre sozinho no horário de início; cada lance nos 2 min finais empurra o fim; encerramento leva a arrematado ou sem lances; só lote sem lances pode ser cancelado, salvo opcional).

Empate: o PRD não trata explicitamente; como o lance seguinte exige ≥ atual + incremento e há trava de linha com um único líder, lances simultâneos resultam em "um único líder e saldos consistentes". Ver lacunas.

Exemplo de saldo (Ana): deposita R$ 50.000 (total 50.000 / comprometido 0 / disponível 50.000) → lidera lote A com R$ 30.000 (50.000/30.000/20.000) → tenta R$ 25.000 no lote B: "Recusado: saldo insuficiente" → Bruno cobre no A com R$ 31.000 (50.000/0/50.000) → Ana volta a liderar o A com R$ 32.000 e vence (18.000/0/18.000).

## 7. Mensagens de recusa (códigos e textos literais)
Cinco primeiros exigidos pelo PDF.
| Situação | Código | Mensagem | PDF |
|---|---|---|---|
| Abaixo do mínimo | `BELOW_MINIMUM` | "Seu lance precisa ser de pelo menos R$ 31.000,00." | Sim |
| Saldo insuficiente | `INSUFFICIENT_BALANCE` | "Saldo disponível insuficiente: você tem R$ 20.000,00 livres." (com link para a carteira) | Sim |
| Já está ganhando | `ALREADY_WINNING` | "Você já tem o maior lance deste lote." | Sim |
| Lote não iniciado | `LOT_NOT_STARTED` | "Este lote abre em 24/10 às 14:00." | Sim |
| Lote encerrado | `LOT_ENDED` | "Este lote já foi encerrado." | Sim |
| Lote cancelado | `LOT_CANCELLED` | "Este lote foi cancelado pelo leiloeiro." | Não |
| Leiloeiro dando lance | `ROLE_NOT_ALLOWED` | "Leiloeiros não podem dar lances." | Não |
| Outro lance chegou antes | `BELOW_MINIMUM` | "Alguém deu um lance antes de você. O mínimo agora é R$ 32.000,00." | Não |
Cada recusa "volta com um código e uma mensagem que diz o motivo". Mensagens são "de exemplo".

Outros textos literais de UI: "Licitante 7F3A" (pseudônimo exemplo); "seu lance é o 2º maior"; "você está ganhando"; "você foi superado"; "você" ao lado dos próprios lances (logado); veredito "íntegro" / "adulterado"; "como funciona"; "Meus arremates"; status "ganhando, superado, arrematado, perdido".

## 8. Integração FIPE / Wikipedia
- FIPE `https://fipe.parallelum.com.br/api/v2`, tipo `cars`: marca, modelo, ano, combustível, preço médio, código FIPE, mês de referência. Gratuita; "500 requisições por dia sem token e 1.000 com token gratuito"; sem imagem; atualizada uma vez por mês.
- Endpoints: `/cars/brands`; `/cars/brands/{brandId}/models`; `/cars/brands/{brandId}/models/{modelId}/years`; `/cars/brands/{brandId}/models/{modelId}/years/{yearId}`.
- Wikipedia REST `https://pt.wikipedia.org/api/rest_v1/page/summary/{título}`: miniatura e imagem original; sem chave; exige User-Agent identificando o app; nem todo modelo tem artigo/foto; nome FIPE ("Gol 1.0 MPI") deve ser simplificado ("Volkswagen Gol"); imagens Creative Commons com crédito (campo "crédito da imagem" no Item).
- Fluxo de criação: ver RF-B (4 passos).
- Gestão/falha: só o back-end chama APIs externas; vitrine, salas, auditoria e comprovante leem só o banco; imagem baixada e guardada (banco ou armazenamento de arquivos); sem imagem usa "ilustração padrão"; cache de marcas/modelos/anos "24 horas ou mais"; "Timeout curto, poucas novas tentativas e, se a API estiver fora, mensagem clara só no painel do leiloeiro"; URL base e token em variáveis de ambiente. Seed usa itens de arquivo local, sem chamar FIPE.
- Critério: com API fora, vitrine, salas, auditoria e comprovante continuam funcionando.

## 9. Auditoria / hash / cadeia de integridade
- Técnica: cadeia de hashes com HMAC-SHA256 e chave secreta; hash final também gravado no comprovante. Detecta alteração, remoção e inserção mesmo direto no banco.
- Cada lance guarda: sequência no lote (1,2,3…), pseudônimo, valor, horário, hash anterior, próprio hash.
- Hash = HMAC-SHA256(chave, lote + sequência + pseudônimo + valor + horário + hash anterior). Primeiro lance usa hash inicial derivado dos dados do lote.
- Lote guarda quantidade de lances e último hash, com selo HMAC sobre esses dois valores.
- Chave só em variável de ambiente do servidor, nunca no banco.
- Auditoria recalcula do primeiro ao último e compara com gravado, com o selo e, se houver, com hash do comprovante.
- Detecção: alterar valor/horário/licitante → hash daquele lance não bate; remover do meio → sequência pula e hash seguinte não bate; inserir → sequência/encadeamento quebra; remover últimos → contagem e hash final não batem com selo (e comprovante se encerrado); recalcular cadeia inteira → impossível sem chave.
- SHA-256 sem chave "não basta".
- Limitações (README): quem tem a chave (servidor) poderia forjar nova cadeia; restaurar backup antigo e completo não seria detectado em lotes abertos. Evolução: Ed25519 com chave pública publicada (verificação no navegador). Reforço: usuário do banco da aplicação sem permissão de alterar/apagar a tabela de lances.
- Privacidade: auditoria e comprovante mostram pseudônimo, nunca nome/e-mail ("Licitante 7F3A"); pseudônimo = primeiros caracteres de um HMAC do usuário com o lote (muda por lote, não rastreável entre lotes); logado, o licitante vê "você" ao lado dos próprios lances; comprovante aberto por token aleatório impossível de adivinhar, sem dados pessoais.
- Cancelamento com lances é registrado no histórico.

## 10. Tempo real / Socket.IO
- Uma sala Socket.IO por lote; eventos: novo lance, prorrogação, encerramento; evento privado de carteira atualizada por licitante.
- Evento publicado só após confirmação da transação.
- Ao reconectar, front recarrega estado do lote por HTTP.
- Contagem regressiva usa horário do servidor enviado nos eventos.
- Critério: lance aparece em outro navegador sem recarregar.

## 11. Autenticação
JWT ou sessão; senha com bcrypt ou argon2; autorização por papel no back-end; um papel por conta; sem recuperação de senha.

## 12. Transação do lance (arquitetura)
Trava o lote (`SELECT … FOR UPDATE`); valida período, valor, liderança, papel; trava carteiras do novo licitante e do líder anterior sempre na mesma ordem (evitar deadlock); compromete um e libera o outro; grava lance com hash; atualiza lance atual, líder e fim; confirma; só depois publica evento em tempo real.
Encerramento: rotina "a cada poucos segundos" busca lotes vencidos e não liquidados; liquida cada um numa transação.

## 13. Cadastro de lotes
Campos: título, imagem (URL editável), atributos, início, fim, lance inicial, incremento mínimo. Item snapshot: fonte, id externo (código FIPE + ano), marca, modelo, ano, combustível, preço de referência, mês de referência, imagem (cópia), crédito da imagem, dados brutos da API, buscado em. Lote: leiloeiro, item, título, imagem, atributos, lance inicial, incremento, início, fim, fim original, cancelado em, liquidado em, lance atual, líder, quantidade de lances, hash final, selo. Edição de lote agendado: não.

## 14. Comprovante
Entidade: id, lote, vencedor, pseudônimo, valor, token público, hash final, emitido em; um por lote arrematado. Gerado uma única vez na liquidação. Conteúdo: ver RF-G. Compartilhável por link/token.

## 15. Modelo de dados
Sete entidades: Usuário (id, nome, e-mail, senha hash, papel `AUCTIONEER`/`BIDDER`, criado em); Carteira (usuário, saldo total, comprometido, atualizada em; uma por usuário; disponível calculado; a do leiloeiro recebe créditos); Movimentação (id, usuário, tipo: depósito, débito de arremate, crédito de venda, estorno; valor, lote, criada em); Item; Lote; Lance (id, lote, sequência, licitante, pseudônimo, valor, criado em, hash anterior, hash; único por (lote, sequência); só inserção); Comprovante. Dinheiro em centavos (inteiros); datas em UTC.

## 16. Requisitos não funcionais
- Servidor como fonte de verdade; atomicidade; consistência em lances simultâneos; idempotência da liquidação.
- Resiliência a falha da API externa; cache 24 h+; limite diário FIPE como risco.
- Privacidade (pseudônimos); segredos em variáveis de ambiente (`.env.example`).
- Stack: Next.js + React + TypeScript (front); Node.js + Express + Socket.IO (back, aplicação separada); PostgreSQL + Prisma ("banco e ORM ainda a confirmar na arquitetura"). Python/FastAPI aceitável.
- Monorepo, pastas separadas, um README na raiz, deploy separado.
- Deploy: front em hospedagem com Next (ex.: Vercel); back com WebSocket (Render, Railway, Fly.io); Postgres gerenciado; migrações e seed no deploy; planos gratuitos podem hibernar (citar no README).
- Docker Compose (opcional): 3 serviços (banco, API, front), um comando.
- Testes (opcional): unitários de lance/saldo; integração da transação incluindo dois lances simultâneos; liquidação; cancelamento com estorno; teste que adultera lance direto no banco e confirma que a auditoria acusa.
- Dark mode: cores como variáveis desde o início.
- Responsividade/acessibilidade: não mencionadas.

## 17. Seed
1 leiloeiro e 2 licitantes com saldo (e-mails/senhas no README); lote ao vivo com alguns lances dos dois; lote agendado (início futuro); encerrado e arrematado com comprovante e link; encerrado sem lances; cancelado. Cuidados: datas relativas ao seed e lote ao vivo longo (ex.: 30 dias) ou comando que recria; itens de arquivo local; lances criados pelo serviço da aplicação (cadeia válida).

## 18. Entrega
Formulário da Verzel (`https://elitedev.verzel.com.br/?elite-dev-2026-2`): nome completo e e-mail; repositório público GitHub; mais de um repositório?; deploy (obrigatório); "Onde e como você usou IA". Registro de uso de IA desde o dia 1.
README: visão geral, link deploy, usuários de teste; stack e decisões; pré-requisitos e variáveis, `.env.example`; banco, migrações, seed; rodar back/front e Docker Compose; testes; técnica anti-adulteração; comportamentos inesperados e limitações (interpretação da prorrogação, hibernação, limite FIPE, carros sem imagem, limitações da auditoria).
Plano de 7 dias: D1 repo/stack/modelagem/auth/deploy mínimo; D2 FIPE+Wikipedia/cache/lote/vitrine; D3 carteira/transação/mensagens/testes; D4 sala ao vivo/Socket.IO/prorrogação; D5 encerramento/comprovante/Meus arremates/painel; D6 hashes/auditoria/pseudônimos/seed/Docker/testes; D7 design final, dark mode, README, deploy, envio.

## 19. Critérios de aceite (literais resumidos)
1. Lance fora do período recusado com motivo certo.
2. Primeiro lance < inicial e seguintes < atual + incremento recusados.
3. Líder não cobre o próprio lance.
4. Lance acima do saldo disponível recusado; superado tem saldo liberado na hora.
5. Dois lances simultâneos → um único líder e saldos consistentes.
6. Lance nos últimos 2 minutos estende o fim e todos veem o novo prazo.
7. Lance aparece em outro navegador sem recarregar.
8. Encerramento debita vencedor, credita leiloeiro e gera comprovante uma única vez.
9. Lote sem lances fecha sem vencedor.
10. Cancelado não aparece na vitrine; com lances não pode ser cancelado (ou estorna, se opcional feito).
11. Alterar/remover/inserir lance no banco faz a auditoria acusar.
12. Auditoria e comprovante não mostram nome nem e-mail.
13. API externa fora: vitrine, salas, auditoria, comprovante funcionam.
14. Seed: 1 leiloeiro, 2 licitantes, lote ao vivo com lances.
15. Projeto roda seguindo só o README e o link público funciona.

## 20. Decisões fechadas
Stack Next/Express/PostgreSQL+Prisma (banco/ORM a confirmar); monorepo; imagem da Wikipedia editável com ilustração padrão; prorrogação = lance + 2 min; posição = colocação do maior lance de cada licitante; cancelamento com lances e estorno: fazer; edição de lote agendado: não; limite por depósito: R$ 10 milhões.

## 21. Ambiguidades e lacunas
- Empate de lances/mesmo valor: sem regra explícita (só trava de linha e regra ≥ atual + incremento).
- Prorrogação: "últimos 2 minutos" = janela de 2 min antes do fim; sem limite máximo de prorrogações; PRD admite ser interpretação do PDF.
- Contagem de telas: "oito telas", mas a tabela lista 9 linhas (cadastro e login contados juntos; comprovante e auditoria à parte); número inconsistente.
- Conflito: "Cancelamento de lote sem lances" obrigatório vs. cancelamento com lances/estorno (decidido fazer); critério de aceite 10 admite ambos. Visitante vê cancelado? "Lote cancelado some da vitrine", mas sala/URL direta de lote cancelado tem mensagem `LOT_CANCELLED` (comportamento da página não detalhado).
- Dois códigos iguais `BELOW_MINIMUM` para situações diferentes (lance abaixo vs. outro lance chegou antes).
- Ciclo de vida: diagrama embutido não extraído; "5 estados" não enumerados no texto além de cancelado/agendado/ao vivo/encerrado + arrematado/sem lances.
- Estados exatos de "Meus arremates" ("perdido") e sua definição não detalhados.
- Mensagens de erro da FIPE no painel: texto não definido. Ilustração padrão: não especificada.
- Validações de formulário de lote (início < fim, início no passado, valores mínimos, incremento mínimo) não especificadas. Limite de lance máximo ou formato de moeda: só centavos/R$.
- Lance do saldo do leiloeiro: carteira existe, mas sem tela de carteira para ele (só total recebido).
- Extrato de movimentações é "sugestão".
- Tipo de pseudônimo para o próprio usuário em Meus arremates/comprovante não detalhado.
- Hash inicial "derivado dos dados do lote" sem fórmula.
- Estorno no histórico: formato do registro de cancelamento na cadeia não detalhado.
- Banco/ORM "ainda a confirmar na arquitetura".
- Sem requisitos de acessibilidade, responsividade, i18n (textos em pt-BR), nem de desempenho numéricos.
- Fontes de dados em Item: "dados brutos da API" sem formato.
