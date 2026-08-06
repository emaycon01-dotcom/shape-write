select cron.schedule(
  'reconcile-pix',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://doycwownddyxfqntifca.supabase.co/functions/v1/reconcile-pix',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);