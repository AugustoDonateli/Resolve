"use client";

import { clsx } from "clsx";
import { AlertCircle, Info, LogIn, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { authenticate, type AuthState } from "./actions";

/**
 * Entrar e criar conta por convite (T01). Erro conserva o e-mail digitado e
 * diz o que fazer; carregando preserva o rótulo do botão.
 */
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {
    mode: "entrar",
    email: "",
    error: undefined,
  });
  const [mode, setMode] = useState<AuthState["mode"]>(state.mode);
  // Quando a ação devolve um novo estado (ex.: conta criada → Entrar), o modo acompanha.
  const [prev, setPrev] = useState(state);
  if (prev !== state) {
    setPrev(state);
    setMode(state.mode);
  }
  const current = mode;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="mode" value={current} />
      <input type="hidden" name="next" value={next} />

      <fieldset>
        <legend className="sr-only">O que você quer fazer</legend>
        <div className="grid grid-cols-2 gap-1 border-b border-line-subtle">
          {(
            [
              ["entrar", "Entrar"],
              ["criar", "Criar conta"],
            ] as const
          ).map(([v, label]) => (
            <label
              key={v}
              className={clsx(
                "-mb-px flex min-h-11 cursor-pointer items-center justify-center rounded-t-[6px] border border-b-0 t-ui transition-colors duration-[var(--rs-dur-state)]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link",
                current === v ? "border-line-subtle bg-surface font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              <input type="radio" name="mode-choice" value={v} checked={current === v} onChange={() => setMode(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {current === "criar" && (
        <p className="-mt-2 t-meta text-ink-2">Escolha uma senha e pronto: a conta já fica ativa, sem e-mail de confirmação.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="t-kicker">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          key={`e-${state.email}`}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="auth-msg"
          className="field-line"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="t-kicker">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={current === "criar" ? "new-password" : "current-password"}
          required
          minLength={8}
          aria-describedby="auth-msg password-hint"
          className="field-line"
        />
        <p id="password-hint" className="t-meta text-ink-2">
          Pelo menos 8 caracteres.
        </p>
      </div>

      <div id="auth-msg" aria-live="polite" className="min-h-5">
        {state.error && (
          <p className="flex gap-2 t-meta text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        )}
        {state.info && !state.error && (
          <p className="flex gap-2 t-meta text-ink">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.info}
          </p>
        )}
      </div>

      <Button type="submit" loading={pending} icon={current === "entrar" ? <LogIn aria-hidden className="size-4" /> : <UserPlus aria-hidden className="size-4" />}>
        {current === "entrar" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}
