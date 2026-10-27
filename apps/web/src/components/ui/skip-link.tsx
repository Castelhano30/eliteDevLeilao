import { buttonClasses } from "./button";

/** Primeiro elemento focável da página: fica oculto até receber foco. */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className={`${buttonClasses("secundario")} sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-papel focus:shadow-painel`}
    >
      Pular para o conteúdo
    </a>
  );
}
