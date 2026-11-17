"use client";

import { AlertCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signUpWithInvite, type InviteState } from "@/lib/club/actions";

/** Ficha do convite: e-mail, senha e o aceite dos termos. O erro conserva o e-mail digitado. */
export function InviteForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(signUpWithInvite, { email: "" });
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="code" value={code} />
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
          aria-describedby="convite-msg"
          className="field-line"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="t-kicker">
          Senha
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-describedby="convite-msg senha-dica" className="field-line" />
        <p id="senha-dica" className="t-meta text-ink-2">
          De 8 a 72 caracteres. Sem e-mail de recuperação: guarde a senha.
        </p>
      </div>
      <label className="flex items-start gap-3 t-ui text-ink">
        <input type="checkbox" name="terms" className="mt-1 size-4 accent-[var(--rs-primary)]" required />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-link underline">
            termos e a privacidade
          </Link>
          .
        </span>
      </label>
      <div id="convite-msg" aria-live="polite" className="min-h-5">
        {state.error && (
          <p className="flex gap-2 t-meta text-ink">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" loading={pending} icon={<UserPlus aria-hidden className="size-4" />}>
        Criar conta
      </Button>
    </form>
  );
}
