"use client";

import { DemoBadge } from "@/components/ui/demo-badge";
import { demoBackend, demoSkillEntry } from "@/lib/demo/skills";
import { SkillRunner, type Taxon } from "./skill-runner";

export function DemoSkill({ skill, taxonomy }: { skill: "comando" | "distrator"; taxonomy: Taxon[] }) {
  return <SkillRunner skill={skill} entries={[demoSkillEntry]} backend={demoBackend} taxonomy={taxonomy} badge={<DemoBadge>Questão demonstrativa</DemoBadge>} />;
}
