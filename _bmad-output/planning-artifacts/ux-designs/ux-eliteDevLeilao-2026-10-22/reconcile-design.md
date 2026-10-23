# Reconciliação — protótipos design/project

Data: 22/10/2026. Fonte visual: `../../design/project/`, protótipos Claude Design Rev. 03. Evidência detalhada em `.working/extract-tokens.md`, `.working/extract-screens-1.md` e `.working/extract-screens-2.md`; decisões de complemento na matriz `.working/triagem-p1-p40.md`.

Estado: reconciliação de entrada concluída; verificação final contra DESIGN.md e EXPERIENCE.md será feita no Reviewer Gate após a consolidação. Não houve revisão prematura das spines em mutação.

## Identidade e ideias qualitativas preservadas

| Ideia de origem | Preservação esperada |
|---|---|
| “Manual de pátio”, casa de leilões com humor seco | Marca LanceAuto, voz curta pt-BR; dinheiro e fatos sempre claros |
| Cartaz, papel, tinta, ocre, verde e ferrugem | Mesmas famílias cromáticas e temas; nenhuma direção visual nova |
| Big Shoulders, Newsreader e IBM Plex Mono | Hierarquia cartaz/corpo/dados; números verificáveis e hashes mono |
| Bordas grossas, sombra dura e cantos retos | Sistema de elevação e geometria; sem blur, gradiente ou efeito de vidro |
| Etiqueta de lote pendurada, carimbo, picote e recibo | Componentes característicos preservados com função e semântica |
| Placa de lance e cronômetro LED | Mesmo destaque para valor e prazo; animação não essencial à informação |
| Humor sem esconder motivo da recusa | Textos existentes preservados quando compatíveis; faltantes usam mesma voz |
| Layout fluido e referências 1440/390 | Reflow por flex-wrap/auto-fit/clamp; sem introduzir breakpoint obrigatório |
| Temas claro/noite | Tokens existentes preservados; mecanismo de preferência é complemento, recurso segue opcional |
| Sala pública, comprovante e auditoria acessíveis | Fluxos existentes preservados; identidade real nunca exposta |

## Cobertura das superfícies de origem

Vitrine, Acesso, Sala, Carteira, Meus arremates, Comprovante, Painel do leiloeiro, Criar lote e Auditoria continuam sendo as nove superfícies base. Abas de cadastro/login pertencem à mesma superfície.

As referências mobile existentes cobrem Vitrine, Acesso, Sala, Carteira, Meus arremates, Comprovante e Auditoria. Painel e Criar lote não têm variante mobile desenhada: a consolidação deve declarar construção pelas regras fluidas da spine. Estados novos de carregamento, falha, cancelamento, zero lances, apuração e acesso indevido reutilizam as superfícies existentes; não são novas telas de produto autônomas.

## Divergências intencionalmente substituídas

| Mock/importação | Substituição e razão |
|---|---|
| Pseudônimo fixo reaparece entre lotes; chip de usuário com código | Pseudônimo por lote; cabeçalho VOCÊ + papel. PRD e decisão explícita |
| “Lote com lance não se cancela” | Cancelamento com estorno e confirmação. PRD opcional já escolhido |
| SHA-256 público e promessa de calculadora | HMAC-SHA256 verificado no servidor; decisão explícita |
| Somar 120 segundos ao fim anterior | Novo fim = instante do lance + dois minutos; PRD |
| Incremento hardcoded R$ 500 | Incremento por lote; atalhos visuais preservados conforme decisão registrada |
| Token curto de comprovante | Token aleatório; número legível separado da autorização de acesso |
| Carteira sem limite de depósito | R$ 10 milhões por depósito; PRD |
| Ilustração em todo lugar, mesmo quando URL de foto existe | Foto do snapshot e crédito, fallback SVG; exigência funcional de imagem real |
| Links de vários lotes sempre para 018 | Destino do lote correto; corrigir placeholder sem alterar direção visual |
| Datas/número/título da prévia fixos | Prévia reflete formulário; número só após atribuição do servidor |
| Chamada para lance num lote fechado | Estado indisponível coerente; manual já prevê “Lote fechado” |
| Estorno apresentado como ocorrido no encerramento | Liberação acontece ao ser superado; preservar a clareza de total versus disponível |
| Auditoria deduz valor original adulterado pelo hash | Descrever inconsistência verificável, sem recuperação criptográfica impossível |

## Complementos mínimos autorizados

Aplicar o sistema existente aos estados ausentes: vazio global, erro de campo, enviando, erro de rede, reconexão, agendado/cancelado/sem lances na Sala, espera de liquidação, confirmação de cancelamento e foto indisponível. Preservar ficha antes do painel no mobile; não criar barra fixa de lance nem ação extra de gestão na Sala.

Foco visível, labels, navegação de tabs, contraste, regiões de anúncio e reduced-motion podem ser corrigidos como requisitos de acessibilidade, mantendo a linguagem visual. Ajustes de contraste devem ser documentados como variantes funcionais derivadas dos tokens, não mudança de marca silenciosa.

Nenhuma ideia visual qualitativa foi descartada gratuitamente. As remoções listadas decorrem de regras funcionais, privacidade, correção de placeholders ou precisão da explicação. O que estava somente implícito deve permanecer identificado como complementação autorizada, nunca atribuído retroativamente ao mock.

## Verificação final programada

Conferir cobertura das nove superfícies, tokens usados em EXPERIENCE, consistência chip/faixa/placar/abas, referências relativas aos protótipos, status mocked versus spine-only e todos os overrides acima. Só depois dessa checagem a reconciliação poderá ser considerada verificada contra a saída final.
