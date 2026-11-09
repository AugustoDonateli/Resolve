import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * Botão (plano §6): normal, hover, foco 2/2 px, pressionado, carregando com
 * rótulo preservado e desabilitado. Pressão em 120 ms com deslocamento mínimo.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-control t-ui whitespace-nowrap",
        "transition-[background-color,border-color,transform,color] duration-[var(--rs-dur-press)] ease-press",
        "active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0",
        size === "md" ? "min-h-11 px-4" : "min-h-9 px-3 text-[15px]",
        variant === "primary" &&
          "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed disabled:bg-disabled disabled:text-ink-2",
        variant === "secondary" &&
          "border border-line bg-surface text-ink hover:bg-surface-subtle disabled:bg-disabled disabled:text-ink-2",
        variant === "ghost" && "text-ink hover:bg-surface-subtle disabled:text-ink-2",
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      <span>{children}</span>
    </button>
  );
});

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 animate-spin motion-reduce:animate-none">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
