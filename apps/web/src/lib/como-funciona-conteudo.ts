/**
 * Texto da página "Como Funciona". Cada frase vem das regras da SPEC (lote e cronômetro, lance, prorrogação, fechamento e
 * comprovante); nada foi acrescentado. Exatamente três passos, na ordem em que o leilão acontece.
 */
export interface ImagemPasso {
  /** Caminho em `public/`: print do próprio site. */
  src: string;
  alt: string;
  /** Tamanho real do arquivo, para o navegador reservar o espaço antes de carregar. */
  largura: number;
  altura: number;
  /** O que olhar na imagem. */
  legenda: string;
  /** Largura máxima em px quando a imagem é alta e estreita. */
  larguraMaxima?: number;
  /** `abaixo`: imagem larga, ocupa a largura do cartão sob o texto. `ao-lado`: imagem alta, divide a linha com o texto (no celular sempre desce). */
  disposicao: "abaixo" | "ao-lado";
}

export interface PassoComoFunciona {
  numero: string;
  titulo: string;
  resumo: string;
  pontos: readonly string[];
  imagem: ImagemPasso;
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
      imagem: {
        src: "/como-funciona/passo-1-vitrine.png",
        alt: "Vitrine do LanceAuto com três lotes ao vivo. Cada cartão mostra o número do lote, o carro, o lance atual, a quantidade de lances e o cronômetro com o tempo que resta.",
        largura: 2356,
        altura: 1122,
        legenda: "Na vitrine, cada cartão mostra o lance atual, quantos lances já foram dados e o cronômetro do lote.",
        disposicao: "abaixo",
      },
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
      imagem: {
        src: "/como-funciona/passo-2-sala.png",
        alt: "Painel da sala de um lote ao vivo: cronômetro, lance atual, o aviso Você está ganhando com a posição 1º de 2, o campo de lance com o mínimo aceito e o histórico de lances.",
        largura: 1120,
        altura: 1942,
        legenda: "Na sala do lote: o aviso de quem está ganhando, o mínimo aceito para o próximo lance e o histórico de todos os lances.",
        larguraMaxima: 420,
        disposicao: "ao-lado",
      },
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
      imagem: {
        src: "/como-funciona/passo-3-comprovante.png",
        alt: "Comprovante de arremate com o número do lote, o carro, o valor, o arrematante identificado por pseudônimo, o código de verificação e o número do comprovante.",
        largura: 1268,
        altura: 1368,
        legenda: "O comprovante traz o lote, o valor, o arrematante por pseudônimo e o código que pode ser conferido na auditoria.",
        larguraMaxima: 520,
        disposicao: "ao-lado",
      },
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
