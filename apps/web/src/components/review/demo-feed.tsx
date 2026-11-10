"use client";

import { DemoBadge } from "@/components/ui/demo-badge";
import { demoCards } from "@/lib/demo/cards";
import { CardFeed } from "./card-feed";

export function DemoFeed() {
  return <CardFeed cards={demoCards} onAnswer={async () => null} badge={<DemoBadge>Cartões demonstrativos</DemoBadge>} />;
}
