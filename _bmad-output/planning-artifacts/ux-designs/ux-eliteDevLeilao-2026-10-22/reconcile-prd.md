# Reconciliação — PRD markdown

Data: 22/10/2026. Fonte funcional: `../../PRD — Plataforma de Leilão de Carros (Teste Técnico).md`. PDF excluído por instrução explícita: versão antiga. Evidência de leitura detalhada em `.working/extract-prd.md`; triagem em `.working/triagem-p1-p40.md`.

Estado: reconciliação de entrada concluída; verificação final contra DESIGN.md e EXPERIENCE.md será feita no Reviewer Gate após a consolidação. Este registro não afirma que rascunhos em mutação já passaram na revisão.

## Escopo funcional preservado

| Entrada | Destino esperado nas spines |
|---|---|
| Casa de leilões online de carros, saldo simulado, papéis exclusivos | Foundation, acesso e navegação por papel; sem pagamento real nem troca de papel |
| Vitrine pública, Sala pública, Cadastro/Login | Information Architecture e estados das superfícies existentes |
| Carteira, Meus arremates, Comprovante público | Saldos total/comprometido/disponível, depósito, acompanhamento e recibo compartilhável |
| Painel leiloeiro, criar lote via FIPE | Lotes próprios por status, resultados, total recebido; criação separada como no protótipo |
| Auditoria pública | Histórico completo com pseudônimos, veredito de integridade e primeira falha localizável |
| Servidor como única fonte de tempo/saldo/valores | Nenhuma aceitação ou vitória otimista; recarga autoritativa após reconexão |
| Primeiro lance ≥ inicial; seguintes ≥ atual + incremento; líder não cobre a si mesmo | Campo e atalhos compatíveis; motivos de recusa; incremento por lote |
| Só licitante; só ao vivo; saldo suficiente | Estados de acesso e recusas do PRD, checados no servidor |
| Liberação imediata do compromisso ao ser superado | Nenhum texto que adie liberação para o encerramento; total não muda na liberação |
| Anti-sniping = horário do lance + dois minutos | Cronômetro e explicação; não somar dois minutos ao prazo anterior |
| Liquidação única, vencedor e comprovante; sem lances sem vencedor | Estado “Apurando” antes da confirmação e resultados finais distintos |
| Cancelamento com lances, estorno e histórico (opcional escolhido) | Confirmação, estado Cancelado, desaparecimento da Vitrine e acesso à auditoria |
| Snapshot FIPE e imagem; APIs externas só na criação | Queda externa preserva consulta pública; foto, crédito e fallback ilustrado |
| HMAC-SHA256 com chave no servidor e selo/contagem | Verificação servidora; não prometer cálculo público autônomo nem recuperar valor original pelo hash |
| Pseudônimo por lote, token aleatório de comprovante | Sem nome/e-mail públicos; código legível de lote não substitui token |
| Dinheiro em centavos, datas UTC | UI em reais inteiros por decisão registrada; horário de Brasília é apresentação |

## Ideias qualitativas mantidas

- Confiança vem de números claros e auditoria, não de promessa genérica de segurança absoluta.
- A disputa funciona sem recarregar; atrasos de confirmação e conexão são comunicados sem inventar resultado.
- Saldo simulado é explícito. A liberação do compromisso não aparece como dinheiro novo no saldo total.
- Quem avalia deve conseguir explorar todos os estados e auditar sem depender da FIPE online.
- A experiência tem prazo de teste técnico de sete dias; os complementos fecham estados das nove superfícies, sem inventar produto paralelo.

## Limites e complementos autorizados

P1–P40 recebem recomendações autorizadas pelo usuário desde que compatíveis com o PRD. São especificações de UX complementares: abertura/encerramento/cancelamento na Sala, vazios/erros, destino de autenticação, feedback de formulário, fuso mostrado e estado de conexão.

Dark mode mantém a natureza opcional “se der tempo” do PRD. Busca/filtros e cancelamento com estorno já estavam escolhidos. Não foram introduzidos chat, notificações por e-mail, lance automático, preço de reserva, edição de lote agendado, recuperação de senha, saque, pagamento real ou aplicativo nativo.

O PRD anuncia oito telas mas enumera funções que o protótipo separa em nove; a IA deve explicitar essa normalização, sem esconder ou eliminar Criar lote. A menção a cinco estados corresponde a Agendado, Ao vivo, Cancelado e os dois resultados encerrados (Arrematado/Sem lances); Perdido é situação pessoal do licitante.

Contratos de transporte, concorrência, precedência de validação e formato do evento de cancelamento pertencem à implementação/arquitetura. A UX exige resultados corretos e não afirma que o selo de lances do PRD protege metadados novos sem contrato específico.

## Verificação final programada

Conferir as linhas acima contra as spines estabilizadas; procurar especialmente texto residual de proibição de cancelar com lances, pseudônimo global, estorno no instante errado, anti-sniping incorreto, comprovante precoce e promessa criptográfica além do PRD. Nenhuma ideia qualitativa funcional foi intencionalmente descartada nesta reconciliação de entrada.
