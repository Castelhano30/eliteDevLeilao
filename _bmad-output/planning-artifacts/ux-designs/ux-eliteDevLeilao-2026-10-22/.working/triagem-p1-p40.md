# Triagem P1–P40 — fontes e decisões pendentes

Leitura em 22/10/2026. A matriz abaixo registra a triagem antes da resposta. Depois dela o usuário autorizou: “pode seguir o recomendado para todas as perguntas. Desde que estejam de acordo com o prd”. O bloco final transforma lacunas em recomendações adotáveis sob essa autorização; não altera regras funcionais. Preserva a precedência: decisões do usuário no memlog; PRD markdown funcional; protótipos visuais. PDF não usado. Os documentos principais ficam em `planning-artifacts/`, não dentro da pasta de sessão.

Fontes: `PRD — Plataforma de Leilão de Carros (Teste Técnico).md`; `EXPERIENCE.md`; `DESIGN.md`; `.memlog.md`; extrações `extract-prd.md`, `extract-screens-1.md`, `extract-screens-2.md` e `extract-tokens.md`. Referências abaixo são seções dessas fontes. As extrações identificam o protótipo correspondente.

Classificação: **F** = resposta já sustentada por fonte; **H** = falta decisão humana sobre experiência/visual ou divergência; **T** = contrato técnico/implementação, sem necessidade de pedir escolha técnica ao usuário. Uma pergunta pode misturar classes; não reapresentar a parte F como decisão aberta.

## Grupo 1 — Sala e ciclo de vida (pergunta já enviada pelo agente principal)

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P1 | F + H | PRD Papéis: visitante vê salas; regras 1–2: agendado não aceita lance. Vitrine liga agendado à Sala. | Apresentação de abertura, cronômetro e formulário indisponível; não perguntar se lance antes da abertura é permitido. |
| P2 | F + H + T | Memlog: cancelamento com estorno; PRD: cancelado sai da vitrine e `LOT_CANCELLED`. | Sala acessada por URL e comunicação a quem está dentro; transporte/evento de cancelamento é T. |
| P3 | F + H | Memlog já decidiu que Sala sem lances usa lance inicial; PRD regra 2. | Rótulo, ausência de líder e histórico vazio; não reabrir escolha entre inicial e R$ 0 como mínimo. |
| P4 | H | PRD exige posição de quem deu lance; protótipo só superado/ganhando. | Texto/estado do licitante ainda sem lance. |
| P5 | F + H | PRD Papéis e regra 4: leiloeiro vê salas e nunca dá lance; cancelamento próprio já no Painel. | Apresentação do espectador; incluir ação de cancelar dentro da Sala é nova escolha de superfície, não requisito. |
| P6 | F + H + T | PRD Encerramento: fecha no fim; rotina a cada poucos segundos; comprovante após liquidação. | Estado de espera e texto. Não fixar prazo máximo fictício; retry/timeout é T. |
| P20 | F + H | PRD regra 1 proíbe lance encerrado; manual tem botão desabilitado “Lote fechado”; protótipo Sala diverge. | Aprovar correção visual do CTA/fantasma; não perguntar se visitante pode dar lance fechado. |
| P21 | F + H | PRD regra 12: sem vencedor; Vitrine e Painel já usam carimbo “Sem lances”. | Aplicação desse tratamento à Sala e microcopy. |

## Grupo 2 — Acesso, navegação e identidade

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P7 | H + T | Nenhum protótipo contém logout. | Local da ação “Sair”; revogação/limpeza de sessão é T. |
| P8 | F + H | PRD define papéis e destinos permitidos, um papel por conta. | Destino pós-login/cadastro, retorno à intenção e apresentação de acesso negado. Não reabrir permissões. |
| P13 | F + H + T | Acesso: senha “Mínimo de 8 caracteres”, e-mail e nome, texto de login inválido; sem recuperação. | Aprovação agrupada dos estados/microcopy faltantes; validação equivalente no servidor e prevenção de envio duplicado são T. |
| P18 | F + H + T | Design usa números 018/025; PRD tem `id` e token público; memlog exige token aleatório. | Se preservar número público separado, quando atribuí-lo e como rotular recibo. Implementação do gerador é T; número legível nunca substitui token do link. |
| P39 | F + H | PRD Privacidade: comprovante público mostra pseudônimo; próprios lances mostram “você”; memlog: cabeçalho só VOCÊ + papel. | Tratamento privado em Meus arremates não detalhado. Não substituir pseudônimo do comprovante público por “VOCÊ” como identidade exclusiva. |

## Grupo 3 — Cancelamento e carteira

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P9 | F + H | Memlog exige confirmação; EXPERIENCE já define conteúdo, estorno do líder e histórico. | Visual do diálogo reaproveitando sistema existente; não reabrir necessidade de confirmar. |
| P10 | F + H | PRD Painel lista próprios lotes por status; Meus arremates lista lotes onde deu lance; auditoria qualquer lote já decidido. | Como acomodar estado Cancelado/filtro e seus links sem inventar tela extra. |
| P11 | F + H + T | Cancelamento no histórico obrigatório por memlog/PRD; formato atual da cadeia só detalha lances. | Apresentação da linha/evento e abrangência declarada da verificação. Formato criptográfico é T; não afirmar que cancelamento é verificado sem contrato correspondente. |
| P15 | F + H | Limite R$ 10 milhões já decidido; dinheiro só reais inteiros. | Texto de limite/valor inválido pode ser aprovado junto de todos os estados de formulário; não reabrir limite. |
| P19 | F | PRD regra 8 libera saldo na transação do lance que supera. | Correção textual factual: não dizer que liberação ocorreu só no encerramento. Não exige escolha de regra de negócio. |
| P26 | F + H | Carteira do design registra “Estorno — Superado no lote”, “VOLTOU AO DISPONÍVEL · TOTAL NÃO MUDA”; PRD lista tipo estorno e saldo comprometido separado. | Confirmação semântica de estorno por superação versus cancelamento e textos vazios. O design já é evidência a favor de ambos aparecerem, não ausência completa de regra. |
| P36 | F + H + T | PRD transações: servidor como fonte; cancelar com lances estorna líder. | Se mudança no diálogo exige nova confirmação ou aviso atualizado. Estornar o líder atual atomicamente é T, não opção do usuário. |

## Grupo 4 — Formulários, imagens, vazio e falhas

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P12 | H | Links públicos e nenhum protótipo 404. | Estado de não encontrado e ação de saída, agrupado a erros comuns. |
| P14 | F + H + T | PRD exige campos; design diz agendado aparece na hora; prévia fixa contradiz intenção de prévia. | Limites de valores/datas não definidos, retorno pós-criação e microcopy. Correção para prévia refletir formulário é T/F; não atrelar mínimo à FIPE sem decisão. |
| P24 | H | Design só possui vazio de filtros (“Nada com esse filtro”). | Texto de vitrine realmente sem lotes, reutilizando vazio existente. |
| P25 | F + H | PRD exige imagem salva, URL editável, crédito e ilustração sem imagem. DESIGN cartao-lote diz “sempre ilustração SVG, nunca foto”: divergência explícita. | Tratamento visual de fotos, corte/proporção/crédito e falha; não perguntar se armazenamento da imagem ou crédito são necessários. |
| P28 | F | CriarLoteErro traz “A tabela FIPE não respondeu” e preservação de formulário; PRD só pede clareza. | Nenhuma divergência: conservar texto existente, sem perguntar novamente. |
| P29 | F + H | PRD diz nem todo carro tem foto, fallback ilustração; CriarLote tem “Sem foto” e URL editável. | Estado/microcopy da busca e falha de sugestão, sem bloquear indevidamente seleção FIPE válida. |

## Grupo 5 — Tempo real e auditoria

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P16 | F + H + T | PRD exige recarregar HTTP ao reconectar e servidor como verdade. | Bloquear ou permitir envio com socket indisponível e apresentação de reconexão/erro. Transporte, retries e sincronização são T. |
| P27 | F | PRD status: agendado, ao vivo, cancelado, encerrado com arremate ou sem lances; Arremates perdido mostra “seu maior lance” e vencedor de outro. | Documentar derivação dos cinco estados; perdido = participou, encerrado e outro venceu. Cancelado deve manter semântica própria (P10), não ser confundido automaticamente com perdido. |
| P30 | H + T | Auditoria tem “Verificar de novo”; PRD não exige stream de auditoria. | Retrato com instante de verificação versus atualização automática. Implementação de consistência da fotografia é T. |
| P31 | F + H + T | PRD detecta truncamento comparando contagem/hash/selo; auditoria sem lances já autorizada. | Mensagem de falha estrutural sem linha existente e veredito vazio após verificação; nunca inventar linha culpada ou dizer íntegro só porque lista vazia. |
| P32 | F + T | PRD “Transação do lance”: período, valor, liderança, papel; depois carteiras e saldo. | Contrato arquitetural de precedência e autenticação; não é escolha visual e já existe ordem funcional de referência. |
| P33 | F + H + T | Sala sem recarga é obrigatório. EXPERIENCE propõe cartões atualizando, mas PRD eventos só por lote e mock Painel estático. | Garantia de atualização de Vitrine/Painel (automática ou manual); canal técnico é T. |
| P34 | F + T | PRD reutiliza BELOW_MINIMUM para duas mensagens; código + motivo já exigidos. | Contrato de motivo/subtipo ou resposta textual do servidor. Não pedir usuário escolher API. |

## Grupo 6 — Preferências e visual responsivo

| P | Classe | Evidência existente | Parcela realmente pendente |
|---|---|---|---|
| P17 | F + H | CriarLote existente já usa flex-wrap; prévia desce; Painel tabela com rolagem. | Confirmar documentação derivada dessas regras sem mock extra; não inventar navegação mobile. |
| P22 | H + T | Dois temas no design; sem seletor; PRD dark mode “se der tempo”. | Incluir mecanismo, local e preferência inicial; persistência/evitar flash são T depois da escolha. |
| P23 | F + H + T | Vitrine busca substring case-insensitive em título+marca+ano, não remove acentos; lista fixa de marcas mock; sem sort/paginação. | Se manter comportamento ou mudar acentos, origem das marcas e ordenação. Não tratar ausência de paginação como autorização para inventar requisito. |
| P35 | F + H | Protótipo mobile coloca ficha antes do lance. | Só há decisão se mudar a fonte visual (subir painel/barra fixa); preservar ordem não precisa nova decisão. |
| P37 | F | DESIGN e protótipos exigem reflow com flex-wrap/clamp/auto-fit sem media queries de largura. | Nada a decidir: não criar breakpoints nomeados como requisito artificial. |
| P38 | H + T | PRD guarda UTC, UI usa pt-BR; não define fuso. | Fuso mostrado e segundos por contexto. Conversão UTC é T; fuso do ambiente do usuário não é automaticamente fuso do produto. |
| P40 | F + T | DESIGN já diz cartao-canhoto também usado em Arremates; aba de Acesso tem estilo próprio em “Outros”; chip cabeçalho decidido no memlog. | Harmonização de nomenclatura e divisão faixa-status/placar-posicao é trabalho documental, sem pedir nomes técnicos ao usuário. Não desfazer VOCÊ + papel. |

## Alertas para revisão posterior

- DESIGN ainda descreve identidade por pseudônimo no chip-saldo apesar da decisão VOCÊ + papel.
- DESIGN diz foto nunca; PRD exige imagem real com fallback. Resolver P25 antes de finalizar.
- Flow 1 da EXPERIENCE passa direto de 00:00 ao comprovante; precisa refletir P6 e confirmação do servidor.
- Auditoria do mock afirma descobrir valor original pelo hash (“corresponde a R$ 25.700”): hash não permite recuperar valor original. EXPERIENCE já suaviza no flow, mas revisar todo texto herdado.
- “Um único botão ocre por tela” pode conflitar com vários cards superados ou CTAs em Vitrine; revisar regra em contexto, sem gerar novo componente arbitrário.
- P36 deve separar decisão de confirmação da garantia técnica de não estornar um líder desatualizado.

## Recomendações autorizadas para fechamento

Autorização geral comunicada pelo agente principal após a triagem. As recomendações abaixo não são citações das fontes: são complementos mínimos de UX compatíveis com elas. O agente de consolidação pode adequar microcopy e nomes de componente sem mudar o comportamento.

| P | Recomendação adotável |
|---|---|
| P1 | Reutilizar Sala, ficha e histórico; “Este lote abre em DD/MM às HH:mm (Brasília)”; contagem até abertura; sem envio de lance antes do servidor confirmar ao vivo. |
| P2 | Reutilizar Sala com carimbo Cancelado, horário e link Auditoria; sem lance. Atualizar usuários presentes e saldo a partir do servidor; retirar da Vitrine. |
| P3 | Placa “LANCE INICIAL”, valor inicial; “Nenhum lance ainda”; líder ausente, contagem zero; primeiro mínimo = inicial. |
| P4 | Faixa neutra “Você ainda não deu lance”; formulário normal enquanto ao vivo. |
| P5 | Leiloeiro espectador, aviso “Leiloeiros não podem dar lances”; gestão/cancelamento continua no Painel, evitando ação extra na Sala. |
| P6 | Em 00:00 indisponibilizar lance e mostrar “Apurando o resultado”; comprovante/vencedor apenas após servidor. Atualizar estado sem afirmar prazo fixo de liquidação. |
| P7 | Link “Sair” junto à identidade no cabeçalho autenticado, acessível também no wrap mobile; após sair ir à Vitrine. |
| P8 | Após autenticar, retornar a destino interno permitido; sem intenção, licitante Vitrine e leiloeiro Painel. Visitante em rota privada vai a Acesso com retorno; papel errado recebe aviso com link ao destino permitido. Cadastro já autentica e segue mesma regra. |
| P9 | Diálogo único com estilos papel/borda/sombra do sistema, nome do lote, aviso do estorno, confirmar Cancelar lote em ocre (ação primária da camada ativa) e Voltar secundário; ferrugem reservado ao aviso; foco/Esc conforme EXPERIENCE. |
| P10 | Cancelados em seção do Painel e estado próprio em Meus arremates; link Auditoria; não classificar como Perdido nem expor na Vitrine. |
| P11 | Evento de cancelamento cronológico identificado à parte dos lances; mostrar horário, “Cancelado pelo leiloeiro” e liberação do compromisso quando aplicável. Não alterar lances nem contagem; veredito cobre cadeia de lances/selo/comprovante do PRD. Não afirmar proteção do evento pelo HMAC de lance sem contrato arquitetural específico. |
| P12 | Estado inline de não encontrado com título “Lote não encontrado” ou “Comprovante não encontrado” e Voltar à Vitrine; não expor token nem dados internos. |
| P13 | Erros junto aos campos, resumo/alerta se necessário; mínimo de senha 8 conforme design; nome/e-mail/senha/papel obrigatórios; preservar campos não sensíveis, envio único e estado “Entrando…”/“Criando conta…”. Sem recuperação de senha. |
| P14 | Obrigatórios FIPE selecionada/título/valores/datas; inicial e incremento inteiros positivos (mínimo R$ 1), início futuro, fim posterior; checar novamente no servidor. Imagem pode ser ilustração. Prévia acompanha dados; sucesso volta ao Painel com confirmação e lote agendado. Nenhum teto/duração extra inventado. |
| P15 | “Informe um valor inteiro entre R$ 1,00 e R$ 10.000.000,00.”; preservar valor editável e não atualizar saldo antes da resposta. |
| P16 | Carregamento e erro local com texto e Tentar novamente; preservar dados/formulário quando possível. Sala desconectada não envia novos lances até recarregar snapshot HTTP e restabelecer atualidade. Não reenviar lance automaticamente após falha ambígua. |
| P17 | Aplicar flex-wrap/auto-fit existentes; Criar lote empilha formulário e prévia; Painel mantém tabelas com rolagem interna rotulada. Sem telas novas. |
| P18 | Preservar número público legível do lote, atribuído pelo servidor só após criação; antes mostrar “Novo lote” e marcador de prévia. Recibo usa identificador próprio retornado pelo servidor; acesso continua token aleatório, nunca número sequencial. |
| P19 | Remover sugestão de estorno no encerramento; quando aplicável dizer “Seu saldo foi liberado quando seu lance foi superado”. Não mostrar mensagem de carteira a visitante. |
| P20 | Encerrado mostra “Lote fechado” indisponível e acesso à Auditoria/comprovante quando existente; remover convite para dar lance naquele lote. |
| P21 | Carimbo Sem lances, “Este lote encerrou sem lances”, sem vencedor/comprovante; Auditoria disponível. |
| P22 | Se entregar dark mode opcional, usar preferência do sistema inicialmente e controle Claro/Noite persistido localmente no cabeçalho; aplicar antes da pintura. Não transformar opcional do PRD em bloqueio de entrega. |
| P23 | Busca por título/marca/ano ignorando caixa e acentos; marcas derivadas dos lotes disponíveis; manter seções. Ordenação determinística: ao vivo pelo fim mais próximo, agendados pelo início, encerrados mais recentes; sem criar paginação para o seed pequeno. |
| P24 | Vazio global “O pátio está vazio. Nenhum lote publicado por enquanto.”; distinguir resultado vazio de filtro e fornecer Limpar filtros só neste último. |
| P25 | Exibir foto do snapshot nas áreas existentes, object-fit contain para não cortar carro, fundo do sistema; crédito próximo à foto/ficha e na prévia; falha/sem imagem usa SVG padrão. Não manter proibição “nunca foto” do DESIGN. |
| P26 | Vazio com zeros e “Nenhuma movimentação ainda”; distinguir visualmente “Saldo liberado · lance superado” e “Saldo liberado · lote cancelado”, explicando que total não muda. Não introduzir crédito fictício nem novo tipo de banco obrigatório; tipo estorno do PRD pode conter motivo. |
| P27 | Cinco resultados/estados de UX: Agendado, Ao vivo, Arrematado, Sem lances, Cancelado. Perdido é estado pessoal de quem participou de lote arrematado por outro, não novo estado do lote. |
| P28 | Manter microcopy FIPE do protótipo e preservação dos demais campos. |
| P29 | “Buscando imagem…” e “Não encontramos uma foto. Cole uma URL ou use a ilustração do pátio.”; falha da sugestão não invalida FIPE já selecionada. |
| P30 | Auditoria como retrato verificado com data/hora e botão Verificar de novo; não inserir lances ao vivo no meio de um veredito antigo. |
| P31 | Sem lances pode ser Íntegro somente após conferir estado inicial/contagem/selo; sem comprovante. Truncamento aponta inconsistência estrutural no resumo, nunca inventa linha ausente ou valor original. |
| P32 | Preservar sequência funcional do PRD, com autenticação/autorização seguras no back-end; formalizar precedência e códigos no contrato arquitetural. UX mostra motivo recebido. |
| P33 | Atualizar resumos e seções visíveis ao receber eventos e recarregar snapshot na reconexão/retorno à página; transporte compartilhado/refetch é detalhe técnico. Sem canal global complexo exigido pela UX. |
| P34 | Backend fornece código e motivo/contexto para distinguir mínimo desatualizado; cliente não deduz corrida apenas pelo código. Sem inventar segundo código obrigatório. |
| P35 | Preservar ordem mobile da fonte: ficha antes do painel; sem barra fixa nova. |
| P36 | Diálogo avisa que novos lances podem ocorrer até confirmação; atualizar contagem/valor quando evento chegar. Confirmação cancela estado atual atomicamente e estorna líder atual; se servidor já encerrou, recusar cancelamento e atualizar tela. Sem segundo diálogo. |
| P37 | Preservar layout fluido sem breakpoints nomeados obrigatórios. |
| P38 | Mostrar Brasília (America/Sao_Paulo) explicitamente em agendamento; persistência UTC. Horários de lance, auditoria e comprovante com segundos; agenda/listas com minutos; cronômetro permanece mm:ss. |
| P39 | Privado identifica usuário como VOCÊ; dentro de lote pode mostrar “Licitante XXXX · você”. Comprovante público mantém pseudônimo daquele lote e não depende de sessão. |
| P40 | Harmonizar documentação: faixa-status geral, placar-posicao para liderança/posição; chip-identidade VOCÊ + papel; cartao-canhoto cobre Arremates; abas-acesso próprias, não confundir tabs com filtros aria-pressed. |

