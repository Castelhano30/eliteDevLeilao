/**
 * Texto da página "Como Funciona". Cada frase vem das regras da SPEC (lote e cronômetro, lance, prorrogação, fechamento e
 * comprovante); nada foi acrescentado. Exatamente três passos, na ordem em que o leilão acontece.
 */
export interface PassoComoFunciona {
  numero: string;
  titulo: string;
  resumo: string;
  pontos: readonly string[];
}

export const COMO_FUNCIONA = {
  titulo: "Como Funciona",
  introducao: "Do lote ao comprovante, em três passos.",
  passos: [
    {
      numero: "01",
      titulo: "O leilão",
      resumo: "Cada lote é um carro com lance inicial, incremento, abertura e encerramento definidos pelo leiloeiro.",
      pontos: [
        "Lote agendado pode ser visto antes de abrir. Os lances começam só na abertura.",
        "O cronômetro mostra o tempo que falta para abrir ou para encerrar, pelo relógio do servidor. É o mesmo para todos.",
        "Ver a vitrine e as salas não pede conta. Para dar lances, entre como licitante.",
      ],
    },
    {
      numero: "02",
      titulo: "Os lances",
      resumo: "O primeiro lance parte do lance inicial. Os seguintes precisam cobrir o lance atual mais o incremento do lote.",
      pontos: [
        "O valor do seu lance fica reservado no saldo enquanto você lidera. Se alguém cobrir, ele volta para o disponível.",
        "Lance nos últimos 2 minutos leva o encerramento para 2 minutos depois dele. Não há limite de prorrogações.",
        "A sala mostra ao vivo se você está ganhando ou foi superado, e a sua posição entre os licitantes.",
      ],
    },
    {
      numero: "03",
      titulo: "Arremate e comprovante",
      resumo: "Ao fim do prazo, o lote é apurado uma única vez pelo servidor. Maior lance leva.",
      pontos: [
        "O valor é debitado do saldo do vencedor e creditado ao leiloeiro. Lote sem lances fecha sem vencedor.",
        "O vencedor recebe um comprovante com link próprio, que abre sem login e sem mostrar nome ou e-mail.",
        "O histórico de lances de cada lote pode ser conferido por qualquer pessoa, na auditoria.",
      ],
    },
  ],
  chamada: {
    titulo: "Pronto para o primeiro lance?",
    texto: "Veja os lotes que estão ao vivo e os que abrem em breve.",
    botao: "Ver os lotes",
    href: "/",
  },
} as const satisfies {
  titulo: string;
  introducao: string;
  passos: readonly PassoComoFunciona[];
  chamada: { titulo: string; texto: string; botao: string; href: string };
};
