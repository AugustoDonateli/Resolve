"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { submitForCorrection } from "@/lib/essay/correction-actions";

/**
 * Enviar para correção: congela a versão salva (ela não muda mais; reescrever cria outra versão) e a
 * coloca na fila. A chave do envio vale para repetições do mesmo clique.
 */
export function SubmitForCorrection({
  essayId,
  versionId,
  submitted,
  canSubmit,
}: {
  essayId: string;
  versionId: string;
  submitted: boolean;
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [key] = useState(() => `envio-${crypto.randomUUID().replace(/-/g, "")}`);

  if (submitted)
    return (
      <Link
        href={`/redacao/correcao/${essayId}`}
        className="inline-flex min-h-11 items-center self-start rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover"
      >
        Ver correção
      </Link>
    );
  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
      {!confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            Enviar para correção
          </Button>
          {!canSubmit && <span className="t-meta text-ink-2">Disponível com o texto salvo e pelo menos 50 palavras.</span>}
        </div>
      ) : (
        <div role="alertdialog" aria-labelledby="confirmar-envio" className="flex flex-col gap-3 rounded-card border border-ink p-4">
          <p id="confirmar-envio" className="t-ui">
            Depois de enviada, esta versão não muda mais. Para melhorar o texto, você cria uma reescrita. Enviar agora?
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await submitForCorrection({ essayId, versionId, key });
                  if (!r.ok) return setMsg(r.message);
                  router.push(`/redacao/correcao/${essayId}`);
                })
              }
            >
              Enviar
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Continuar escrevendo
            </Button>
          </div>
        </div>
      )}
      <div aria-live="polite">{msg && <p role="alert" className="t-ui">{msg}</p>}</div>
    </div>
  );
}
