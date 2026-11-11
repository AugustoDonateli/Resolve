import { clsx } from "clsx";

/**
 * Marca tipográfica Resolve: serifa de título com o "o" substituído pela bolinha marcada de uma
 * folha de respostas. `tone="desk"` é a versão em papel, para ficar sobre a mesa escura.
 */
export function Wordmark({ className, size = 28, tone = "ink" }: { className?: string; size?: number; tone?: "ink" | "desk" }) {
  const bubble = Math.round(size * 0.46);
  return (
    <span
      role="img"
      aria-label="Resolve"
      className={clsx("inline-flex items-baseline font-display leading-none", tone === "desk" ? "text-on-desk" : "text-ink", className)}
      style={{ fontSize: size, letterSpacing: "-0.015em" }}
    >
      <span aria-hidden="true">Res</span>
      <span
        aria-hidden="true"
        className="relative mx-[0.04em] inline-block rounded-full border-current"
        style={{ width: bubble, height: bubble, borderWidth: Math.max(1.5, size / 18), transform: "translateY(0.02em)" }}
      >
        <span className="absolute inset-[18%] rounded-full bg-current" />
      </span>
      <span aria-hidden="true">lve</span>
    </span>
  );
}
