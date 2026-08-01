create table if not exists public.atestados (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  codigo_acesso text not null,
  emissao_atestado text not null,
  nome_paciente text not null,
  cpf text not null,
  data_nascimento text not null,
  endereco text,
  nome_medico text not null,
  genero_medico text not null,
  crm text not null,
  crm_uf text not null,
  endereco_clinica text,
  texto_atestado text not null,
  quantidade integer not null default 1,
  pdf_url text,
  created_at timestamptz not null default now(),
  constraint atestados_quantidade_check check (quantidade between 1 and 14)
);

grant select on public.atestados to authenticated;
grant all on public.atestados to service_role;

alter table public.atestados enable row level security;

create policy "Admins can manage atestados"
  on public.atestados for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_cargo))
  with check (public.has_role(auth.uid(), 'admin'::app_cargo));

create or replace function public.verify_atestado(_token text)
returns setof public.atestados
language sql
stable
security definer
set search_path = public
as $$
  select * from public.atestados where lower(token) = lower(_token) limit 1;
$$;

grant execute on function public.verify_atestado(text) to anon, authenticated;