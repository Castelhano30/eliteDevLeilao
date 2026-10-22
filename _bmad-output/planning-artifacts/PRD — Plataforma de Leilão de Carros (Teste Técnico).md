# PRD — Casa de Leilões de Carros (Teste Técnico Verzel)

Oct 22, 2026 · @Felipe

## Visão geral

O produto é uma Casa de Leilões online de carros, feita para o teste técnico Elite Dev da Verzel. Um leiloeiro monta lotes a partir de carros buscados em uma API pública, e licitantes com saldo simulado disputam cada lote com lances ao vivo. O vencedor recebe um comprovante compartilhável por link, e qualquer pessoa, mesmo sem login, pode auditar o histórico de lances de um lote e verificar que ele não foi adulterado.

O prazo é de 7 dias corridos, e o deploy é obrigatório. Os pontos em que o projeto mais se diferencia na avaliação são estes:

- Regras de lance e de saldo corretas, inclusive com lances simultâneos
- Sala do lote atualizada ao vivo, sem recarregar a página
- Aplicação que continua funcionando quando a API externa cai
- Histórico de lances à prova de adulteração, com a técnica explicada
- Deploy funcionando, com dados de teste prontos para percorrer o fluxo
- README detalhado, incluindo os comportamentos inesperados

Em relação à versão anterior deste PRD, saem o preço mínimo de venda e a decisão do leiloeiro: pelo PDF, ao fim do lote o maior lance sempre arremata. Entram carteira com saldo comprometido, prorrogação de 2 minutos, liquidação, comprovante e auditoria pública.

## Escopo

Tudo o que o PDF lista como requisito base é obrigatório; dos opcionais, quatro de cinco valem a pena porque custam pouco depois que o núcleo existe.

**Obrigatório**

- Cadastro e login com dois papéis: leiloeiro e licitante
- Busca de carros na API pública e criação de lote a partir do item
- Vitrine de lotes (ao vivo, agendados e encerrados)
- Sala do lote ao vivo
- Carteira do licitante com depósito simulado e saldo comprometido
- Lances com todas as regras, prorrogação de 2 minutos e mensagens de recusa
- Encerramento com liquidação e comprovante de arremate compartilhável
- Meus arremates
- Painel do leiloeiro com cancelamento de lote sem lances, resultados e total recebido
- Página de auditoria pública e histórico à prova de adulteração
- Privacidade dos licitantes na auditoria e no comprovante
- Resiliência à queda da API externa
- Dados de teste semeados, deploy público e README detalhado

**Opcionais (todos contam na avaliação)**

| Opcional | Recomendação | Por quê |
| --- | --- | --- |
| Busca e filtro de lotes | Fazer | Pouco esforço sobre a vitrine que já existe |
| Cancelamento de lote com estorno automático | Fazer | Reaproveita a liberação de saldo comprometido que já existe quando alguém é superado |
| Docker Compose | Fazer | Simplifica o README e a vida de quem avalia |
| Testes automatizados | Fazer | Foco nas regras de lance, saldo, liquidação e auditoria |
| Dark mode | Se der tempo | Barato se as cores forem variáveis desde o primeiro dia |

**Não fazer**

- Pelo PDF: nota fiscal, revenda entre usuários, aplicativo nativo e recuperação de senha
- Por escolha: pagamento real, preço de reserva, lance automático, chat e notificações por e-mail

## Papéis e permissões

O PDF define dois papéis distintos, então cada conta tem um único papel, escolhido no cadastro; o visitante sem login também tem acesso a partes públicas.

| Papel | Pode | Não pode |
| --- | --- | --- |
| Visitante (sem login) | Ver a vitrine e as salas dos lotes; abrir a auditoria de qualquer lote; abrir um comprovante pelo link | Dar lances; depositar; criar lotes |
| Licitante (cliente) | Depositar saldo simulado; dar lances; ver carteira, "Meus arremates" e os próprios comprovantes | Criar ou gerenciar lotes |
| Leiloeiro (vendedor) | Buscar carros na API; criar lotes; cancelar os próprios lotes sem lances; ver resultados e total recebido | Dar lances; mexer em lote de outro leiloeiro |

## API pública de itens

A recomendação é usar a API da Tabela FIPE para os dados do carro e a API REST da Wikipedia para sugerir a imagem, porque a FIPE não tem fotos e o PDF exige imagem no lote. Ambas são gratuitas e não exigem cadastro.

| Fonte | Para quê | Acesso e limite | Ponto de atenção |
| --- | --- | --- | --- |
| FIPE (`https://fipe.parallelum.com.br/api/v2`) | Marca, modelo, ano, combustível, preço médio, código FIPE e mês de referência | Gratuita; 500 requisições por dia sem token e 1.000 com token gratuito | Sem imagem; atualizada uma vez por mês |
| Wikipedia REST (`https://pt.wikipedia.org/api/rest_v1/page/summary/{título}`) | Miniatura e imagem original do artigo do modelo | Gratuita, sem chave; pede um User-Agent identificando o app | Nem todo modelo tem artigo ou foto; o nome da FIPE ("Gol 1.0 MPI") precisa ser simplificado ("Volkswagen Gol"); imagens sob licença Creative Commons, com crédito |

Endpoints da FIPE usados (tipo de veículo `cars`):

| Endpoint | Retorna |
| --- | --- |
| `/cars/brands` | Marcas |
| `/cars/brands/{brandId}/models` | Modelos da marca |
| `/cars/brands/{brandId}/models/{modelId}/years` | Anos e combustíveis do modelo |
| `/cars/brands/{brandId}/models/{modelId}/years/{yearId}` | Dados completos e preço de referência |

**Fluxo de criação do lote**

1. O leiloeiro escolhe marca, modelo e ano em seleções encadeadas (dados da FIPE).
2. O back-end busca a imagem sugerida na Wikipedia pelo nome simplificado do modelo.
3. O leiloeiro confere, pode trocar a URL da imagem e preenche lance inicial, incremento mínimo, início e fim.
4. O back-end salva uma cópia completa do item no banco (snapshot), incluindo a imagem.

**Gestão da API externa (exigida pelo PDF)**

- Só o back-end chama as APIs externas; o front nunca.
- Vitrine, salas, auditoria e comprovante leem apenas o banco; nenhuma dessas telas chama a API.
- Baixe a imagem e guarde uma cópia (no banco ou em um armazenamento de arquivos), para a vitrine não depender da Wikipedia; sem imagem, use uma ilustração padrão.
- Cache de marcas, modelos e anos (24 horas ou mais), porque os dados mudam uma vez por mês e o limite diário é o risco real.
- Timeout curto, poucas novas tentativas e, se a API estiver fora, mensagem clara só no painel do leiloeiro.
- URL base e token em variáveis de ambiente.

Uma alternativa, se o tema não fosse carros, seria a API do Art Institute of Chicago, que traz dados e imagens na mesma resposta e não exige chave. Com carros, a combinação FIPE e Wikipedia resolve.

## Regras de negócio

O servidor é a única fonte de verdade sobre tempo, saldo e valores; todo lance passa pelas regras abaixo dentro de uma única transação.

**Lances**

1. Só são aceitos em lotes ao vivo: início ≤ horário do servidor < fim.
2. O primeiro lance deve ser ≥ lance inicial. Os seguintes devem ser ≥ lance atual + incremento mínimo.
3. O licitante líder não pode cobrir o próprio lance.
4. Só licitantes dão lances; o leiloeiro nunca.
5. O lance só é aceito se couber no saldo disponível do licitante.
6. Lances são irrevogáveis: o histórico só recebe inserções, nunca alterações ou remoções.

**Saldo**

7. Saldo disponível = saldo total − saldo comprometido.
8. Ao assumir a liderança, o valor do lance fica comprometido. Quando superado, esse valor volta ao disponível imediatamente, na mesma transação do lance que o superou.
9. O depósito simulado soma ao saldo total.

**Prorrogação (anti-sniping)**

10. Lance aceito nos últimos 2 minutos estende o fim do lote: novo fim = horário do lance + 2 minutos. Essa é a interpretação adotada do texto do PDF e vai registrada no README.

**Encerramento e liquidação**

11. Ao chegar o fim, o lote fecha. Com lances, o líder vence: o valor é debitado do saldo total e do comprometido do vencedor, creditado ao leiloeiro, e o comprovante é gerado.
12. Lote sem lances fecha sem vencedor.
13. A liquidação acontece uma única vez por lote, mesmo que o processo de encerramento rode de novo.

**Cancelamento**

14. O leiloeiro pode cancelar o próprio lote enquanto ele não tiver lances. Lote cancelado some da vitrine.
15. Opcional: cancelar lote com lances, liberando automaticamente o saldo comprometido do líder (estorno) e registrando o cancelamento no histórico.

**Exemplo de saldo**

| Evento | Total da Ana | Comprometido | Disponível |
| --- | --- | --- | --- |
| Ana deposita R$ 50.000 | R$ 50.000 | R$ 0 | R$ 50.000 |
| Ana lidera o lote A com R$ 30.000 | R$ 50.000 | R$ 30.000 | R$ 20.000 |
| Ana tenta R$ 25.000 no lote B | Recusado: saldo insuficiente |  |  |
| Bruno cobre no lote A com R$ 31.000 | R$ 50.000 | R$ 0 | R$ 50.000 |
| Ana volta a liderar o lote A com R$ 32.000 e vence | R$ 18.000 | R$ 0 | R$ 18.000 |

## Ciclo de vida do lote

&#91;embedded content: ciclo de vida do lote · 5 estados\]

O lote abre sozinho no horário de início, porque o status é calculado pelo horário. Cada lance nos 2 minutos finais empurra o fim, e o encerramento leva a arrematado ou sem lances. Só lote sem lances pode ser cancelado; cancelar com lances, estornando o líder, é o opcional do PDF.

## Telas do front-end

São oito telas: as sete pedidas no PDF, mais cadastro e login; a vitrine também funciona como página inicial.

| Tela | Quem acessa | O que precisa ter |
| --- | --- | --- |
| Vitrine de lotes (início) | Todos | Lotes separados em ao vivo, agendados e encerrados; cancelados nunca aparecem; card com imagem, título, lance atual, número de lances e contagem regressiva; busca e filtro (opcional); um bloco curto de "como funciona" |
| Cadastro e login | Todos | Escolha do papel no cadastro; sem recuperação de senha |
| Sala do lote ao vivo | Todos veem; licitante dá lances | Lance atual; histórico de lances; posição do usuário (ex.: "seu lance é o 2º maior"); contagem regressiva que reflete prorrogações; indicador claro de "você está ganhando" ou "você foi superado"; campo de lance com o mínimo aceito já sugerido; mensagem de recusa; link para a auditoria; tudo sem recarregar a página |
| Carteira do licitante | Licitante | Saldo total, comprometido e disponível; depósito simulado; extrato de movimentações (sugestão) |
| Meus arremates | Licitante | Lotes em que deu lance, com status (ganhando, superado, arrematado, perdido); lotes vencidos com comprovante e link de compartilhamento |
| Comprovante de arremate | Público, pelo link | Lote, dados do carro, valor, data, pseudônimo do vencedor, hash final do histórico e link para a auditoria |
| Painel do leiloeiro | Leiloeiro | Busca na API e criação de lote (imagem, título, atributos, início, fim, lance inicial, incremento); lista dos próprios lotes por status; cancelar lote sem lances; resultado de cada lote encerrado (arrematado ou não, por quanto) e total recebido |
| Página de auditoria | Pública, sem login | Histórico completo de lances (ordem, pseudônimo, valor, horário, hash) e o veredito "íntegro" ou "adulterado", apontando o primeiro registro com problema |

## Mensagens de feedback

Cada lance recusado volta com um código e uma mensagem que diz o motivo; os cinco primeiros são exigidos pelo PDF.

| Situação | Código | Mensagem de exemplo | Exigido pelo PDF |
| --- | --- | --- | --- |
| Abaixo do mínimo | `BELOW_MINIMUM` | "Seu lance precisa ser de pelo menos R$ 31.000,00." | Sim |
| Saldo insuficiente | `INSUFFICIENT_BALANCE` | "Saldo disponível insuficiente: você tem R$ 20.000,00 livres." (com link para a carteira) | Sim |
| Já está ganhando | `ALREADY_WINNING` | "Você já tem o maior lance deste lote." | Sim |
| Lote ainda não iniciado | `LOT_NOT_STARTED` | "Este lote abre em 24/10 às 14:00." | Sim |
| Lote encerrado | `LOT_ENDED` | "Este lote já foi encerrado." | Sim |
| Lote cancelado | `LOT_CANCELLED` | "Este lote foi cancelado pelo leiloeiro." | Não |
| Leiloeiro tentando dar lance | `ROLE_NOT_ALLOWED` | "Leiloeiros não podem dar lances." | Não |
| Outro lance chegou antes | `BELOW_MINIMUM` | "Alguém deu um lance antes de você. O mínimo agora é R$ 32.000,00." | Não |

## Histórico à prova de adulteração e privacidade

A técnica recomendada é uma cadeia de hashes assinada com uma chave secreta (HMAC-SHA256), com o hash final gravado também no comprovante. Ela detecta alteração, remoção e inserção de lances, mesmo feitas direto no banco, que é o que o PDF pede.

**Como funciona**

1. Cada lance guarda: número sequencial no lote (1, 2, 3…), pseudônimo do licitante, valor, horário, o hash do lance anterior e o próprio hash.
2. O hash de cada lance é HMAC-SHA256(chave, lote + sequência + pseudônimo + valor + horário + hash anterior). O primeiro lance usa um hash inicial derivado dos dados do lote.
3. O lote guarda a quantidade de lances e o último hash, com um selo HMAC sobre esses dois valores.
4. A chave fica só em variável de ambiente do servidor, nunca no banco.
5. A auditoria recalcula a cadeia do primeiro ao último lance e compara com o que está gravado, com o selo do lote e, se houver, com o hash impresso no comprovante.

| Adulteração | Como é detectada |
| --- | --- |
| Alterar valor, horário ou licitante de um lance | O hash daquele lance deixa de bater |
| Remover um lance do meio | A sequência pula e o hash do lance seguinte deixa de bater |
| Inserir um lance | A sequência ou o encadeamento quebra |
| Remover os últimos lances | A contagem e o hash final não batem com o selo do lote; em lotes encerrados, também não batem com o comprovante |
| Recalcular a cadeia inteira no banco | Impossível sem a chave secreta |

Um hash simples (SHA-256 sem chave) não basta: quem tem acesso ao banco recalcula a cadeia inteira e ninguém percebe. A chave fora do banco é o que impede isso.

Limitações para citar no README: quem tem a chave (o próprio servidor) poderia forjar uma cadeia nova, e restaurar um backup antigo e completo do banco não seria detectado em lotes ainda abertos. Uma evolução possível é assinar com Ed25519 e publicar a chave pública, o que permite verificar no próprio navegador. Como reforço, o usuário do banco usado pela aplicação pode ficar sem permissão de alterar ou apagar a tabela de lances.

**Privacidade**

- Auditoria e comprovante mostram um pseudônimo, nunca nome ou e-mail, por exemplo "Licitante 7F3A".
- O pseudônimo vem dos primeiros caracteres de um HMAC do usuário com o lote, então muda de um lote para outro e não permite rastrear a mesma pessoa entre lotes.
- Logado, o licitante vê "você" ao lado dos próprios lances.
- O comprovante é aberto por um token aleatório, impossível de adivinhar, e não expõe dados pessoais.

## Modelo de dados

Sete entidades cobrem o PDF; valores em dinheiro ficam em centavos (números inteiros) e datas em UTC.

| Entidade | Campos principais | Observações |
| --- | --- | --- |
| Usuário | id, nome, e-mail, senha (hash), papel (`AUCTIONEER` ou `BIDDER`), criado em | Um papel por conta |
| Carteira | usuário, saldo total, saldo comprometido, atualizada em | Uma por usuário; o disponível é calculado; a do leiloeiro recebe os créditos |
| Movimentação | id, usuário, tipo (depósito, débito de arremate, crédito de venda, estorno), valor, lote, criada em | Extrato da carteira |
| Item | id, fonte, id externo (código FIPE + ano), marca, modelo, ano, combustível, preço de referência, mês de referência, imagem (cópia), crédito da imagem, dados brutos da API, buscado em | Snapshot que torna o app independente da API |
| Lote | id, leiloeiro, item, título, imagem, atributos, lance inicial, incremento mínimo, início, fim, fim original, cancelado em, liquidado em, lance atual, líder, quantidade de lances, hash final, selo | Status calculado (abaixo) |
| Lance | id, lote, sequência, licitante, pseudônimo, valor, criado em, hash anterior, hash | Único por (lote, sequência); só inserção |
| Comprovante | id, lote, vencedor, pseudônimo, valor, token público, hash final, emitido em | Um por lote arrematado |

O status do lote é calculado, não gravado: cancelado se houver data de cancelamento; agendado antes do início; ao vivo entre início e fim; encerrado depois do fim. A data de liquidação indica se o encerramento já foi processado. Assim não é preciso nenhum processo para "abrir" lotes no horário.

## Arquitetura e pontos técnicos

A stack escolhida é React com Next.js e TypeScript no front, Node.js com Express e Socket.IO no back (aplicação separada do front), e PostgreSQL com Prisma. O PostgreSQL é a melhor escolha aqui porque o núcleo do desafio são transações com travas de linha. Python com FastAPI também atende, se for a linguagem mais familiar.

- **Transação do lance.** Trava o lote (`SELECT … FOR UPDATE`); valida período, valor, liderança e papel; trava as carteiras do novo licitante e do líder anterior, sempre na mesma ordem para evitar deadlock; compromete o saldo de um e libera o do outro; grava o lance com o hash; atualiza lance atual, líder e fim (prorrogação); confirma a transação. Só depois disso publica o evento em tempo real.
- **Tempo real.** Uma sala do Socket.IO por lote, com eventos de novo lance, prorrogação e encerramento, e um evento privado de carteira atualizada para cada licitante. Ao reconectar, o front recarrega o estado do lote por HTTP. A contagem regressiva usa o horário do servidor enviado nos eventos.
- **Encerramento.** Uma rotina a cada poucos segundos busca lotes vencidos e não liquidados e liquida cada um em uma transação. Ela só age se a data de liquidação estiver vazia, então rodar duas vezes não liquida duas vezes.
- **API externa.** Isolada em um módulo com cache, timeout e tratamento de erro; nenhuma tela pública depende dela.
- **Autenticação.** JWT ou sessão, senha com bcrypt ou argon2, e autorização por papel no back-end.
- **Deploy.** Front Next.js em uma hospedagem com suporte a Next (como Vercel); back em uma plataforma que mantenha conexões WebSocket abertas (como Render, Railway ou Fly.io); PostgreSQL gerenciado. Variáveis de ambiente fora do código, e migrações e seed rodando no deploy. Alguns planos gratuitos hibernam o servidor sem uso, o que atrasa o primeiro acesso: confirme o comportamento e cite no README.
- **Monorepo.** Front (Next.js) e back (Express) no mesmo repositório, em pastas separadas, com um único README na raiz. Cada parte tem seu próprio deploy.
- **Docker Compose (opcional).** Três serviços (banco, API e front) que sobem com um único comando.
- **Testes (opcional).** Unitários das regras de lance e saldo; integração da transação de lance, inclusive dois lances simultâneos; liquidação; cancelamento com estorno; e um teste que adultera um lance direto no banco e confirma que a auditoria acusa.

## Dados de teste (seed)

O PDF exige um leiloeiro, dois clientes e ao menos um lote publicado com lances abertos; o seed abaixo cobre isso e um exemplo de cada estado.

| Dado | Conteúdo |
| --- | --- |
| Usuários | 1 leiloeiro e 2 licitantes com saldo depositado; e-mails e senhas no README |
| Lote ao vivo | Com alguns lances dos dois licitantes, para a avaliação dar lances na hora |
| Lote agendado | Com início no futuro |
| Lote encerrado e arrematado | Com comprovante gerado e link funcionando |
| Lote encerrado sem lances | Para mostrar o fechamento sem vencedor |
| Lote cancelado | Para mostrar que não aparece na vitrine |

Três cuidados:

- Datas relativas ao momento do seed, e o lote ao vivo com duração longa (por exemplo, 30 dias), para continuar aberto quando a avaliação acontecer. Melhor ainda: um comando que recria o lote de demonstração.
- Itens do seed gravados a partir de um arquivo local, sem chamar a FIPE, para o seed funcionar mesmo com a API fora.
- Lances do seed criados pelo mesmo serviço da aplicação, nunca por inserção direta, para a cadeia de hashes nascer válida.

## Entrega

A entrega é pelo [formulário da Verzel](https://elitedev.verzel.com.br/?elite-dev-2026-2), com repositório público no GitHub, link do deploy e o relato do uso de IA. Um README fraco tira nota.

**O README precisa ter**

- [ ] Visão geral, link do deploy e usuários de teste (e-mail e senha)
- [ ] Stack e decisões principais
- [ ] Pré-requisitos e variáveis de ambiente, com um `.env.example`
- [ ] Como configurar e usar o banco, rodar migrações e o seed
- [ ] Como rodar back-end e front-end, e o Docker Compose
- [ ] Como rodar os testes
- [ ] A técnica anti-adulteração explicada, como pede o PDF
- [ ] Comportamentos inesperados e limitações: interpretação da prorrogação, hibernação do servidor gratuito, limite diário da FIPE, carros sem imagem, limitações da auditoria

**Formulário de envio**

| Campo | O que informar |
| --- | --- |
| Nome completo e e-mail | Dados de contato |
| Repositório | Link do repositório público no GitHub |
| Tem mais de um repositório? | Se front e back estiverem separados, os dois links |
| Deploy | Link público da aplicação (obrigatório) |
| Onde e como você usou IA | Onde usou, como usou e o que revisou ou ajustou |

**Uso de IA**

Mantenha um registro desde o primeiro dia: o que foi feito com IA (pesquisa, PRD, design, código, testes, README), o que você revisou e o que mudou. Esteja pronto para explicar qualquer trecho do código.

## Plano de 7 dias e critérios de aceite

O plano faz um primeiro deploy no dia 1 e deixa o último dia só para polimento, README e envio, porque deploy quebrando no fim é o maior risco do prazo.

1. Dia 1: ler o PDF de novo, criar o repositório, fechar stack e hospedagem, modelar o banco, autenticação com papéis e um deploy mínimo de front e back.
2. Dia 2: integração com FIPE e Wikipedia (com cache), criação de lote com snapshot e vitrine.
3. Dia 3: carteira com depósito, transação do lance com todas as regras, mensagens de recusa e testes das regras.
4. Dia 4: sala ao vivo com Socket.IO, contagem regressiva e prorrogação.
5. Dia 5: encerramento e liquidação, comprovante, Meus arremates, painel do leiloeiro com cancelamento e resultados.
6. Dia 6: cadeia de hashes, página de auditoria, pseudônimos, seed, Docker Compose e testes restantes.
7. Dia 7: design final e dark mode, README, deploy final testado pelo link público e envio do formulário.

**Critérios de aceite**

- [ ] Lance fora do período do lote é recusado com o motivo certo
- [ ] Primeiro lance abaixo do inicial e seguintes abaixo de atual + incremento são recusados
- [ ] O líder não consegue cobrir o próprio lance
- [ ] Lance acima do saldo disponível é recusado; quem é superado tem o saldo liberado na hora
- [ ] Dois lances simultâneos resultam em um único líder e saldos consistentes
- [ ] Lance nos últimos 2 minutos estende o fim, e todos veem o novo prazo
- [ ] Um lance aparece em outro navegador sem recarregar a página
- [ ] O encerramento debita o vencedor, credita o leiloeiro e gera o comprovante uma única vez
- [ ] Lote sem lances fecha sem vencedor
- [ ] Lote cancelado não aparece na vitrine; lote com lances não pode ser cancelado (ou estorna, se o opcional for feito)
- [ ] Alterar, remover ou inserir um lance direto no banco faz a auditoria acusar adulteração
- [ ] Auditoria e comprovante não mostram nome nem e-mail
- [ ] Com a API externa fora do ar, vitrine, salas, auditoria e comprovante continuam funcionando
- [ ] O seed traz 1 leiloeiro, 2 licitantes e um lote ao vivo com lances
- [ ] Alguém consegue rodar o projeto seguindo só o README, e o link público funciona

## Decisões

O PDF deixou alguns pontos para decidir; todos estão fechados abaixo.

- **Stack:** React com Next.js no front, Node.js com Express no back, PostgreSQL com Prisma (banco e ORM ainda a confirmar na arquitetura)
- **Repositório:** monorepo, com front e back no mesmo repositório, para facilitar a avaliação
- **Imagem dos lotes:** sugestão da Wikipedia, editável pelo leiloeiro, com ilustração padrão quando faltar
- **Prorrogação:** novo fim = horário do lance + 2 minutos
- **Posição do usuário nos lances:** colocação do maior lance de cada licitante
- **Cancelamento de lote com lances:** fazer o opcional, com estorno automático do saldo do líder
- **Edição de lote agendado:** não fazer, o PDF não pede
- **Limite por depósito simulado:** R$ 10 milhões

## Fontes

- PDF "Teste técnico: Elite Dev na Verzel" (recebido em 22/10/2026)
- Referências indicadas no PDF: [Catawiki](https://www.catawiki.com/pt), [LiveAuctioneers](https://www.liveauctioneers.com/) e [Superbid](https://www.superbid.net/)
- [Documentação da FIPE API](https://fipe.api.br/docs/api)
- [Wikipedia REST API, endpoint de resumo de página](https://freeapihub.com/apis/wikipedia-api)
- [Art Institute of Chicago API](https://dev.to/0012303/10-free-art-museum-apis-with-no-key-2026-3nm8)
