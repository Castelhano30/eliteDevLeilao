/**
 * Conteúdo do rodapé. O que ainda falta definir vem entre colchetes, para ser reconhecido de longe e achado por busca (`[`).
 * Quando uma rota existir (Sobre, Termos, Privacidade, Regras, Carteira), transforme o item em link em `site-footer.tsx`;
 * o layout não muda. Sem CNPJ nem endereço: o projeto não tem esses dados.
 */
export const RODAPE_CONTEUDO = {
  apresentacao: {
    titulo: "Sua próxima conquista começa com um lance.",
    texto: "Encontre oportunidades e participe de leilões de veículos de forma simples e transparente.",
  },
  colunas: {
    navegue: "Navegue",
    conta: "Sua conta",
    contato: "Contato",
  },
  /** Itens sem rota: texto puro, sem `href`. */
  navegueProvisorios: ["[Sobre o LanceAuto]"],
  contato: {
    email: { texto: "suporte@lanceauto.com", href: "mailto:suporte@lanceauto.com" },
    telefone: { texto: "(99) 9999-9999", href: "tel:9999999999" },
    horario: "08:00 às 22:00",
  },
  /** Ainda sem página: texto puro, sem `href`. */
  politicas: ["Termos de uso", "Política de privacidade", "Regras dos leilões", "Política da carteira"],
  /** Três espaços para redes sociais; viram links quando houver perfis reais. */
  redes: { quantidade: 3, rotulo: "Rede social [provisória]" },
  direitos: "© 2026 LanceAuto. Todos os direitos reservados.",
} as const;
