import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteForm } from "@/components/club/invite-form";
import { DeskLamp } from "@/components/shell/desk-lamp";
import { Wordmark } from "@/components/ui/wordmark";
import { createAccountMessage } from "@/lib/auth/errors";
import { normalizeCode } from "@/lib/club/rules";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite" };
export const dynamic = "force-dynamic";

/** Convite: a ficha para criar a conta, quando o código vale; senão, o motivo e o que fazer. */
export default async function ConvitePage({ params }: { params: Promise<{ code: string }> }) {
  if (!authEnabled) redirect("/hoje");
  const code = normalizeCode((await params).code);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/hoje");
  const { data: state } = await supabase.rpc("invite_status", { p_code: code });
  const ok = state === "ok";
  return (
    <main id="conteudo" className="desk relative grid min-h-dvh place-items-center px-4 py-10">
      <DeskLamp />
      <div className="relative w-full max-w-[440px] bg-background p-6 shadow-sheet sm:p-9" style={{ animation: "desk-land 700ms var(--rs-ease-layout) both" }}>
        <div className="mb-6 flex items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
          <div>
            <p className="t-kicker">Convite para o Resolve</p>
            <h1 className="mt-1 t-screen">{ok ? "Crie a sua conta" : "Convite indisponível"}</h1>
          </div>
          <Wordmark size={22} className="mb-1" />
        </div>
        {ok ? (
          <>
            <p className="mb-5 t-reading text-ink-2">
              Um site de estudo para o Enem, com as questões oficiais corrigidas na hora, revisão, redação e simulado. Escolha um e-mail e uma senha: a conta
              já fica ativa.
            </p>
            <InviteForm code={code} />
          </>
        ) : (
          <>
            <p className="t-reading text-ink">{createAccountMessage(`convite_${String(state ?? "invalido")}`)}</p>
            <Link href="/entrar" className="mt-5 inline-flex min-h-11 items-center t-ui text-link underline">
              Já tenho conta: entrar
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
