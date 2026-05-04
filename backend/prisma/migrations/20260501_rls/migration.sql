-- RLS policies for the realtime path.
-- Backend (Prisma) connects directly via DATABASE_URL and bypasses RLS.
-- These policies gate what anon-key clients (Realtime subscribers) can read.

-- ─── Helper: current user's normalized role ─────────────────────────────────
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid()
$$;

-- ─── Enable RLS on every table that anon clients can subscribe to ───────────
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.project_documents   enable row level security;
alter table public.project_risks       enable row level security;
alter table public.monthly_allocations enable row level security;
alter table public.plan_items          enable row level security;
alter table public.plan_item_assignees enable row level security;
alter table public.worklogs            enable row level security;
alter table public.delay_raises        enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.catalog_groups      enable row level security;

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Each user may read their own profile; PMO/ADMIN_HC can read any profile.
create policy profiles_self_or_admin
  on public.profiles for select
  using (id = auth.uid() or public.current_role() in ('PMO', 'ADMIN_HC'));

-- ─── projects ───────────────────────────────────────────────────────────────
-- Mirrors getVisibleProjects() in src/lib/calculations.ts
create policy projects_visible
  on public.projects for select
  using (
    public.current_role() in ('PMO', 'ADMIN_HC')
    or "adminId" = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm."projectId" = projects.id
        and pm."userId" = auth.uid()
    )
    or exists (
      select 1
      from jsonb_array_elements(coalesce("personnelInfo"->'aitsMembers', '[]'::jsonb)) m
      where m->>'userId' = auth.uid()::text
    )
  );

-- ─── project_members ────────────────────────────────────────────────────────
create policy project_members_visible
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_members."projectId"
    )
  );

-- ─── catalog_groups ─────────────────────────────────────────────────────────
-- Catalogs are global look-up tables, readable by every authenticated user.
create policy catalog_groups_authenticated
  on public.catalog_groups for select
  to authenticated
  using (true);

-- ─── plan_items / plan_item_assignees / worklogs / delay_raises ─────────────
-- Visible iff the parent project is visible. RLS chains via the projects policy.
create policy plan_items_via_project
  on public.plan_items for select
  using (
    exists (select 1 from public.projects p where p.id = plan_items."projectId")
  );

create policy plan_item_assignees_via_plan_item
  on public.plan_item_assignees for select
  using (
    exists (
      select 1 from public.plan_items pi
      join public.projects p on p.id = pi."projectId"
      where pi.id = plan_item_assignees."planItemId"
    )
  );

create policy worklogs_via_project
  on public.worklogs for select
  using (
    exists (select 1 from public.projects p where p.id = worklogs."projectId")
  );

create policy delay_raises_via_project
  on public.delay_raises for select
  using (
    exists (select 1 from public.projects p where p.id = delay_raises."projectId")
  );

create policy activity_logs_via_project
  on public.activity_logs for select
  using (
    exists (select 1 from public.projects p where p.id = activity_logs."projectId")
  );

-- ─── project_documents / project_risks / monthly_allocations ────────────────
create policy project_documents_via_project
  on public.project_documents for select
  using (
    exists (select 1 from public.projects p where p.id = project_documents."projectId")
  );

create policy project_risks_via_project
  on public.project_risks for select
  using (
    exists (select 1 from public.projects p where p.id = project_risks."projectId")
  );

create policy monthly_allocations_via_project
  on public.monthly_allocations for select
  using (
    exists (select 1 from public.projects p where p.id = monthly_allocations."projectId")
  );

-- ─── Realtime publication ───────────────────────────────────────────────────
-- Add tables to the supabase_realtime publication so postgres_changes events fire.
-- Wrapped in DO blocks so the migration is idempotent across environments.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.projects';
    execute 'alter publication supabase_realtime add table public.plan_items';
    execute 'alter publication supabase_realtime add table public.worklogs';
    execute 'alter publication supabase_realtime add table public.delay_raises';
    execute 'alter publication supabase_realtime add table public.activity_logs';
    execute 'alter publication supabase_realtime add table public.project_documents';
    execute 'alter publication supabase_realtime add table public.project_risks';
    execute 'alter publication supabase_realtime add table public.monthly_allocations';
  end if;
exception when duplicate_object then
  -- Tables already in publication — fine.
  null;
end $$;

-- NOTE: All write policies (INSERT/UPDATE/DELETE) are intentionally omitted.
-- Writes go through the Express backend with a direct DB connection that
-- bypasses RLS. Anon clients cannot write — Realtime broadcasts still fire
-- because they originate from logical replication, not PostgREST.
