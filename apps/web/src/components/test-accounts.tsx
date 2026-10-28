"use client";

import type { Role } from "@lanceauto/shared";
import { ROLE_LABEL } from "@lanceauto/shared";
import { Notice } from "@/components/ui/notice";

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
      <Notice kind="info" role="none">
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
                className={`relative block w-full min-h-alvo rounded-xl border bg-papel px-4 py-3 text-left text-tinta hover:border-tinta2 ${
                  selected ? "border-ocre" : "border-borda"
                }`}
              >
                {selected ? (
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-3 text-ocreTexto">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12.5 3 3 5-6" />
                  </svg>
                ) : null}
                <span className="block pr-8 text-[16px] font-extrabold leading-tight">{`${ROLE_LABEL[account.role]} · ${account.name}`}</span>
                <span className="t-mono-dado block text-tinta2">{account.email}</span>
              </button>
            </li>
          );
        })}
      </ul>
      </Notice>
    </section>
  );
}
