import { ROMAN, type MotivatingText, type PromptDetail } from "@/lib/essay/prompt-types";

/**
 * Proposta de redação e textos motivadores, como no caderno: blocos na ordem original, figura com
 * texto alternativo e a citação impressa logo abaixo de cada texto. Todo conteúdo é exibido como
 * texto (nada é interpretado como HTML). Figura sem arquivo aparece como indisponível, nunca some.
 */
export function PromptReader({ prompt, renderTextExtra, headingLevel = 2 }: {
  prompt: Pick<PromptDetail, "instruction" | "texts" | "figureUrls">;
  renderTextExtra?: (t: MotivatingText) => React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const H = `h${headingLevel}` as "h2" | "h3";
  const Hs = `h${headingLevel + 1}` as "h3" | "h4";
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="proposta" className="rounded-panel border border-line bg-surface p-4 sm:p-6">
        <H id="proposta" className="mb-2 t-section">
          Proposta
        </H>
        <p className="t-reading">{prompt.instruction}</p>
      </section>
      <section aria-labelledby="textos-motivadores">
        <H id="textos-motivadores" className="mb-3 t-section">
          Textos motivadores
        </H>
        <ol className={headingLevel === 2 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
          {prompt.texts.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-card border border-line-subtle bg-surface p-4 sm:p-5">
              <Hs className="t-ui font-semibold">Texto {ROMAN[t.position - 1] ?? t.position}</Hs>
              {t.blocks.map((b) => {
                if (b.type === "image") {
                  const url = b.asset_ref ? prompt.figureUrls[b.asset_ref] : undefined;
                  return (
                    <figure key={b.id} className="flex flex-col gap-1">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- link assinado de curta duração
                        <img src={url} alt={b.text ?? ""} className="h-auto max-w-full rounded-control border border-line-subtle" />
                      ) : (
                        <p className="rounded-control border border-line-subtle p-3 t-meta text-ink-2">Figura indisponível no momento. Descrição: {b.text}</p>
                      )}
                    </figure>
                  );
                }
                if (b.type === "heading") {
                  return (
                    <p key={b.id} className="t-reading font-semibold">
                      {b.text}
                    </p>
                  );
                }
                return (
                  <p key={b.id} className="t-reading">
                    {b.text}
                  </p>
                );
              })}
              <p className="t-meta text-ink-2">{t.citation ?? "Citação da fonte indisponível."}</p>
              {renderTextExtra?.(t)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
