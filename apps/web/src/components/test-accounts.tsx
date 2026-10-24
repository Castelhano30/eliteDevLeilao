"use client";

import type { Role } from "@lanceauto/shared";
import { ROLE_LABEL } from "@lanceauto/shared";

const TEST_PASSWORD = "lance1234";

/** As contas que `npm run seed` cria (apps/api/prisma/seed.ts). */
const ACCOUNTS: { name: string; email: string; role: Role }[] = [
  { name: "João Pátio", email: "leiloeiro@lanceauto.test", role: "AUCTIONEER" },
  { name: "Ana Souza", email: "ana@lanceauto.test", role: "BIDDER" },
  { name: "Bruno Lima", email: "bruno@lanceauto.test", role: "BIDDER" },
];

export interface TestAccountsProps {
  /** E-mail hoje no formulário: marca a conta escolhida. */
  email: string;
  onPick: (credentials: { email: string; password: string }) => void;
}

/** Atalho de avaliação: um toque numa conta de teste preenche o e-mail e a senha do login. */
export function TestAccounts({ email, onPick }: TestAccountsProps) {
  return (
    <section aria-labelledby="titulo-contas-teste" className="mt-10">
      <h2 id="titulo-contas-teste" className="t-mono-rotulo mb-2">
        Contas de teste
      </h2>
      <p className="t-body-nota mb-3">Escolha uma para preencher o e-mail e a senha.</p>
      <ul className="grid gap-3">
        {ACCOUNTS.map((account) => {
          const selected = email === account.email;
          return (
            <li key={account.email}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onPick({ email: account.email, password: TEST_PASSWORD })}
                className={`block w-full min-h-alvo rounded-nenhum border-[3px] border-linha px-4 py-3 text-left focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-tinta ${
                  selected ? "bg-ocre text-sobreOcre shadow-botao" : "bg-papel text-tinta"
                }`}
              >
                <span className="t-cartaz-subtitulo block">{`${ROLE_LABEL[account.role]} · ${account.name}`}</span>
                <span className={`t-mono-dado block ${selected ? "!text-sobreOcre" : ""}`}>{account.email}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
