"use client";

import { clsx } from "clsx";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KINDS, type Kind, type RepertoireItem } from "@/lib/essay/repertoire-types";
import { addRepertoire, archiveRepertoire } from "@/lib/essay/repertoire-actions";

const field = "min-h-11 w-full rounded-control border border-line bg-surface px-3 t-ui text-ink";

export function RepertoireView({ items, axes }: { items: RepertoireItem[]; axes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(items.length === 0);
  const [form, setForm] = useState({ kind: "dado" as Kind, content: "", origin: "", source: "", axes: "", use_note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [kind, setKind] = useState<Kind | "todos">("todos");
  const [axis, setAxis] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const active = items.filter((i) => !i.archived_at);
  const archived = items.filter((i) => i.archived_at);
  const allAxes = useMemo(() => [...new Set([...axes, ...active.flatMap((i) => i.axes)])].sort(), [axes, active]);
  const shown = active.filter(
    (i) =>
      (kind === "todos" || i.kind === kind) &&
      (axis === "todos" || i.axes.includes(axis)) &&
      (!q.trim() || `${i.content} ${i.origin ?? ""} ${i.source} ${i.use_note ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const save = () =>
    start(async () => {
      const r = await addRepertoire({
        kind: form.kind,
        content: form.content,
        origin: form.origin,
        source: form.source,
        axes: form.axes.split(",").map((a) => a.trim()).filter(Boolean),
        use_note: form.use_note,
      });
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      setMsg({ ok: true, text: "Repertório guardado." });
      setForm({ kind: form.kind, content: "", origin: "", source: "", axes: form.axes, use_note: "" });
      router.refresh();
    });

  const archive = (id: string, archived: boolean) =>
    start(async () => {
      await archiveRepertoire({ id, archived });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="novo" className="max-w-2xl">
        {!open ? (
          <Button type="button" onClick={() => setOpen(true)} icon={<Plus aria-hidden className="size-4" />}>
            Novo repertório
          </Button>
        ) : (
          <form
            aria-labelledby="novo"
            className="flex flex-col gap-4 rounded-panel border border-line-subtle bg-surface p-5 shadow-paper"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2 id="novo" className="t-section">
              Novo repertório
            </h2>
            <label className="flex flex-col gap-1.5 t-ui">
              Tipo
              <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                {Object.entries(KINDS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 t-ui">
              Repertório
              <textarea rows={3} className={clsx(field, "py-2")} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 t-ui">
                Autor ou origem (opcional)
                <input className={field} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 t-ui">
                Fonte
                <input className={field} value={form.source} placeholder="Livro, lei, artigo, página…" onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 t-ui">
              Eixos (separados por vírgula)
              <input className={field} list="eixos" value={form.axes} placeholder="educação, meio ambiente" onChange={(e) => setForm({ ...form, axes: e.target.value })} />
              <datalist id="eixos">
                {allAxes.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1.5 t-ui">
              Como usar (opcional)
              <input className={field} value={form.use_note} placeholder="Que ideia ele comprova?" onChange={(e) => setForm({ ...form, use_note: e.target.value })} />
            </label>
            <p className="t-meta text-ink-2">Sem fonte, o repertório não entra: na redação, você precisa saber de onde veio.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={pending} disabled={!form.content.trim() || form.source.trim().length < 5}>
                Guardar
              </Button>
              {items.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              )}
              <span aria-live="polite" className="t-meta">
                {msg?.text}
              </span>
            </div>
          </form>
        )}
      </section>

      {active.length > 0 && (
        <section aria-labelledby="meu-repertorio" className="flex flex-col gap-4">
          <h2 id="meu-repertorio" className="t-section">
            Meu repertório <span className="t-meta tabular text-ink-2">({active.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Buscar no repertório" placeholder="Buscar" className={clsx(field, "max-w-xs")} value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Tipo" className={clsx(field, "max-w-[12rem]")} value={kind} onChange={(e) => setKind(e.target.value as Kind | "todos")}>
              <option value="todos">Todos os tipos</option>
              {Object.entries(KINDS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <select aria-label="Eixo" className={clsx(field, "max-w-[14rem]")} value={axis} onChange={(e) => setAxis(e.target.value)}>
              <option value="todos">Todos os eixos</option>
              {allAxes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <ul className="flex flex-col border-t border-line-subtle">
            {shown.map((i) => (
              <li key={i.id} className="grid gap-2 border-b border-line-subtle py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:gap-6">
                <span className="t-kicker pt-1">{KINDS[i.kind]}</span>
                <div className="flex flex-col gap-1">
                  <p className={clsx("text-ink", i.kind === "citacao" ? "font-display text-[20px] leading-snug" : "t-reading")}>
                    {i.kind === "citacao" ? `“${i.content}”` : i.content}
                  </p>
                  {i.origin && <p className="t-ui text-ink-2">{i.origin}</p>}
                  <p className="t-meta text-ink-2">Fonte: {i.source}</p>
                  {i.use_note && <p className="t-meta text-ink">Uso: {i.use_note}</p>}
                  {i.axes.length > 0 && (
                    <p className="flex flex-wrap gap-1.5 pt-1">
                      {i.axes.map((a) => (
                        <span key={a} className="rounded-full bg-surface-subtle px-2.5 py-0.5 t-meta text-ink">
                          {a}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => archive(i.id, true)} icon={<Archive aria-hidden className="size-4" />}>
                  Arquivar
                </Button>
              </li>
            ))}
            {shown.length === 0 && <li className="py-4 t-meta text-ink-2">Nada com esses filtros.</li>}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <details className="t-meta">
          <summary className="cursor-pointer t-ui text-ink">Arquivados ({archived.length})</summary>
          <ul className="mt-2 flex flex-col">
            {archived.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle py-2">
                <span className="text-ink-2">{i.content.slice(0, 120)}</span>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => archive(i.id, false)} icon={<ArchiveRestore aria-hidden className="size-4" />}>
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
