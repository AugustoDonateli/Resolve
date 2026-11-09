import { clsx } from "clsx";

/**
 * Marca tipográfica Resolve: Newsreader com o "o" substituído pela bolinha
 * marcada de uma folha de respostas. Primeira proposta (F1-T02); o desenho
 * final da marca segue em refinamento.
 */
export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  const bubble = Math.round(size * 0.46);
  return (
    <span
      role="img"
      aria-label="Resolve"
      className={clsx("inline-flex items-baseline font-display font-medium leading-none text-ink", className)}
      style={{ fontSize: size, letterSpacing: "-0.015em" }}
    >
      <span aria-hidden="true">Res</span>
      <span
        aria-hidden="true"
        className="relative mx-[0.04em] inline-block rounded-full border-ink"
        style={{ width: bubble, height: bubble, borderWidth: Math.max(1.5, size / 18), transform: "translateY(0.02em)" }}
      >
        <span className="absolute inset-[18%] rounded-full bg-ink" />
      </span>
      <span aria-hidden="true">lve</span>
    </span>
  );
}
