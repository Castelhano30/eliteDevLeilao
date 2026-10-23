"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { IdentityChip } from "@/components/ui/identity-chip";
import { Logo } from "@/components/ui/logo";
import { LotTag } from "@/components/ui/lot-tag";
import { PageShell } from "@/components/ui/page-shell";
import { Perforation } from "@/components/ui/perforation";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { Stamp } from "@/components/ui/stamp";
import { ThemeSwitch } from "@/components/ui/theme-switch";

type Movimento = { id: string; tipo: string; valor: string };

const MOVIMENTOS: Movimento[] = [
  { id: "1", tipo: "Depósito", valor: "R$ 31.000,00" },
  { id: "2", tipo: "Lance", valor: "R$ 28.500,00" },
  { id: "3", tipo: "Liberação", valor: "R$ 28.500,00" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="t-display-secao mb-6">{title}</h2>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </section>
  );
}

type Filtro = "todos" | "ao-vivo" | "encerrados";

/** Todos os primitivos e variantes. Troque o tema aqui em cima e confira os dois. */
export function KitDemo() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [valor, setValor] = useState("500");

  return (
    <PageShell title="Kit">
      <div className="flex flex-wrap items-center gap-6">
        <ThemeSwitch />
        <p className="t-body-nota">Alterne o tema e navegue só com o teclado para conferir o foco.</p>
      </div>

      <Section title="Logo">
        <Logo />
        <Logo size="manual" />
      </Section>

      <Section title="Button">
        <Button variant="primario">Dar lance</Button>
        <Button variant="secundario">Voltar</Button>
        <Button variant="secundario" destrutivo>
          Cancelar lote
        </Button>
        <Button variant="desabilitado">Indisponível</Button>
        <Button variant="atalho">+ R$ 500</Button>
        <Button variant="primario" loading loadingText="Enviando…">
          Dar lance
        </Button>
      </Section>

      <Section title="Field">
        <Field label="E-mail" help="Usado só para entrar." placeholder="voce@exemplo.com" className="w-full max-w-sm" />
        <Field label="Senha" type="password" error="A senha precisa de 8 caracteres." defaultValue="abc" className="w-full max-w-sm" />
        <Field label="Apelido" disabled defaultValue="Não editável" className="w-full max-w-sm" />
        <Field
          label="Valor do lance"
          prefix="R$"
          suffix=",00"
          inputMode="numeric"
          value={valor}
          mask={(raw) => raw.replace(/\D/g, "")}
          onChange={(event) => setValor(event.target.value)}
          className="w-full max-w-sm"
        />
      </Section>

      <Section title="RefusalMessage">
        <RefusalMessage className="max-w-md">O lance precisa ser maior que o atual.</RefusalMessage>
        <RefusalMessage className="max-w-md" action={{ href: "#", label: "Depositar na carteira →" }}>
          Saldo insuficiente para este lance.
        </RefusalMessage>
      </Section>

      <Section title="FeedbackState">
        <FeedbackState variant="carregando" className="w-full max-w-sm" />
        <FeedbackState variant="vazio" className="w-full max-w-sm">
          Nenhum lote por aqui ainda.
        </FeedbackState>
        <FeedbackState variant="erro" onRetry={() => undefined} className="w-full max-w-sm">
          Não deu para carregar.
        </FeedbackState>
      </Section>

      <Section title="Stamp">
        <Stamp variant="ao-vivo" />
        <Stamp variant="arrematado" />
        <Stamp variant="sem-lances" />
        <Stamp variant="integro" />
        <Stamp variant="adulterado" />
        <Stamp variant="cancelado" />
        <Stamp variant="arrematado" animate />
      </Section>

      <Section title="LotTag">
        <div className="pl-6 pt-8">
          <LotTag number={18} />
        </div>
        <div className="pl-6 pt-8">
          <LotTag number={7} tone="papel" />
        </div>
      </Section>

      <section className="mt-12">
        <h2 className="t-display-secao mb-6">Perforation</h2>
        <Perforation />
      </section>

      <section className="mt-12">
        <h2 className="t-display-secao mb-6">DataTable</h2>
        <DataTable
          caption="Extrato da carteira"
          columns={[
            { key: "tipo", header: "Movimento", render: (row: Movimento) => <span className="t-cartaz-subtitulo">{row.tipo}</span> },
            { key: "valor", header: "Valor", align: "right", render: (row: Movimento) => row.valor },
          ]}
          rows={MOVIMENTOS}
          rowKey={(row) => row.id}
        />
      </section>

      <Section title="FilterTabs">
        <FilterTabs
          label="Filtrar lotes"
          value={filtro}
          onChange={setFiltro}
          tabs={[
            { value: "todos", label: "Todos", count: 12 },
            { value: "ao-vivo", label: "Ao vivo", count: 3 },
            { value: "encerrados", label: "Encerrados" },
          ]}
        />
      </Section>

      <Section title="IdentityChip">
        <IdentityChip role="licitante" />
        <IdentityChip role="leiloeiro" />
      </Section>

      <Section title="Dialog">
        <Button variant="secundario" onClick={() => setDialogAberto(true)}>
          Abrir diálogo
        </Button>
        <Dialog
          open={dialogAberto}
          onClose={() => setDialogAberto(false)}
          title="Confirmar lance"
          confirm={{ label: "Confirmar", onConfirm: () => setDialogAberto(false) }}
        >
          <p>Você vai dar um lance de R$ 28.500,00 neste lote.</p>
        </Dialog>
      </Section>
    </PageShell>
  );
}
