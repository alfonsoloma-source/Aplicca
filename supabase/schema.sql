-- ============================================================
-- Aplicca — Esquema de base de datos para Supabase (PostgreSQL)
-- ============================================================
-- Cómo usarlo:
--   1. Entra a tu proyecto en supabase.com → SQL Editor
--   2. Pega este archivo completo → Run
--   3. Verifica en Table Editor que se crearon las tablas
-- ============================================================

-- ------------------------------------------------------------
-- Extensión necesaria para generar UUIDs
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabla base: perfiles (1 fila por usuario de auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('candidato', 'empresa', 'admin')),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un usuario ve y edita solo su propio profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Perfiles de candidato
-- ------------------------------------------------------------
create table public.candidate_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  phone text,
  location text,
  cv_url text,
  skills jsonb default '[]',
  experience_summary text,
  desired_position text,
  salary_expectation numeric,
  work_mode text check (work_mode in ('remoto', 'hibrido', 'presencial')),
  open_to_relocate boolean default false,
  open_to_travel boolean default false,
  has_vehicle boolean default false,
  profile_visible boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_profiles enable row level security;

create policy "El candidato administra su propio perfil"
  on public.candidate_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Las empresas pueden ver perfiles visibles"
  on public.candidate_profiles for select
  using (
    profile_visible = true
    or auth.uid() = id
  );

-- ------------------------------------------------------------
-- Perfiles de empresa
-- ------------------------------------------------------------
create table public.company_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null,
  legal_name text,
  tax_id text,
  industry text,
  company_size text,
  founded_year int,
  website text,
  description text,
  logo_url text,
  domain_verified boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_profiles enable row level security;

create policy "La empresa administra su propio perfil"
  on public.company_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Cualquiera puede ver perfiles de empresa verificados"
  on public.company_profiles for select
  using (domain_verified = true or auth.uid() = id);

-- ------------------------------------------------------------
-- Vacantes
-- ------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  title text not null,
  description text,
  requirements jsonb default '[]',
  salary_min numeric,
  salary_max numeric,
  work_mode text check (work_mode in ('remoto', 'hibrido', 'presencial')),
  contract_type text,
  experience_level text,
  education_min text,
  positions_count int default 1,
  status text not null default 'activa' check (status in ('activa', 'pausada', 'cerrada', 'borrador')),
  application_deadline date,
  whatsapp_link_code text unique default substr(md5(random()::text), 1, 8),
  published_at timestamptz default now(),
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "Cualquiera puede ver vacantes activas"
  on public.jobs for select
  using (status = 'activa' or auth.uid() = company_id);

create policy "La empresa administra sus propias vacantes"
  on public.jobs for insert with check (auth.uid() = company_id);
create policy "La empresa edita sus propias vacantes"
  on public.jobs for update using (auth.uid() = company_id);
create policy "La empresa elimina sus propias vacantes"
  on public.jobs for delete using (auth.uid() = company_id);

-- ------------------------------------------------------------
-- Postulaciones (candidato ↔ vacante)
-- ------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  status text not null default 'nuevo' check (status in ('nuevo', 'revisado', 'entrevista', 'oferta', 'rechazado', 'contratado')),
  source text default 'plataforma' check (source in ('plataforma', 'whatsapp')),
  applied_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

alter table public.applications enable row level security;

-- Regla clave contra IDOR: cada quien ve SOLO lo suyo, cruzando ambas tablas.
create policy "El candidato ve sus propias postulaciones"
  on public.applications for select
  using (auth.uid() = candidate_id);

create policy "La empresa ve postulaciones a SUS vacantes"
  on public.applications for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
      and jobs.company_id = auth.uid()
    )
  );

create policy "El candidato crea sus propias postulaciones"
  on public.applications for insert
  with check (auth.uid() = candidate_id);

create policy "La empresa actualiza el estatus de postulaciones a sus vacantes"
  on public.applications for update
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
      and jobs.company_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Mensajes (cuelgan de una postulación, no son un chat libre)
-- ------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  sent_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Solo candidato y empresa de esa postulación ven los mensajes"
  on public.messages for select
  using (
    exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = messages.application_id
      and (a.candidate_id = auth.uid() or j.company_id = auth.uid())
    )
  );

create policy "Solo candidato y empresa de esa postulación pueden escribir"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = messages.application_id
      and (a.candidate_id = auth.uid() or j.company_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- Búsquedas guardadas / alertas
-- ------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  filters jsonb not null default '{}',
  alert_enabled boolean default true,
  created_at timestamptz not null default now()
);

alter table public.saved_searches enable row level security;

create policy "El candidato administra sus propias búsquedas guardadas"
  on public.saved_searches for all
  using (auth.uid() = candidate_id)
  with check (auth.uid() = candidate_id);

-- ------------------------------------------------------------
-- Suscripciones / plan de la empresa
-- ------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  plan_type text not null default 'gratis' check (plan_type in ('gratis', 'por_vacante', 'suscripcion')),
  starts_at timestamptz default now(),
  ends_at timestamptz
);

alter table public.subscriptions enable row level security;

create policy "La empresa ve y administra su propia suscripción"
  on public.subscriptions for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- ------------------------------------------------------------
-- Reportes de vacantes fraudulentas (moderación)
-- ------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reporter_id uuid references public.profiles(id),
  reason text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'revisado', 'descartado')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Cualquier usuario autenticado puede reportar una vacante"
  on public.reports for insert
  with check (auth.uid() is not null);

create policy "Solo administradores pueden ver y resolver reportes"
  on public.reports for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ------------------------------------------------------------
-- Trigger: crear automáticamente la fila en profiles al registrarse
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'candidato'),
    new.email
  );

  if coalesce(new.raw_user_meta_data->>'role', 'candidato') = 'empresa' then
    insert into public.company_profiles (id, company_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'company_name', 'Mi empresa'));
  else
    insert into public.candidate_profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- Permisos explícitos para los roles de la Data API
-- ------------------------------------------------------------
-- Necesarios si en tu proyecto desactivaste "Automatically expose new
-- tables" al crearlo (recomendado por Supabase). El RLS de arriba sigue
-- controlando QUÉ FILAS ve cada quien; esto solo abre la puerta de la
-- tabla en sí para los roles anon (sin sesión) y authenticated (con sesión).
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.candidate_profiles,
  public.company_profiles,
  public.jobs,
  public.applications,
  public.messages,
  public.saved_searches,
  public.subscriptions,
  public.reports
to authenticated;

-- El rol anon (visitante sin cuenta) solo puede leer vacantes activas y
-- perfiles de empresa verificados, para permitir "explorar antes de
-- registrarte". El RLS de arriba ya filtra las filas exactas.
grant select on public.jobs, public.company_profiles to anon;

