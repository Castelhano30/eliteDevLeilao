/** As cores apontam para variáveis CSS: o tema (claro/noite) troca só as variáveis. */
/** @type {import("tailwindcss").Config} */
const config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fundo: "var(--c-fundo)",
        papel: "var(--c-papel)",
        suave: "var(--c-suave)",
        pontos: "var(--c-pontos)",
        tinta: "var(--c-tinta)",
        tinta2: "var(--c-tinta2)",
        linha: "var(--c-linha)",
        sombra: "var(--c-sombra)",
        tracejado: "var(--c-tracejado)",
        ocre: "var(--c-ocre)",
        sobreOcre: "var(--c-sobre-ocre)",
        ferrugem: "var(--c-ferrugem)",
        verde: "var(--c-verde)",
        sobreCor: "var(--c-sobre-cor)",
        painel: "var(--c-painel)",
        led: "var(--c-led)",
        ledAlerta: "var(--c-led-alerta)",
        falha: "var(--c-falha)",
        // Literais fixos: não acompanham o tema.
        faixaPlaca: "var(--f-faixa-placa)",
        brasilTexto: "var(--f-brasil-texto)",
        digitoPlaca: "var(--f-digito-placa)",
        linhaCentralPlaca: "var(--f-linha-central-placa)",
        rotuloRelogio: "var(--f-rotulo-relogio)",
        rotuloNotaPainel: "var(--f-rotulo-nota-painel)",
      },
      borderRadius: {
        nenhum: "0",
        placa: "3px",
        "logo-interno": "6px",
        "logo-tela": "7px",
        logo: "10px",
        circulo: "50%",
      },
      boxShadow: {
        cartao: "3px 3px 0 var(--c-sombra)",
        botao: "3px 3px 0 var(--c-sombra)",
        "botao-ativo": "2px 2px 0 var(--c-sombra)",
        chip: "2px 2px 0 var(--c-sombra)",
        painel: "4px 4px 0 var(--c-sombra)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)"],
      },
      maxWidth: {
        container: "1320px",
        comprovante: "1200px",
        manual: "1440px",
      },
      minWidth: {
        alvo: "44px",
      },
      minHeight: {
        alvo: "44px",
        botao: "44px",
      },
    },
  },
};

export default config;
