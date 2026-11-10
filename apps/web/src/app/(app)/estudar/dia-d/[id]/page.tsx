import type { Metadata } from "next";
import Link from "next/link";
import { ExamRunner } from "@/components/dia-d/exam-runner";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadExamRun } from "@/lib/dia-d/data";

export const metadata: Metadata = { title: "Simulado Dia D" };
export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await loadExamRun(id);
  return (
    <>
      <Link href="/estudar/dia-d" className="mb-3 inline-flex min-h-11 items-center t-ui underline">Voltar ao Dia D</Link>
      <ScreenHeader title={run.ended_at ? "Resultado do Dia D" : `Dia ${run.booklet.day} · Caderno ${run.booklet.color}`}
        kicker={`${run.booklet.profile} · ${run.reference_time ? "Horário de referência" : "Horário livre"}`} />
      <ExamRunner key={`${run.id}:${run.revision}:${run.ended_at}`} run={run} />
    </>
  );
}
