"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADAPTIVE_RULE, buildTasks, chooseTrainingFocus, freeWindows, planDay, type AreaStat, type Window } from "./planner";
import { daysUntil } from "./exam";
import { dateInZone, minuteInZone } from "./schedule-types";

export type PlanResult = { ok: true } | { ok: false; message: string };


/** "2026-11-16T19:30:00" → minuto do dia `day` (recortado a 0–1440 quando atravessa a meia-noite). */
function toMinute(local: string, day: string, edge: "start" | "end"): number {
  const d = local.slice(0, 10);
  if (d < day) return 0;
  if (d > day) return edge === "end" ? 1440 : 1440;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/**
 * Monta (ou refaz) o plano de hoje (F4-T15): horários livres menos compromissos, a partir de agora;
 * revisão vencida, metas por área e o restante da meta diária. Refazer troca só blocos ainda planejados
 * pela agenda; blocos em curso, concluídos ou manuais ficam e ocupam o espaço deles.
 */
export async function generateDayPlan(): Promise<PlanResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para planejar o dia." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, exam_day1")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let tz = profile?.timezone ?? "America/Sao_Paulo";
  let today: string;
  try {
    today = dateInZone(new Date(), tz);
  } catch {
    tz = "America/Sao_Paulo";
    today = dateInZone(new Date(), tz);
  }
  const now = minuteInZone(new Date(), tz);
  const since = new Date(Date.now() - ADAPTIVE_RULE.windowDays * 86_400_000).toISOString();
  const [occ, queue, goals, kept, recent] = await Promise.all([
    supabase.rpc("schedule_occurrences", { p_from: today, p_to: today }),
    supabase.rpc("review_queue", { p_available_minutes: 30 }),
    supabase
      .from("goals")
      .select("level, area_code, target_minutes")
      .is("archived_at", null),
    supabase
      .from("study_blocks")
      .select("start_minute, planned_minutes, actual_minutes, status")
      .eq("local_date", today)
      .neq("status", "planejado"),
    supabase
      .from("attempts")
      .select("item_version_id, is_correct, submitted_at")
      .eq("is_repeat", false)
      .eq("help_seen", false)
      .gte("submitted_at", since),
  ]);
  if (occ.error || queue.error || goals.error)
    return {
      ok: false,
      message: "Não foi possível ler a agenda agora. Tente de novo.",
    };
  const available: Window[] = [];
  const busy: Window[] = [];
  for (const o of (occ.data ?? []) as {
    kind: string;
    local_start: string;
    local_end: string;
  }[]) {
    const w = {
      start: toMinute(o.local_start, today, "start"),
      end: toMinute(o.local_end, today, "end"),
    };
    (o.kind === "compromisso" ? busy : available).push(w);
  }
  for (const b of kept.data ?? [])
    busy.push({
      start: b.start_minute,
      end: b.start_minute + b.planned_minutes,
    });
  const batch = (
    (queue.data ?? []) as { in_batch: boolean; minutes_per_item: number }[]
  ).filter((r) => r.in_batch);
  const g = goals.data ?? [];
  // Blocos já em curso ou feitos hoje contam para a meta: refazer não planeja de novo esse tempo.
  const keptMinutes = (kept.data ?? []).reduce(
    (a, b) =>
      a +
      (b.status === "concluido"
        ? (b.actual_minutes ?? b.planned_minutes)
        : b.planned_minutes),
    0,
  );
  const daily = g.find((x) => x.level === "diaria")?.target_minutes ?? null;
  const focus = chooseTrainingFocus(await areaStats(supabase, recent.data ?? []));
  const { tasks, notes } = buildTasks({
    focus,
    daysToExam: profile?.exam_day1 ? daysUntil(today, profile.exam_day1) : null,
    reviewMinutes: batch.reduce((a, r) => a + r.minutes_per_item, 0),
    reviewCount: batch.length,
    dailyGoal: daily === null ? null : Math.max(0, daily - keptMinutes),
    weeklyGoal: g.find((x) => x.level === "semanal")?.target_minutes ?? null,
    areaGoals: g
      .filter((x) => x.level === "area" && x.target_minutes)
      .map((x) => ({ area: x.area_code!, weeklyMinutes: x.target_minutes! })),
  });
  const windows = freeWindows(available, busy, now);
  const { blocks, leftOut } = planDay(windows, tasks, {
    gap: 5,
    notBefore: now,
    step: 5,
  });
  const del = await supabase
    .from("study_blocks")
    .delete()
    .eq("local_date", today)
    .eq("status", "planejado")
    .eq("source", "agenda-v1");
  if (del.error)
    return {
      ok: false,
      message: "Não foi possível refazer o plano. Tente de novo.",
    };
  if (blocks.length) {
    const ins = await supabase.from("study_blocks").insert(
      blocks.map((b) => ({
        local_date: today,
        timezone: tz,
        start_minute: b.start,
        planned_minutes: b.minutes,
        kind: b.kind,
        area_code: /^(area|foco)-/.test(b.taskId) ? b.taskId.slice(5) : null,
        title: b.title,
        reason: b.reason,
      })),
    );
    if (ins.error)
      return {
        ok: false,
        message: "Não foi possível gravar o plano. Tente de novo.",
      };
  }
  const left = [
    ...leftOut.map((l) => ({ title: l.title, minutes: l.minutes, why: l.why })),
    ...notes.map((n) => ({ note: n })),
  ];
  if (!windows.length && !left.some((l) => "why" in l))
    left.push({
      note: "Não há horário livre a partir de agora. Cadastre horários livres em “Toda semana”.",
    });
  const up = await supabase.from("study_plan_days").upsert({
    user_id: auth.user.id,
    local_date: today,
    left_out: left,
    generated_at: new Date().toISOString(),
  });
  if (up.error)
    return {
      ok: false,
      message: "Plano gravado, mas a explicação não foi salva.",
    };
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return { ok: true };
}

/** Respostas recentes (primeira tentativa, sem ajuda) agrupadas por área das questões publicadas. */
async function areaStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { item_version_id: string; is_correct: boolean | null; submitted_at: string }[],
): Promise<AreaStat[]> {
  const areas: AreaStat["area"][] = ["LC", "CH", "CN", "MT"];
  const stats = new Map(areas.map((a) => [a, { area: a, answers: 0, wrong: 0, daysSinceLast: null as number | null }]));
  if (!rows.length) return [...stats.values()];
  const ids = [...new Set(rows.map((r) => r.item_version_id))];
  const { data } = await supabase.from("study_items").select("item_version_id, area").in("item_version_id", ids);
  const areaOf = new Map((data ?? []).map((r) => [r.item_version_id as string, r.area as AreaStat["area"]]));
  for (const r of rows) {
    const s = stats.get(areaOf.get(r.item_version_id) as AreaStat["area"]);
    if (!s || r.is_correct === null) continue;
    s.answers += 1;
    if (!r.is_correct) s.wrong += 1;
    const days = Math.floor((Date.now() - new Date(r.submitted_at).getTime()) / 86_400_000);
    s.daysSinceLast = s.daysSinceLast === null ? days : Math.min(s.daysSinceLast, days);
  }
  return [...stats.values()];
}

/**
 * Remarcar um bloco do plano (F4-T16). Arrastar e formulário chamam esta mesma ação, que confere no
 * servidor a mesma regra da tela (`canPlace`): dentro do dia, sem sobrepor compromissos nem outros blocos.
 */
export async function rescheduleBlock(input: unknown): Promise<PlanResult> {
  const { z } = await import("zod");
  const { canPlace } = await import("@/lib/demo/routine");
  const p = z
    .object({ id: z.string().uuid(), start: z.number().int().min(0).max(1439) })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Horário inválido." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para remarcar." };
  const { data: block } = await supabase
    .from("study_blocks")
    .select("id, local_date, status, planned_minutes, title")
    .eq("id", p.data.id)
    .maybeSingle();
  if (!block) return { ok: false, message: "Bloco não encontrado." };
  if (block.status !== "planejado")
    return {
      ok: false,
      message: "Só blocos ainda planejados podem ser remarcados.",
    };
  const day = block.local_date as string;
  const tz =
    (
      await supabase
        .from("study_blocks")
        .select("timezone")
        .eq("id", block.id)
        .single()
    ).data?.timezone ?? "America/Sao_Paulo";
  let today = day;
  try {
    today = dateInZone(new Date(), tz);
  } catch {
    // fuso inválido: trata o dia do bloco como hoje
  }
  if (
    day < today ||
    (day === today && p.data.start < minuteInZone(new Date(), tz))
  ) {
    return { ok: false, message: "Esse horário já passou." };
  }
  const [occ, others] = await Promise.all([
    supabase.rpc("schedule_occurrences", { p_from: day, p_to: day }),
    supabase
      .from("study_blocks")
      .select("id, start_minute, planned_minutes, title")
      .eq("local_date", day)
      .neq("status", "dispensado"),
  ]);
  if (occ.error || others.error)
    return { ok: false, message: "Não foi possível conferir a agenda agora." };
  const fixed = (
    (occ.data ?? []) as {
      kind: string;
      title: string | null;
      local_start: string;
      local_end: string;
    }[]
  )
    .filter((o) => o.kind === "compromisso")
    .map((o, i) => {
      const s = toMinute(o.local_start, day, "start");
      return {
        id: `c${i}`,
        kind: "compromisso" as const,
        title: o.title ?? "Compromisso",
        detail: "",
        start: s,
        minutes: toMinute(o.local_end, day, "end") - s,
        fixed: true,
      };
    });
  const blocks = (others.data ?? []).map((b) => ({
    id: b.id,
    kind: "treino" as const,
    title: b.title,
    detail: "",
    start: b.start_minute,
    minutes: b.planned_minutes,
  }));
  const check = canPlace(
    [...blocks, ...fixed],
    block.id,
    p.data.start,
    0,
    1440,
  );
  if (!check.ok) return { ok: false, message: check.reason };
  const { error } = await supabase
    .from("study_blocks")
    .update({ start_minute: p.data.start })
    .eq("id", block.id)
    .eq("status", "planejado");
  if (error)
    return { ok: false, message: "Não foi possível remarcar. Tente de novo." };
  revalidatePath("/rotina");
  revalidatePath("/hoje");
  return { ok: true };
}

export type FocusState = {
  status: string;
  active_seconds: number;
  running: boolean;
  planned_minutes: number;
};

/** Foco e pausa (F4-T17): começar, pausar, concluir ou só ler o estado. O tempo vem do relógio do servidor. */
export async function focusAction(
  input: unknown,
): Promise<{ ok: true; state: FocusState } | { ok: false; message: string }> {
  const { z } = await import("zod");
  const p = z
    .object({
      blockId: z.string().uuid(),
      action: z.enum(["comecar", "pausar", "concluir", "estado"]),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, message: "Ação inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("focus_action", {
    p_block_id: p.data.blockId,
    p_action: p.data.action,
  });
  if (error)
    return {
      ok: false,
      message: /block_closed/.test(error.message)
        ? "Este bloco já foi encerrado."
        : "Não foi possível registrar agora. Tente de novo.",
    };
  const state = (data as FocusState[] | null)?.[0];
  if (!state) return { ok: false, message: "Bloco não encontrado." };
  if (p.data.action !== "estado") {
    revalidatePath("/rotina");
    revalidatePath("/hoje");
  }
  return { ok: true, state };
}
