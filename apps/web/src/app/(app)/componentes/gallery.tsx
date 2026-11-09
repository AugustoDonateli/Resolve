"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Alternatives, type AlternativeItem } from "@/components/ui/alternatives";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

const ITEMS: AlternativeItem[] = [
  { key: "a", letter: "A", content: "Alternativa neutra." },
  { key: "b", letter: "B", content: "Alternativa que pode ser selecionada." },
  { key: "c", letter: "C", content: "Alternativa que pode ser eliminada com a tesoura." },
];

/** Galeria de estados dos controles essenciais (F1-T03). Textos genéricos, sem conteúdo de prova. */
export function Gallery() {
  const [v, setV] = useState<string | null>(null);
  const [elim, setElim] = useState<Set<string>>(new Set(["c"]));
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section aria-labelledby="g-buttons" className="flex flex-col gap-4">
        <h2 id="g-buttons" className="t-section">Botões</h2>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Play aria-hidden className="size-4" />}>Começar</Button>
          <Button variant="secondary">Remarcar</Button>
          <Button variant="ghost">Trocar atividade</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading>Enviando</Button>
          <Button disabled>Confirmar resposta</Button>
          <Button size="sm">Pequeno</Button>
        </div>
      </section>

      <section aria-labelledby="g-fields" className="flex flex-col gap-2">
        <h2 id="g-fields" className="t-section">Campos</h2>
        <TextField label="Nome de exibição" placeholder="Como quer ser chamado" hint="Aparece só para você." />
        <TextField label="E-mail" defaultValue="guto@" error="Falta o domínio. Exemplo: nome@email.com" />
        <TextField label="Plano se-então" defaultValue="Se chegar cansado, faço revisão" saveState="saved" />
        <TextField label="Rascunho" defaultValue="Texto em outra aba" saveState="conflict" />
      </section>

      <section aria-labelledby="g-alt" className="flex flex-col gap-3">
        <h2 id="g-alt" className="t-section" >Alternativas · escolha</h2>
        <p id="g-alt-cmd" className="t-meta text-ink-2">Selecione, elimine e restaure. A geometria não muda.</p>
        <Alternatives name="g1" labelledBy="g-alt-cmd" items={ITEMS} value={v} onValueChange={setV} eliminated={elim}
          onToggleEliminate={(k) => setElim((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
          confirmed={false} reveal={null} />
      </section>

      <section aria-labelledby="g-alt2" className="flex flex-col gap-3">
        <h2 id="g-alt2" className="t-section">Alternativas · gabarito revelado</h2>
        <p id="g-alt2-cmd" className="t-meta text-ink-2">Resposta confirmada em B; correta em A. Estado com texto e ícone.</p>
        <Alternatives name="g2" labelledBy="g-alt2-cmd" items={ITEMS} value="b" onValueChange={() => {}} eliminated={new Set()}
          onToggleEliminate={() => {}} confirmed reveal={{ correctKey: "a" }} />
      </section>
    </div>
  );
}
