import Link from "next/link";
import { DeskLamp } from "@/components/shell/desk-lamp";
import { Wordmark } from "@/components/ui/wordmark";

/** Endereço que não existe: uma folha solta na mesa, com o caminho de volta. */
export default function NotFound() {
  return (
    <main id="conteudo" className="desk relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <DeskLamp />
      <div className="relative w-full max-w-[460px] bg-background p-7 shadow-sheet sm:p-10" style={{ transform: "rotate(-1.2deg)" }}>
        <Wordmark size={24} />
        <p className="mt-8 t-kicker">Erro 404</p>
        <h1 className="mt-1 t-title">Esta folha não está no caderno</h1>
        <p className="mt-4 t-reading text-ink-2">O endereço pode ter mudado, ou a página foi retirada. Nada do que você fez se perdeu.</p>
        <Link href="/hoje" className="mt-7 inline-flex min-h-11 items-center rounded-control bg-primary px-4 t-ui text-on-primary hover:bg-primary-hover">
          Voltar para Hoje
        </Link>
      </div>
    </main>
  );
}
