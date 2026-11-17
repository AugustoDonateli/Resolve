import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyReport } from "@/components/progress/weekly-report";
import { ErrorPattern, ProfileView } from "@/components/progress/profile-view";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadGuide } from "@/lib/guide/data";
import { loadProfile } from "@/lib/profile/data";
import { longExamDate } from "@/lib/routine/exam";
import { loadSuggestion } from "@/lib/study/suggestion";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { loadWeeklyReport } from "@/lib/routine/weekly";
import { loadCourseGoals } from "@/lib/goals/data";

export const metadata: Metadata = { title: "Progresso" };
export const dynamic = "force-dynamic";

export default async function ProgressoPage() {
  const [report, goals, profile, suggestion, guide] = await Promise.all([loadWeeklyReport(), loadCourseGoals(), loadProfile(), loadSuggestion(), loadGuide()]);
  if (!report)
    return (
      <>
        <ScreenHeader title="Progresso" />
        <EmptyState icon={BarChart3} title="Entre para ver seu progresso" body="O relatório usa o que você registra no Resolve." action={{ href: "/entrar", label: "Entrar" }} />
      </>
    );
  return (
    <>
      <ScreenHeader title="Progresso" kicker="Onde você está, pelos dados que você gerou" />
      <div className="flex flex-col gap-14">
        {profile && <ProfileView profile={profile} />}
        {profile && (
          <div className="grid gap-x-14 gap-y-12 border-t border-line-subtle pt-10 lg:grid-cols-2">
            <ErrorPattern profile={profile} />
            <section aria-labelledby="aprendeu" className="flex flex-col gap-3">
              <h2 id="aprendeu" className="t-section">
                O que o Resolve aprendeu sobre você
              </h2>
              <p className="t-meta text-ink-2">O que o site sabe e o que faz com isso. Nada aqui é decidido sem você poder ver o motivo.</p>
              <ul className="flex flex-col border-t border-line-subtle">
                {suggestion && (
                  <li className="border-b border-line-subtle py-3">
                    <p className="t-ui text-ink">O que fazer agora: {suggestion.title.toLowerCase()}.</p>
                    <p className="t-meta text-ink-2">
                      {suggestion.reason} Aparece no alto de{" "}
                      <Link href="/estudar" className="text-link underline">
                        Estudar
                      </Link>{" "}
                      e escolhe a área do treino no plano do dia.
                    </p>
                  </li>
                )}
                <li className="border-b border-line-subtle py-3">
                  <p className="t-ui text-ink">
                    {profile.pattern ? `Erro mais comum: ${profile.pattern.top.label.toLowerCase()}.` : "Erro mais comum: ainda sem erros suficientes."}
                  </p>
                  <p className="t-meta text-ink-2">Por enquanto só informa; ainda não muda as questões que o treino sorteia.</p>
                </li>
                <li className="border-b border-line-subtle py-3">
                  <p className="t-ui text-ink">
                    {guide?.weeklyHours ? `Você disse que estuda ${guide.weeklyHours} horas por semana.` : "Horas de estudo por semana: você ainda não informou."}
                  </p>
                  <p className="t-meta text-ink-2">
                    Fica guardado na{" "}
                    <Link href="/mais/ficha" className="text-link underline">
                      ficha de identificação
                    </Link>
                    ; ainda não muda o plano do dia, que hoje sai dos horários livres da Rotina.
                  </p>
                </li>
                <li className="border-b border-line-subtle py-3">
                  <p className="t-ui text-ink">
                    {guide?.examDay ? `1º dia de prova em ${longExamDate(guide.examDay)} (data informada por você).` : "Data da prova: você ainda não informou."}
                  </p>
                  <p className="t-meta text-ink-2">Liga a contagem em Hoje e, nos últimos 60 dias, troca o treino livre por blocos de ritmo.</p>
                </li>
              </ul>
            </section>
          </div>
        )}
        <div className="border-t border-line-subtle pt-10">
          <WeeklyReport r={report} />
        </div>

        <section aria-labelledby="meta-curso" className="flex flex-col gap-2 border-t border-line-subtle pt-10">
          <h2 id="meta-curso" className="t-section">
            Meta de curso
          </h2>
          {goals && goals.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {goals.map((g) => (
                <li key={g.id} className="t-reading text-ink">
                  {g.course} · {g.institution}
                  <span className="t-meta text-ink-2">
                    {g.cutoff === null ? " · sem nota de corte" : ` · corte ${g.cutoff.toLocaleString("pt-BR")} (informado por você)`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-reading text-ink-2">Nenhuma meta ainda. Informe o curso, a nota de corte e os pesos, com a fonte.</p>
          )}
          <Link href="/progresso/meta" className="inline-flex min-h-11 items-center t-ui text-link underline">
            {goals && goals.length > 0 ? "Abrir a meta e simular a média" : "Definir meta de curso"}
          </Link>
          <p className="t-meta text-ink-2">Previsão de nota para a meta: ainda não. Ela precisa de um histórico de notas estimadas da sua conta.</p>
        </section>

        <section aria-labelledby="habilidades" className="flex flex-col gap-1 border-t border-line-subtle pt-10">
          <h2 id="habilidades" className="t-section">
            Para consultar
          </h2>
          <Link href="/estudar/matriz" className="flex min-h-11 items-center t-ui text-link underline">
            Matriz e incidência: as 120 habilidades oficiais e a ficha de cada uma
          </Link>
          <Link href="/diagnostico" className="flex min-h-11 items-center t-ui text-link underline">
            Diagnóstico: a nota estimada de cada área e os erros que mais pesam nela
          </Link>
        </section>
      </div>
    </>
  );
}
