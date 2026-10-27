# Rascunho do relato de uso de IA (D10)

> Rascunho montado só com fatos registrados no `progresso.md` (os números dos itens do diário estão entre parênteses). O que o diário não traz está marcado **[Felipe]** para você completar ou apagar. Nada aqui foi inventado: se um trecho não bate com o que você lembra, o diário é a fonte e a correção é sua.

## Onde e como usei IA

Usei IA em todas as etapas, com revisão e decisão minhas em cada uma. Ferramentas: **Claude** (PRD e pesquisa de APIs), **Claude Design** (design) e **BMad com Claude Code** (planejamento e implementação).

**1. PRD e pesquisa de APIs (Claude).** O PRD saiu de uma conversa com o Claude, com revisão e ajustes meus. Havia duas versões do PRD (um PDF antigo de marketplace e o `.md` da Casa de Leilões); reconciliei e fiquei com o `.md` como fonte única (itens 3 e 4). As decisões de produto foram minhas: prorrogação = horário do lance + 2 minutos, posição pelo maior lance de cada licitante, cancelamento com lances faz estorno, sem edição de lote agendado, depósito máximo de R$ 10 milhões, imagem da Wikipedia editável (item 5).

**2. Design (Claude Design).** Importei 29 arquivos do Claude Design (9 telas, com variações claro, noite e celular) como referência visual (item 2).

**3. Planejamento (BMad com Claude Code).** Seguiu o fluxo do BMad: UX (`DESIGN.md` e `EXPERIENCE.md`, com 40 perguntas abertas que triei por recomendação), arquitetura (13 decisões, contratos REST e Socket.IO, formato da cadeia HMAC), e uma SPEC com 131 requisitos do PRD rastreados em 10 fatias de build (itens 7 a 9). Onde o UX divergia do PRD, o PRD venceu (por exemplo, pseudônimo por lote e cancelamento com estorno). Aceitei UX e arquitetura como rascunho, sem o gate de revisão, por agilidade (itens 7 e 8). **O que revisei e mudou:** a SPEC passou por cinco revisores independentes que leram as dez fatias contra o PRD e a arquitetura e acharam cerca de 80 pontos; entre os mais graves, uma consulta SQL que falharia no Postgres, o token do comprovante exposto na auditoria pública, um seed que violava a regra de datas e um SSRF incompleto no download de imagem. Tudo foi corrigido nas fatias antes de construir (item 10).

**4. Implementação (BMad com Claude Code).** Uma fatia por vez (S00 a S09), cada uma com um spec de build, testes e conferência. Os commits são atômicos, em português, no meu nome. Práticas que adotei com a IA, todas registradas no diário:
- **Teste que pega o defeito:** rodei mutações de propósito (tirar uma linha de código e ver o teste falhar) para provar que os testes não passam à toa.
- **Revisão de código em camadas:** revisores em paralelo (leitura cega, casos de borda, lacunas de verificação, auditoria de aceitação) leram os diffs das S03 e S04 e das fatias seguintes; cada achado foi conferido no código antes de virar correção (itens 56, 57 e 64).
- **Conferência em Chrome real:** roteiros com o Chrome instalado, com banco descartável, API e web locais, dois ou mais clientes e queda de rede, além do smoke no link público.
- **Decisões que mudaram o que a IA propôs:** o cartão Encerrado da Vitrine abre a Sala (e não a auditoria direta), a pedido meu depois de ver a Vitrine (item 89); a decisão de não mostrar "Acordando o pátio…" e de não criar um `seed:demo --relampago` na S09 também foi minha.
- **O que conferi eu mesmo:** leitor de tela e dois aparelhos reais na Sala, Comprovante e Carteira das S03 a S05 (item 74, relato meu). **[Felipe: completar o que conferiu da S06 em diante e da S09: NVDA, aparelho real a 390 px.]**
- **Uso de IA no relato e na entrega:** este rascunho foi montado a partir do diário. **[Felipe: revisar e assumir o texto.]**

**5. O que a IA errou e eu corrigi (exemplos do diário).** O Prisma 8 era RC e o 7 retira `url`/`directUrl` do schema, então fixei o 6.19.3 (item 11); o PowerShell 5.1 gravou BOM e corrompeu acentos em três arquivos, corrigido com `.gitattributes` (item 16); um smoke de produção na S06 deixou lotes de teste porque o relógio da minha máquina está ~32 s adiantado em relação ao servidor, e passei a calcular as datas a partir do `serverTime` da API. **[Felipe: acrescentar outros casos que você lembra.]**

## Estar pronto para explicar o código

Pontos que sei explicar sem a IA: a transação do lance (lock do lote antes das carteiras por `userId`, relógio lido depois do lock, eventos só depois do commit); a prorrogação; a liquidação única com `SKIP LOCKED`; a cadeia HMAC-SHA256 (genesis, linha, selo) e por que um SHA-256 simples não bastaria; o pseudônimo por lote; o cache de 24 h da FIPE e o uso de cache vencido. **[Felipe: conferir se consegue defender cada ponto antes de enviar.]**
