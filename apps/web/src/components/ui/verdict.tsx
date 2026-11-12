import { clsx } from "clsx";

/**
 * Veredito de uma resposta, como numa prova corrigida: acerto leva carimbo azul; erro leva a nota do
 * corretor em caneta vermelha com o gabarito. O texto para leitor de tela é sempre a frase completa.
 * `fresh` liga o gesto (carimbo batendo, nota sendo escrita) só no momento da correção.
 */
export function Verdict({ correct, letter, fresh = false, className }: { correct: boolean; letter: string | null; fresh?: boolean; className?: string }) {
  return (
    <div className={clsx("flex min-h-12 items-center gap-4", className)}>
      {correct ? (
        <span aria-hidden="true" className={clsx("stamp text-[15px] text-primary", fresh && "stamp-hit")}>
          Certa
        </span>
      ) : (
        <span aria-hidden="true" className={clsx("t-hand -rotate-2 text-pen", fresh && "hand-write")}>
          gabarito: {letter ?? "?"}
        </span>
      )}
      <span role="status" className="t-ui">
        {correct ? "Você acertou." : `Resposta correta: ${letter ?? "indisponível"}.`}
      </span>
    </div>
  );
}

/**
 * Tira de bolinhas do resultado: uma por questão, na ordem. Cheia = acerto; com xis = erro; vazia =
 * sem resposta. Aparecem uma a uma, como a correção passando pelo cartão.
 */
export function ResultStrip({ marks, label }: { marks: ("certa" | "errada" | "vazia")[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-1.5">
      {marks.map((m, i) => (
        <li
          key={i}
          className={clsx(
            "result-dot relative grid size-6 place-items-center rounded-full border-[1.5px] border-ink",
            m === "certa" && "bg-ink",
          )}
          style={{ animationDelay: `${Math.min(i, 44) * 45 + 150}ms` }}
        >
          {m === "errada" && (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 stroke-pen" fill="none" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          )}
          <span className="sr-only">
            Questão {i + 1}: {m === "certa" ? "acerto" : m === "errada" ? "erro" : "sem resposta"}
          </span>
        </li>
      ))}
    </ol>
  );
}
