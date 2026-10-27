/** Estados globais da aplicação (S09 §8): rota inexistente e erro inesperado. */
export const GLOBAL_TEXT = {
  notFoundTitle: "Página não encontrada",
  notFoundBody: "Essa página não existe, ou já foi para a gaveta.",
  errorTitle: "Algo travou no pátio.",
  errorBody: "Foi um erro do nosso lado. Tente de novo; se persistir, volte à vitrine.",
  backToShowcase: "Voltar à vitrine",
  /** Erro de carga de qualquer tela com dados (§8); o botão "Tentar novamente" vem do FeedbackState. */
  loadError: "Não deu para carregar agora.",
  /** Falha ao atualizar com dados anteriores na tela: o que está embaixo ficou velho. */
  staleError: "Não deu para atualizar agora. Os dados abaixo estão desatualizados.",
} as const;
