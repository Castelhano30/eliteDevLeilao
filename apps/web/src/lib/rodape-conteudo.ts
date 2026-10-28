/**
 * Conteúdo do rodapé: tudo aqui é provisório e vem entre colchetes, para ser reconhecido de longe e achado por busca (`[`).
 * Troque os textos, e quando uma rota existir (Sobre, Termos, Privacidade) transforme o item em link em `site-footer.tsx`;
 * o layout não muda. Nada de dado real inventado: sem CNPJ, endereço ou telefone.
 */
export const RODAPE_CONTEUDO = {
  apresentacao: "[Frase de apresentação provisória: uma linha sobre o LanceAuto.]",
  colunas: {
    navegue: "Navegue",
    conta: "Sua conta",
    contato: "Contato",
  },
  /** Itens sem rota: texto puro, sem `href`. */
  navegueProvisorios: ["[Sobre o LanceAuto]", "[Termos de uso]"],
  contatoProvisorios: ["[E-mail de contato]", "[Telefone]", "[Horário de atendimento]"],
  /** Três espaços para redes sociais; viram links quando houver perfis reais. */
  redes: { quantidade: 3, rotulo: "Rede social [provisória]" },
  avisosLegais: "[Espaço para avisos legais: termos, privacidade e aviso de saldo simulado.]",
  direitos: "© [ano] LanceAuto · [Texto de direitos provisório]",
} as const;
