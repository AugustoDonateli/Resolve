"use client";

import { clsx } from "clsx";
import { usePrefs, type TextScale, type ThemePref } from "./prefs";

function Segmented<T extends string>({ legend, value, options, onChange, name }: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; name: string }) {
  return (
    <fieldset>
      <legend className="mb-2 t-ui">{legend}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-control border border-line bg-surface p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={clsx(
              "relative flex min-h-10 cursor-pointer items-center rounded-[6px] px-3.5 t-ui transition-colors duration-[var(--rs-dur-state)]",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link",
              value === o.value ? "bg-ink text-background" : "text-ink hover:bg-surface-subtle",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Preferências de tema, movimento e leitura (T01). Ficam neste aparelho até existir conta. */
export function PrefsForm() {
  const p = usePrefs();
  return (
    <div className="flex flex-col gap-6">
      <Segmented<ThemePref>
        legend="Tema"
        name="theme"
        value={p.theme}
        onChange={(theme) => p.set({ theme })}
        options={[
          { value: "system", label: "Sistema" },
          { value: "light", label: "Claro" },
          { value: "dark", label: "Escuro" },
        ]}
      />
      <Segmented<TextScale>
        legend="Tamanho da leitura"
        name="text-scale"
        value={p.textScale}
        onChange={(textScale) => p.set({ textScale })}
        options={[
          { value: "18", label: "18 px" },
          { value: "20", label: "20 px" },
          { value: "22", label: "22 px" },
        ]}
      />
      <SyncNote />
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={p.reduceMotion}
            onChange={(e) => p.set({ reduceMotion: e.target.checked })}
            className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--rs-primary)]"
          />
          <span>
            <span className="block t-ui">Reduzir movimento</span>
            <span className="block t-meta text-ink-2">
              Mostra o estado final sem deslocamentos. {p.reduced && !p.reduceMotion ? "Seu sistema já pede redução, e ela está ativa." : "Também vale se o sistema pedir redução."}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function SyncNote() {
  const { sync } = usePrefs();
  if (sync === "local") return null;
  const text =
    sync === "saving"
      ? "Salvando na conta…"
      : sync === "saved"
        ? "Salvo na conta."
        : sync === "error"
          ? "Não foi possível salvar na conta agora. A preferência vale neste aparelho; tente de novo."
          : "";
  return (
    <p className="-mt-2 min-h-5 t-meta text-ink-2" aria-live="polite" data-testid="prefs-sync">
      {text}
    </p>
  );
}
