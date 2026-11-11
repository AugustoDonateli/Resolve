"use client";

import { Camera, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeEssayPhoto, uploadEssayPhoto } from "@/lib/essay/photo-actions";
import type { EssayPhoto } from "@/lib/essay/photos";

const MAX_SIDE = 2000;

/** Reduz a foto no aparelho (lado maior até 2000 px, JPEG) respeitando a orientação da câmera. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

/**
 * Redação por foto: a folha escrita à mão fica ao lado do editor para você digitar o texto olhando
 * para ela. Só o texto digitado vai para a correção. A transcrição automática depende da chave de IA.
 */
export function EssayPhotos({ essayId, photos, readOnly }: { essayId: string; photos: EssayPhoto[]; readOnly: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];

  const send = (file: File) =>
    start(async () => {
      setMsg(null);
      let blob: Blob = file;
      try {
        blob = await shrink(file);
      } catch {
        // sem suporte para reduzir: envia o original (o servidor recusa acima de 4 MB)
      }
      const form = new FormData();
      form.set("essayId", essayId);
      form.set("file", new File([blob], "folha.jpg", { type: blob.type || file.type }));
      const r = await uploadEssayPhoto(form);
      if (!r.ok) setMsg(r.message);
      else {
        setIndex(photos.length);
        router.refresh();
      }
    });

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) send(f);
      }}
    />
  );

  if (!photos.length)
    return readOnly ? null : (
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line px-4 py-3">
        <p className="min-w-0 flex-1 t-meta text-ink-2">
          Escreveu no papel? Envie a foto da folha e digite o texto olhando para ela. A leitura automática da foto ainda não está
          disponível.
        </p>
        <Button type="button" variant="secondary" loading={pending} onClick={() => input.current?.click()} icon={<Camera aria-hidden className="size-4" />}>
          Enviar foto da folha
        </Button>
        {picker}
        {msg && <p role="alert" className="w-full t-meta">{msg}</p>}
      </div>
    );

  return (
    <section aria-label="Foto da folha manuscrita" className="flex flex-col gap-3 lg:sticky lg:top-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-kicker">Folha manuscrita</h2>
        {photos.length > 1 && (
          <div className="flex gap-1" role="group" aria-label="Escolher foto">
            {photos.map((p, i) => (
              <button
                key={p.path}
                type="button"
                aria-pressed={p === current}
                onClick={() => setIndex(i)}
                className="min-h-9 min-w-9 rounded-control border border-line px-2 t-meta aria-pressed:bg-ink aria-pressed:text-background"
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      {current?.url ? (
        <div className="max-h-[70vh] overflow-auto rounded-card border border-line bg-surface-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element -- link assinado temporário do armazenamento pessoal */}
          <img src={current.url} alt={`Foto ${Math.min(index, photos.length - 1) + 1} da folha manuscrita`} className="block w-full" />
        </div>
      ) : (
        <p className="t-meta text-ink-2">Não foi possível abrir a foto agora. Recarregue a página.</p>
      )}
      <p className="t-meta text-ink-2">Digite o texto olhando para a foto. Só o texto digitado vai para a correção.</p>
      <div className="flex flex-wrap gap-2">
        {current?.url && (
          <a href={current.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 t-ui text-link hover:bg-surface-subtle">
            <ExternalLink aria-hidden className="size-4" /> Ampliar
          </a>
        )}
        {!readOnly && photos.length < 4 && (
          <Button type="button" variant="ghost" loading={pending} onClick={() => input.current?.click()} icon={<Camera aria-hidden className="size-4" />}>
            Outra foto
          </Button>
        )}
        {!readOnly && current && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            icon={<Trash2 aria-hidden className="size-4" />}
            onClick={() =>
              start(async () => {
                const r = await removeEssayPhoto({ essayId, path: current.path });
                if (!r.ok) setMsg(r.message);
                else {
                  setIndex(0);
                  router.refresh();
                }
              })
            }
          >
            Remover foto
          </Button>
        )}
      </div>
      {picker}
      <div aria-live="polite">{msg && <p role="alert" className="t-meta">{msg}</p>}</div>
    </section>
  );
}
