-- F5-T08 (ajuste achado no teste de concorrência): apagar a redação apaga o trabalho, e a reserva aberta
-- ficava "reservada" sem trabalho, segurando saldo para sempre. Agora apagar o trabalho libera a reserva aberta.
-- A reserva em "reconciliar" continua: a chamada pode ter sido cobrada e precisa ser reconciliada.
create function private.release_job_reservations() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  for v_id in select r.id from public.ai_reservations r where r.job_id = old.id and r.status = 'reservada' loop
    perform private.settle(v_id, 'liberada', null, now());
  end loop;
  return old;
end;
$$;
create trigger essay_jobs_release_reservations before delete on public.essay_jobs
  for each row execute function private.release_job_reservations();
revoke all on function private.release_job_reservations() from public, anon, authenticated;
