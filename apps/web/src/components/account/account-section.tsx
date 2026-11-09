import { LogOut, UserRound } from "lucide-react";
import { signOut } from "@/app/entrar/actions";
import { Button } from "@/components/ui/button";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Conta (T01): quem está conectado e sair. Em modo local, explica a ausência de conta. */
export async function AccountSection() {
  if (!authEnabled) {
    return (
      <section aria-labelledby="account-title" className="rounded-panel border border-dashed border-line bg-surface p-5 sm:p-6">
        <h2 id="account-title" className="t-section">Conta</h2>
        <p className="mt-1 t-meta text-ink-2">Modo local: o Supabase não está configurado neste ambiente. Preferências ficam só neste aparelho.</p>
      </section>
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <section aria-labelledby="account-title" className="rounded-panel border border-line-subtle bg-surface p-5 sm:p-6">
      <h2 id="account-title" className="t-section">Conta</h2>
      <p className="mt-3 flex items-center gap-2 t-ui">
        <UserRound aria-hidden="true" className="size-5 text-ink-2" />
        <span className="min-w-0 truncate" data-testid="account-email">{user?.email}</span>
      </p>
      <p className="mt-1 t-meta text-ink-2">Preferências desta tela ficam salvas na sua conta e valem em qualquer aparelho.</p>
      <form action={signOut} className="mt-4">
        <Button type="submit" variant="secondary" icon={<LogOut aria-hidden className="size-4" />}>
          Sair
        </Button>
      </form>
    </section>
  );
}
