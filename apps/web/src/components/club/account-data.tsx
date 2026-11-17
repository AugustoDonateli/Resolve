"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteMyAccount } from "@/lib/club/actions";
import type { MyAccount } from "@/lib/club/data";
import { confirmsDeletion, quotaState, usd } from "@/lib/club/rules";

/** Conta e dados: cota de IA do mês, termos aceitos, baixar tudo e excluir a conta (confirmação digitada). */
export function AccountData({ account }: { account: MyAccount }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const q = account.quota ? quotaState(account.quota) : null;
  return (
    <div className="flex max-w-[68ch] flex-col gap-12">
      <section aria-labelledby="cota" className="flex flex-col gap-2">
        <h2 id="cota" className="t-section">
          Cota de inteligência artificial
        </h2>
        {account.quota && q ? (
          <>
            <p className="t-reading text-ink">
              Neste mês: {usd(q.used)} de {usd(account.quota.limitUsd)}.
              {q.level === "aviso" && " Você passou de 70% da cota."}
              {q.level === "esgotada" && " A cota do mês acabou; as partes com inteligência artificial voltam no mês que vem."}
            </p>
            <div aria-hidden="true" className="h-3 max-w-md border-[1.5px] border-ink">
              <div className="h-full bg-ink" style={{ width: `${Math.round(q.share * 100)}%` }} />
            </div>
            <p className="t-meta text-ink-2">Gasta só quando você pede algo que usa inteligência artificial, como a correção de uma redação. Recomeça todo mês.</p>
          </>
        ) : (
          <p className="t-reading text-ink-2">
            {account.owner ? "Conta do dono: sem cota própria; vale o teto do clube (US$ 10 por mês)." : "Sua conta não tem cota de inteligência artificial definida."}
          </p>
        )}
      </section>

      <section aria-labelledby="termos" className="flex flex-col gap-2">
        <h2 id="termos" className="t-section">
          Termos e privacidade
        </h2>
        <p className="t-reading text-ink">
          {account.termsAcceptedAt
            ? `Você aceitou a versão de ${account.termsVersion?.split("-").reverse().join("/")} em ${new Date(account.termsAcceptedAt).toLocaleDateString("pt-BR")}.`
            : "Sua conta é anterior aos convites; os termos valem igual."}{" "}
          <Link href="/termos" className="text-link underline">
            Ler os termos
          </Link>
        </p>
      </section>

      <section aria-labelledby="baixar" className="flex flex-col gap-2">
        <h2 id="baixar" className="t-section">
          Baixar meus dados
        </h2>
        <p className="t-reading text-ink-2">
          Um arquivo com tudo o que é seu: respostas, revisões, horários, metas, redações com todas as versões e os links das fotos (válidos por 7 dias).
        </p>
        <a
          href="/mais/conta/exportar"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-control border-[1.5px] border-ink px-4 t-ui text-ink hover:bg-ink hover:text-background"
        >
          <Download aria-hidden className="size-4" /> Baixar meus dados
        </a>
      </section>

      <section aria-labelledby="excluir" className="flex flex-col gap-3">
        <h2 id="excluir" className="t-section">
          Excluir minha conta
        </h2>
        {account.owner ? (
          <p className="t-reading text-ink-2">A conta do dono não é excluída pela tela.</p>
        ) : !open ? (
          <>
            <p className="t-reading text-ink-2">Apaga de vez a conta e todos os dados. Antes, vale baixar uma cópia acima.</p>
            <Button variant="ghost" className="-ml-3 self-start" onClick={() => setOpen(true)}>
              Quero excluir minha conta
            </Button>
          </>
        ) : (
          <form
            role="alertdialog"
            aria-label="Excluir minha conta"
            className="flex flex-col gap-3 rounded-card border-[1.5px] border-ink bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                setMessage(null);
                const r = await deleteMyAccount({ confirm });
                if (r && !r.ok) setMessage(r.message);
              });
            }}
          >
            <p className="t-ui text-ink">
              Isto apaga {account.email} e tudo dele: respostas, revisões, redações, fotos, grupos e a própria conta. Não dá para desfazer.
            </p>
            <label className="flex flex-col gap-1 t-meta text-ink-2">
              Digite EXCLUIR para confirmar
              <input className="min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" loading={pending} disabled={!confirmsDeletion(confirm)}>
                Excluir de vez
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Voltar
              </Button>
            </div>
            <div aria-live="polite">
              {message && (
                <p role="alert" className="t-ui text-ink">
                  {message}
                </p>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
