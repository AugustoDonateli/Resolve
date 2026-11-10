-- Agenda do serviço de correção: a cada 5 minutos, chama a Edge Function corrigir-redacao só quando há
-- trabalho na fila (inclui nova tentativa automática e concessão vencida). Usa o token anônimo público
-- (o mesmo do navegador); a função não depende dele para nada além de passar pela verificação do gateway.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create function private.nudge_essay_worker() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.essay_jobs j
              where j.status = 'na_fila' or (j.status = 'nova_tentativa' and j.auto_retry)
                 or (j.status = 'em_analise' and j.lease_until < now())) then
    perform net.http_post(
      url := 'https://osgajpnvhhwujfzjlfwf.supabase.co/functions/v1/corrigir-redacao',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zZ2FqcG52aGh3dWpmempsZndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxODczNzQsImV4cCI6MjEwOTc2MzM3NH0.Fi4LKeYhD5HCBl97UKZhMabVAOLJlzaLw2DLhwcmu-w'),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
end;
$$;
revoke all on function private.nudge_essay_worker() from public, anon, authenticated;

select cron.schedule('corrigir-redacoes', '*/5 * * * *', 'select private.nudge_essay_worker()');
