import type { Metadata } from "next";
import Link from "next/link";
import { StagePassage, type Stage } from "@/components/motion/stage-passage";
import { ScreenHeader } from "@/components/shell/app-shell";
import { DemoBadge } from "@/components/ui/demo-badge";

export const metadata: Metadata = { title: "Protótipos" };

const STAGES: Stage[] = [
  { id: "leitura", number: "01", title: "Leitura", body: "Etapa demonstrativa. Em uso real, a passagem marca a entrada num bloco ou módulo — nunca a troca de alternativa." },
  { id: "raiox", number: "02", title: "Raio-X", body: "A folha cobre a tela, a etapa troca no ponto de cobertura e o título permanece no mesmo lugar." },
  { id: "revisao", number: "03", title: "Revisão", body: "Interrompa no meio: a tela termina sempre na etapa de destino, utilizável e com foco no título." },
];

const FLOWS = [
  { href: "/hoje", label: "Hoje → foco → histórico", id: "F1-T17" },
  { href: "/estudar", label: "Questão → Raio-X (scanner M01)", id: "F1-T18" },
  { href: "/redacao", label: "Correção: troca de competência e traço M04", id: "F1-T06 · F1-T18" },
];

export default function PrototiposPage() {
  return (
    <>
      <ScreenHeader title="Protótipos de movimento" kicker="F1 · direção dos momentos principais">
        <DemoBadge>Conteúdo demonstrativo</DemoBadge>
      </ScreenHeader>

      <section aria-labelledby="flows" className="mb-10">
        <h2 id="flows" className="mb-3 t-section">Coreografias contextuais</h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {FLOWS.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className="flex h-full flex-col rounded-card border border-line-subtle bg-surface p-4 hover:border-line">
                <span className="t-ui">{f.label}</span>
                <span className="mt-1 t-meta text-ink-2">{f.id}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="passage">
        <h2 id="passage" className="mb-1 t-section">Passagem entre etapas</h2>
        <p className="mb-4 t-meta text-ink-2">F1-T11 · até 700 ms · folha azul com título em continuidade</p>
        <StagePassage stages={STAGES} />
      </section>

      <section aria-labelledby="pending" className="mt-10 max-w-2xl">
        <h2 id="pending" className="mb-2 t-section">Ainda por fazer nesta trilha</h2>
        <ul className="list-disc pl-5 t-reading text-ink-2">
          <li>Envelope e caderno em 3D (F1-T10) — storyboard em docs/motion.</li>
          <li>Replay com dez eventos demonstrativos (F1-T12).</li>
          <li>Constelação como evidência (F1-T15).</li>
        </ul>
      </section>
    </>
  );
}
