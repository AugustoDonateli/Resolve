import "server-only";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  dateInZone,
  type Occurrence,
  type ScheduleException,
  type WeeklyRule,
} from "./schedule-types";

export interface ScheduleData {
  timezone: string;
  today: string;
  days: string[];
  rules: WeeklyRule[];
  exceptions: ScheduleException[];
  occurrences: Occurrence[];
}

const RULE_COLS =
  "id, weekday, start_time, end_time, timezone, valid_from, valid_until";

/** Regras, exceções e ocorrências dos próximos 7 dias da conta do login. Nulo sem login. */
export async function loadSchedule(): Promise<ScheduleData | null> {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let timezone = profile?.timezone ?? "America/Sao_Paulo";
  let today: string;
  try {
    today = dateInZone(new Date(), timezone);
  } catch {
    timezone = "America/Sao_Paulo"; // o banco usa o mesmo padrão para fuso inválido
    today = dateInZone(new Date(), timezone);
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [av, fc, ex, occ] = await Promise.all([
    supabase
      .from("availability_rules")
      .select(RULE_COLS)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("fixed_commitments")
      .select(`${RULE_COLS}, title`)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("schedule_exceptions")
      .select(
        "id, kind, action, availability_rule_id, commitment_id, on_date, start_time, end_time, timezone, title",
      )
      .gte("on_date", addDays(today, -1))
      .lte("on_date", addDays(today, 7))
      .order("on_date"),
    supabase.rpc("schedule_occurrences", { p_from: today, p_to: days[6] }),
  ]);
  const rules: WeeklyRule[] = [
    ...(av.data ?? []).map((r) => ({
      ...r,
      kind: "disponivel" as const,
      title: null,
    })),
    ...(fc.data ?? []).map((r) => ({ ...r, kind: "compromisso" as const })),
  ];
  const exceptions: ScheduleException[] = (ex.data ?? []).map((e) => ({
    id: e.id,
    kind: e.kind,
    action: e.action,
    rule_id: e.availability_rule_id ?? e.commitment_id,
    on_date: e.on_date,
    start_time: e.start_time,
    end_time: e.end_time,
    timezone: e.timezone,
    title: e.title,
  }));
  return {
    timezone,
    today,
    days,
    rules,
    exceptions,
    occurrences: (occ.data ?? []) as Occurrence[],
  };
}
