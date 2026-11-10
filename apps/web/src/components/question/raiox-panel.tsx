import type { RaioXView } from "@/lib/study/raiox";

/**
 * Raio-X textual (F3-T04): comando e habilidade, evidência, distratores e resolução comentada revisados.
 * Sem movimento (o scanner M01 é a F3-T05). Dado ausente aparece como indisponível.
 */
export function RaioXPanel({
  view,
  headingId,
}: {
  view: RaioXView;
  headingId: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-[72ch] flex-col gap-5 rounded-panel border border-line bg-surface p-4 sm:p-6"
    >
      <h3 id={headingId} tabIndex={-1} className="t-section outline-none">
        Raio-X
      </h3>
      {view.reason === "ajuda" && (
        <p className="rounded-card border border-line-subtle bg-surface-subtle p-3 t-meta">
          Você abriu a resolução antes de responder: esta tentativa fica
          registrada como feita com ajuda.
        </p>
      )}
      <div>
        <h4 className="mb-1 t-ui font-semibold">Comando</h4>
        <p className="t-reading">
          {view.skill ? (
            <>
              <span className="font-medium">{view.skill.code}</span> —{" "}
              {view.skill.description}
            </>
          ) : (
            "Habilidade indisponível."
          )}
        </p>
      </div>
      <div>
        <h4 className="mb-1 t-ui font-semibold">Evidência</h4>
        {view.evidence.length === 0 ? (
          <p className="t-reading text-ink-2">
            Evidência não registrada para esta questão.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.evidence.map((e, i) => (
              <li key={i} className="t-reading">
                {e.quote ? (
                  <>
                    <mark className="rounded-[2px] bg-mark-yellow px-0.5 text-on-mark">
                      “{e.quote}”
                    </mark>{" "}
                    <span className="t-meta text-ink-2">{e.where}</span>
                  </>
                ) : (
                  <span className="t-meta text-ink-2">
                    Trecho {e.where} indisponível.
                  </span>
                )}
                {e.rationale && (
                  <span className="mt-1 block">{e.rationale}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-1 t-ui font-semibold">Distratores</h4>
        {view.distractors.length === 0 ? (
          <p className="t-reading text-ink-2">
            Distratores não comentados para esta questão.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.distractors.map((d) => (
              <li key={d.letter} className="t-reading">
                <span className="font-medium">
                  {d.letter} · {d.labels.join(" e ")}
                </span>
                {d.rationale && <span className="block">{d.rationale}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-1 t-ui font-semibold">
          Resolução
          {view.correctLetter ? ` · resposta ${view.correctLetter}` : ""}
        </h4>
        {view.steps.length === 0 ? (
          <p className="t-reading text-ink-2">
            Resolução comentada indisponível para esta questão.
          </p>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-5 t-reading">
            {view.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
