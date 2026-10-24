# Trabalho adiado

- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar o `useOnReach` (dispara uma vez ao cruzar o alvo, não dispara se o alvo já passou, rearma quando o alvo muda).
  evidence: Nenhum teste cobre o hook; exige extrair a lógica para função pura. AC-2.44 é manual; S03/S04 mexem nesse fluxo.
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Testar `POST /lots` de leiloeiro apagado (P2003/P2025 → 401) e o `readFixtureImage` do seed com uma imagem real.
  evidence: Nenhum teste contém P2003/P2025; o fixture atual tem `image: null` em todos os carros (fotos do seed só na S09).
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Logar em `warn` o motivo (429, 401/403) quando a FIPE falha, antes de virar 503.
  evidence: `read()` em `infra/fipe.ts` mapeia tudo para `fipeUnavailable()` sem log; a cota esgotada não aparece em produção.
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Limitar `POST /lots` por usuário, como o `/catalog`.
  evidence: Cada POST pode baixar até 4 MB e gravar em BYTEA; só leiloeiro chama e a fatia não pede limite.
- source_spec: `_bmad-output/implementation-artifacts/spec-s02-catalogo-lotes-vitrine.md`
  summary: Tirar da produção o lote 003 criado pelo smoke da S02.
  evidence: Aparece em Agendados e abre sozinho em 28/10; o cancelamento só existe na S06 e o seed final (S09) recria os lotes.
