import { clsx } from "clsx";
import Link from "next/link";
import type { Profile } from "@/lib/profile/data";
import type { Level } from "@/lib/profile/rule";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

/** Marca ao lado da frase: preenchida = vai bem; metade = na média; vazia = precisa de reforço. Sempre com texto. */
function LevelMark({ level }: { level: Level | null }) {
  return (
    <span aria-hidden="true" className="relative mt-1 size-4 shrink-0 overflow-hidden rounded-full border-[1.5px] border-ink">
      <span className={clsx("absolute inset-y-0 left-0 bg-ink", level === "bem" ? "w-full" : level === "media" ? "w-1/2" : "w-0")} />
    </span>
  );
}

/**
 * Perfil por área: uma frase simples para cada uma (vai bem, na média, precisa de reforço), com os números
 * que a sustentam e, quando houver respostas suficientes, a nota estimada. Os temas ficam dentro de cada área.
 */
export function ProfileView({ profile }: { profile: Profile }) {
  return (
    <section aria-labelledby="perfil" className="flex flex-col gap-5">
      <div>
        <h2 id="perfil" className="t-section">
          Seu perfil por área
        </h2>
        <p className="mt-1 max-w-[68ch] t-meta text-ink-2">
          Comparação com quem fez o Enem, nas mesmas questões que você respondeu (primeira tentativa, sem ajuda). Mostra como você está hoje; muda a
          cada resposta.
        </p>
      </div>
      {profile.extremes && (
        <p className="max-w-[62ch] t-reading text-ink">
          {profile.extremes.strongest && (
            <>
              Até aqui, seu ponto mais forte é <span className="font-medium">{profile.extremes.strongest}</span>.{" "}
            </>
          )}
          {profile.extremes.weakest && (
            <>
              Onde mais precisa de reforço: <span className="font-medium">{profile.extremes.weakest}</span>.
            </>
          )}
        </p>
      )}
      <ul className="flex flex-col border-t-[1.5px] border-ink">
        {profile.areas.map((a) => (
          <li key={a.code} className="border-b border-line-subtle py-4">
            <div className="grid gap-x-8 gap-y-1 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-baseline">
              <h3 className="t-ui font-semibold text-ink">{a.label}</h3>
              <div className="flex gap-2.5">
                <LevelMark level={a.reading.level} />
                <p className="t-ui text-ink">
                  {a.reading.headline}.<span className="block t-meta text-ink-2">{a.reading.detail}</span>
                </p>
              </div>
              <p className="t-meta text-ink-2 md:text-right">
                {a.score ? (
                  <>
                    Nota estimada: <span className="t-ui tabular text-ink">{fmt(a.score.value)}</span>
                    <span className="block">
                      entre {fmt(a.score.lower)} e {fmt(a.score.upper)}
                    </span>
                  </>
                ) : (
                  "Nota estimada: ainda sem respostas suficientes"
                )}
              </p>
            </div>
            {a.themes.length > 0 && (
              <details className="mt-2 md:ml-[15rem]">
                <summary className="min-h-11 cursor-pointer t-meta text-link underline md:min-h-8">
                  Ver por tema ({a.themes.length})
                </summary>
                <ul className="mt-1 flex flex-col">
                  {a.themes.map((t) => (
                    <li key={t.code} className="flex gap-2.5 border-t border-line-subtle py-2">
                      <LevelMark level={t.reading.level} />
                      <p className="t-meta text-ink-2">
                        <span className="text-ink">
                          {t.discipline ? `${t.discipline}: ` : ""}
                          {t.label}
                        </span>
                        <span className="block">
                          {t.reading.headline}. {t.reading.detail}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      <p className="t-meta text-ink-2">
        <Link href="/diagnostico" className="text-link underline">
          Abrir o diagnóstico
        </Link>{" "}
        mostra de onde vem cada nota estimada e quais erros mais pesam nela.
      </p>
    </section>
  );
}

/** Padrão de erro: o tipo de alternativa errada em que a conta mais cai, com a definição e o que treinar. */
export function ErrorPattern({ profile }: { profile: Profile }) {
  const p = profile.pattern;
  return (
    <section aria-labelledby="padrao" className="flex max-w-[68ch] flex-col gap-3">
      <h2 id="padrao" className="t-section">
        Seu padrão de erro
      </h2>
      {p ? (
        <>
          <p className="t-reading text-ink">
            De {p.classified} erros com o tipo identificado, {p.top.n} foram por <span className="font-medium">{p.top.label.toLowerCase()}</span>.{" "}
            {p.top.definition}
          </p>
          {p.others.length > 0 && (
            <p className="t-meta text-ink-2">
              Depois vêm: {p.others.map((o) => `${o.label.toLowerCase()} (${o.n})`).join(", ")}.
              {p.wrongTotal > p.classified ? ` Outros ${p.wrongTotal - p.classified} erros não têm tipo definido.` : ""}
            </p>
          )}
          <p className="t-ui text-ink">
            Para treinar isso:{" "}
            <Link href="/estudar/distrator" className="text-link underline">
              Caça ao distrator
            </Link>
            , em que você diz por que cada alternativa errada atrai.
          </p>
        </>
      ) : (
        <p className="t-reading text-ink-2">
          Ainda não dá para dizer. O padrão aparece com cinco erros de tipo identificado; cada erro novo entra na conta.
        </p>
      )}
    </section>
  );
}
