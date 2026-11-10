import { Lock, PenLine, RotateCcw, Target, Timer } from "lucide-react";
import type { BlockKind } from "@/lib/demo/routine";

const ICONS = {
  revisao: RotateCcw,
  treino: Target,
  redacao: PenLine,
  foco: Timer,
  compromisso: Lock,
} as const;

export function KindIcon({
  kind,
  className = "size-4",
}: {
  kind: BlockKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
