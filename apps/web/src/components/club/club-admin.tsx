"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createInvite, removeMember, revokeInvite, setMemberStatus } from "@/lib/club/actions";
import type { Club } from "@/lib/club/data";
import { INVITE_STATE_LABEL, confirmsDeletion, inviteLink, usd } from "@/lib/club/rules";

const field = "min-h-11 rounded-control border border-line bg-surface px-3 t-ui text-ink";
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca");

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? "Link copiado" : "Copiar link"}
    </Button>
  );
}

/**
 * Clube (só o dono): criar e cancelar convites; ver as contas, o último acesso e a cota de IA do mês;
 * suspender, reativar ou remover com exclusão de todos os dados (confirmação digitada).
 */
export function ClubAdmin({ club, origin }: { club: Club; origin: string }) {
  const router = useRouter();
  const uid = useId();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [uses, setUses] = useState("1");
  const [days, setDays] = useState("7");
  const [fresh, setFresh] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (r.ok) {
        after?.();
        router.refresh();
      } else setMessage(r.message ?? "Não foi possível agora.");
    });

  const open = club.invites.filter((i) => i.state === "ok");
  const closed = club.invites.filter((i) => i.state !== "ok").slice(0, 10);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="convidar" className="flex flex-col gap-4">
        <div>
          <h2 id="convidar" className="t-section">
            Convidar
          </h2>
          <p className="mt-1 max-w-[62ch] t-meta text-ink-2">
            O convite é um link. Quem abre cria a conta com e-mail e senha e aceita os termos. Vagas para convidados: {club.seatsLeft} de 5.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              async () => {
                const r = await createInvite({ note, maxUses: Number(uses), days: Number(days) });
                if (r.ok) setFresh(r.value);
                return r;
              },
              () => setNote(""),
            );
          }}
        >
          <label htmlFor={`${uid}-nota`} className="flex min-w-[14rem] flex-1 flex-col gap-1 t-meta text-ink-2">
            Para quem (só você vê)
            <input id={`${uid}-nota`} className={field} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Ana, do cursinho" />
          </label>
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Usos
            <select className={field} value={uses} onChange={(e) => setUses(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 t-meta text-ink-2">
            Validade
            <select className={field} value={days} onChange={(e) => setDays(e.target.value)}>
              {[1, 3, 7, 14, 30].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "dia" : "dias"}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" loading={pending} disabled={club.seatsLeft <= 0}>
            Criar convite
          </Button>
        </form>
        {fresh && (
          <div role="status" className="rounded-card border border-line-subtle bg-surface p-4 shadow-paper">
            <p className="t-ui text-ink">Convite criado. Mande este link para a pessoa:</p>
            <p className="mt-1 break-all font-mono text-[14px] text-ink">{inviteLink(origin, fresh)}</p>
            <div className="-ml-3 mt-1">
              <CopyLink link={inviteLink(origin, fresh)} />
            </div>
          </div>
        )}
        {open.length > 0 && (
          <ul className="flex flex-col border-t border-line-subtle">
            {open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line-subtle py-2.5">
                <p className="t-ui text-ink">
                  {i.note || "Sem anotação"}
                  <span className="block t-meta text-ink-2">
                    {i.uses} de {i.maxUses} {i.maxUses === 1 ? "uso" : "usos"} · vale até {date(i.expiresAt)} · <span className="font-mono">{i.code}</span>
                  </span>
                </p>
                <div className="flex gap-1">
                  <CopyLink link={inviteLink(origin, i.code)} />
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInvite({ id: i.id }))}>
                    Cancelar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {closed.length > 0 && (
          <details>
            <summary className="min-h-11 cursor-pointer t-meta text-link underline">Convites encerrados ({closed.length})</summary>
            <ul className="mt-1 flex flex-col">
              {closed.map((i) => (
                <li key={i.id} className="border-t border-line-subtle py-2 t-meta text-ink-2">
                  {i.note || "Sem anotação"} · {INVITE_STATE_LABEL[i.state]} · {i.uses} de {i.maxUses}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="contas" className="flex flex-col gap-3">
        <h2 id="contas" className="t-section">
          Contas
        </h2>
        <p className="max-w-[62ch] t-meta text-ink-2">
          Você vê o e-mail, o último acesso e a cota de IA de cada conta. Respostas e redações das outras pessoas não aparecem aqui.
        </p>
        <ul className="flex flex-col border-t-[1.5px] border-ink">
          {club.accounts.map((a) => (
            <li key={a.userId} className="flex flex-col gap-2 border-b border-line-subtle py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 t-ui text-ink">
                  <span className="break-all">{a.email}</span>
                  <span className="t-meta text-ink-2">
                    {" "}
                    · {a.kind === "dono" ? "dono" : a.kind === "convidado" ? "convidado" : "conta anterior aos convites"}
                    {a.me ? " (você)" : ""}
                  </span>
                </p>
                <p className="t-meta text-ink-2">
                  {a.status === "suspenso" ? <span className="font-medium text-ink">suspensa · </span> : null}
                  último acesso: {date(a.lastSignInAt)}
                </p>
              </div>
              <p className="t-meta text-ink-2">
                Cota de IA do mês: {a.aiLimitUsd === null ? "sem cota própria (usa só o teto do clube)" : `${usd(a.aiConsumedUsd + a.aiReservedUsd)} de ${usd(a.aiLimitUsd)}`}
              </p>
              {!a.me && a.kind !== "dono" && (
                <div className="-ml-3 flex flex-wrap gap-1">
                  {a.status === "suspenso" ? (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setMemberStatus({ userId: a.userId, status: "ativo" }))}>
                      Reativar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setMemberStatus({ userId: a.userId, status: "suspenso" }))}>
                      Suspender
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setRemoving(a.userId);
                      setConfirm("");
                      setMessage(null);
                    }}
                  >
                    Remover e apagar dados
                  </Button>
                </div>
              )}
              {removing === a.userId && (
                <form
                  role="alertdialog"
                  aria-label={`Remover ${a.email}`}
                  className="flex flex-col gap-3 rounded-card border-[1.5px] border-ink bg-surface p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      () => removeMember({ userId: a.userId, confirm }),
                      () => setRemoving(null),
                    );
                  }}
                >
                  <p className="t-ui text-ink">
                    Isto apaga de vez a conta {a.email} e tudo dela: respostas, revisões, redações, fotos e grupos. Não dá para desfazer. Para só bloquear o
                    acesso, use Suspender.
                  </p>
                  <label className="flex flex-col gap-1 t-meta text-ink-2">
                    Digite EXCLUIR para confirmar
                    <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="secondary" loading={pending} disabled={!confirmsDeletion(confirm)}>
                      Remover e apagar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setRemoving(null)}>
                      Voltar
                    </Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
      <div aria-live="polite">
        {message && (
          <p role="alert" className="t-ui text-ink">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
