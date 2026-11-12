import Link from "next/link";

/** Endereço que não existe (ou que não é desta conta), dentro da folha: diz isso e mostra a volta. */
export default function NotFound() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-6">
      <p className="t-kicker">Erro 404</p>
      <h1 tabIndex={-1} className="-mt-2 t-title outline-none">
        Esta folha não está no caderno
      </h1>
      <p className="t-reading text-ink-2">O endereço pode ter mudado, ou a página não é desta conta. Nada do que você fez se perdeu.</p>
      <Link href="/hoje" className="mt-2 inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover">
        Voltar para Hoje
      </Link>
    </div>
  );
}
